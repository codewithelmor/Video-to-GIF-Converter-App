import { app, BrowserWindow, ipcMain, dialog, shell } from 'electron';
import { spawn, ChildProcess } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

let win: BrowserWindow | null = null;
/** The running conversion, if any (only one at a time). */
let activeJob: ChildProcess | null = null;

const PROBE_TIMEOUT_MS = 30_000;
const VIDEO_EXTENSIONS = ['mp4', 'mkv', 'mov', 'avi', 'webm', 'm4v', 'wmv', 'flv', 'mpg', 'mpeg', 'ts', '3gp'];

// ---- locating the Python backend -------------------------------------------

function backendCommand(args: string[]): { cmd: string; args: string[] } {
  const isWindows = process.platform === 'win32';
  if (app.isPackaged) {
    const exe = isWindows ? 'backend.exe' : 'backend';
    return { cmd: path.join(process.resourcesPath, 'backend', exe), args };
  }
  // out/main.js -> app/out -> repo root
  const script = path.join(__dirname, '..', '..', 'backend', 'backend.py');
  const python = process.env.PYTHON || (isWindows ? 'python' : 'python3');
  return { cmd: python, args: ['-X', 'utf8', '-u', script, ...args] };
}

interface RunOptions {
  /** Called for every event line as it arrives. */
  onEvent?: (ev: BackendEvent) => void;
  /** Gives the caller the process (to cancel it). */
  onStart?: (proc: ChildProcess) => void;
  timeoutMs?: number;
}

// Runs one backend command and resolves with the last JSON event it printed.
function runBackend(args: string[], opts: RunOptions = {}): Promise<BackendEvent> {
  return new Promise((resolve) => {
    const { cmd, args: fullArgs } = backendCommand(args);
    const proc = spawn(cmd, fullArgs, {
      windowsHide: true,
      env: { ...process.env, PYTHONIOENCODING: 'utf-8' },
    });
    opts.onStart?.(proc);

    let last: BackendEvent | null = null;
    let buffer = '';
    let stderr = '';
    let settled = false;
    let timer: NodeJS.Timeout | undefined;
    const finish = (ev: BackendEvent): void => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      resolve(ev);
    };
    if (opts.timeoutMs) {
      timer = setTimeout(() => {
        proc.kill();
        finish({ event: 'error', message: 'The backend took too long to respond.' });
      }, opts.timeoutMs);
    }

    const parseLine = (raw: string): void => {
      const line = raw.trim();
      if (!line) return;
      try {
        last = JSON.parse(line) as BackendEvent;
        opts.onEvent?.(last);
      } catch {
        /* ignore non-JSON noise */
      }
    };

    proc.stdout.setEncoding('utf8');
    proc.stdout.on('data', (chunk: string) => {
      buffer += chunk;
      let nl: number;
      while ((nl = buffer.indexOf('\n')) >= 0) {
        parseLine(buffer.slice(0, nl));
        buffer = buffer.slice(nl + 1);
      }
    });
    proc.stderr.on('data', (d) => { stderr += d; });
    proc.on('error', (err) => finish({ event: 'error', message: `Could not start the backend: ${err.message}` }));
    proc.on('close', () => {
      parseLine(buffer);
      finish(last ?? { event: 'error', message: stderr.trim() || 'The backend did not respond.' });
    });
  });
}

function unexpected(ev: BackendEvent): { error: string } {
  return { error: ev.event === 'error' ? ev.message : 'Unexpected backend response.' };
}

/** Asks the running conversion to stop; the backend then kills FFmpeg and cleans up. */
function cancelActiveJob(): void {
  const proc = activeJob;
  if (!proc) return;
  try {
    proc.stdin?.write('cancel\n');
  } catch {
    proc.kill();
  }
  // Safety net in case the backend does not react.
  setTimeout(() => { if (proc.exitCode === null) proc.kill(); }, 5000).unref();
}

// ---- settings --------------------------------------------------------------

const settingsFile = () => path.join(app.getPath('userData'), 'settings.json');

function loadSettings(): Partial<Settings> {
  try {
    return JSON.parse(fs.readFileSync(settingsFile(), 'utf8'));
  } catch {
    return {};
  }
}

// ---- IPC ---------------------------------------------------------------------

ipcMain.handle('settings:get', (): Settings => ({
  folder: app.getPath('videos'),
  ...loadSettings(),
}));

ipcMain.handle('settings:set', (_e, settings: Settings): void => {
  fs.mkdirSync(path.dirname(settingsFile()), { recursive: true });
  fs.writeFileSync(settingsFile(), JSON.stringify(settings));
});

ipcMain.handle('video:pick', async (_e, current: string): Promise<string | null> => {
  const r = await dialog.showOpenDialog(win!, {
    properties: ['openFile'],
    defaultPath: current,
    filters: [
      { name: 'Video files', extensions: VIDEO_EXTENSIONS },
      { name: 'All files', extensions: ['*'] },
    ],
  });
  return r.canceled ? null : r.filePaths[0];
});

ipcMain.handle('video:probe', async (_e, file: string): Promise<ProbeResult> => {
  const ev = await runBackend(['probe', file], { timeoutMs: PROBE_TIMEOUT_MS });
  if (ev.event === 'probe') {
    const { event: _event, ...info } = ev;
    return info;
  }
  return unexpected(ev);
});

ipcMain.handle('video:convert', async (e, req: ConvertRequest): Promise<ConvertResult> => {
  if (activeJob) return { error: 'A conversion is already running.' };

  const base = path.basename(req.file, path.extname(req.file));
  const r = await dialog.showSaveDialog(win!, {
    defaultPath: path.join(path.dirname(req.file), `${base}.gif`),
    filters: [{ name: 'GIF image', extensions: ['gif'] }],
  });
  if (r.canceled || !r.filePath) return { cancelled: true };

  const args = ['convert', req.file, '--output', r.filePath, '--fps', String(req.options.fps)];
  if (req.options.width) args.push('--width', String(req.options.width));
  if (!req.options.loop) args.push('--no-loop');

  const ev = await runBackend(args, {
    onStart: (proc) => { activeJob = proc; },
    onEvent: (event) => {
      if (event.event === 'progress' && !e.sender.isDestroyed()) {
        e.sender.send('video:progress', event.percent);
      }
    },
  });
  activeJob = null;

  if (ev.event === 'convert') return { output: ev.output, size: ev.size };
  if (ev.event === 'cancelled') return { cancelled: true };
  return unexpected(ev);
});

ipcMain.handle('video:cancel', (): void => cancelActiveJob());

ipcMain.handle('file:show', (_e, file: string): void => shell.showItemInFolder(file));

// ---- window ------------------------------------------------------------------

function createWindow(): void {
  win = new BrowserWindow({
    width: 900,
    height: 720,
    minWidth: 680,
    minHeight: 560,
    backgroundColor: '#121212',
    icon: path.join(__dirname, '..', 'assets', process.platform === 'win32' ? 'icon.ico' : 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  win.setMenuBarVisibility(false);
  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));
}

app.whenReady().then(createWindow);
app.on('before-quit', cancelActiveJob);
app.on('window-all-closed', () => app.quit());
