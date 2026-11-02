const $ = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T;

const drop = $<HTMLElement>('drop');
const pickBtn = $<HTMLButtonElement>('pickBtn');
const message = $<HTMLParagraphElement>('message');
const videoSection = $<HTMLElement>('videoSection');
const fileName = $<HTMLElement>('fileName');
const videoInfo = $<HTMLElement>('videoInfo');
const fpsInput = $<HTMLInputElement>('fps');
const widthInput = $<HTMLInputElement>('width');
const loopInput = $<HTMLInputElement>('loop');
const convertBtn = $<HTMLButtonElement>('convertBtn');
const cancelBtn = $<HTMLButtonElement>('cancelBtn');
const progressBox = $<HTMLElement>('progressBox');
const progress = $<HTMLProgressElement>('progress');
const progressText = $<HTMLElement>('progressText');
const result = $<HTMLElement>('result');
const resultText = $<HTMLElement>('resultText');
const resultImg = $<HTMLImageElement>('resultImg');
const showBtn = $<HTMLButtonElement>('showBtn');

let settings: Settings = { folder: '' };
let video: VideoInfo | null = null;
let output: string | null = null;
let busy = false;

// ---- helpers -----------------------------------------------------------------

function showMessage(text: string | null): void {
  message.hidden = !text;
  message.textContent = text ?? '';
}

function formatSize(bytes: number): string {
  if (bytes >= 1_048_576) return `${(bytes / 1_048_576).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return m > 0 ? `${m}m ${s}s` : `${seconds.toFixed(1)}s`;
}

function describe(v: VideoInfo): string {
  const parts = [`${v.width}×${v.height}`];
  if (v.fps) parts.push(`${Math.round(v.fps * 100) / 100} fps`);
  if (v.duration !== null) parts.push(formatDuration(v.duration));
  parts.push(formatSize(v.size));
  return parts.join(' · ');
}

function fileUrl(file: string): string {
  const segments = file.replace(/\\/g, '/').replace(/^\/+/, '').split('/');
  return 'file:///' + segments.map((s) => (/^[A-Za-z]:$/.test(s) ? s : encodeURIComponent(s))).join('/');
}

function setBusy(on: boolean): void {
  busy = on;
  convertBtn.disabled = on;
  pickBtn.disabled = on;
  fpsInput.disabled = on;
  widthInput.disabled = on;
  loopInput.disabled = on;
  cancelBtn.hidden = !on;
  progressBox.hidden = !on;
}

function setProgress(percent: number): void {
  progress.value = percent;
  progressText.textContent = `${percent}%`;
}

// ---- choosing a video ----------------------------------------------------------

async function loadVideo(file: string): Promise<void> {
  showMessage(null);
  result.hidden = true;
  const info = await window.api.probe(file);
  if (info.error !== undefined) {
    showMessage(info.error);
    return;
  }
  video = info;
  fileName.textContent = info.name;
  fileName.title = info.path;
  videoInfo.textContent = describe(info);
  videoSection.hidden = false;
  // Never offer a GIF wider than the source.
  widthInput.max = String(info.width);

  const folder = info.path.replace(/[\\/][^\\/]*$/, '');
  if (folder && folder !== settings.folder) {
    settings.folder = folder;
    void window.api.saveSettings(settings);
  }
}

async function pickVideo(): Promise<void> {
  if (busy) return;
  const file = await window.api.pickVideo(settings.folder);
  if (file) await loadVideo(file);
}

pickBtn.addEventListener('click', (e) => { e.stopPropagation(); void pickVideo(); });
drop.addEventListener('click', () => void pickVideo());
drop.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); void pickVideo(); }
});

// Drag and drop anywhere on the window.
window.addEventListener('dragover', (e) => { e.preventDefault(); drop.classList.add('over'); });
window.addEventListener('dragleave', (e) => {
  if (e.relatedTarget === null) drop.classList.remove('over');
});
window.addEventListener('drop', (e) => {
  e.preventDefault();
  drop.classList.remove('over');
  const file = e.dataTransfer?.files[0];
  if (file && !busy) void loadVideo(window.api.pathForFile(file));
});

// ---- converting ----------------------------------------------------------------

function readOptions(): ConvertOptions | string {
  const fps = Number(fpsInput.value);
  if (!Number.isInteger(fps) || fps < 1 || fps > 60) return 'FPS must be a whole number from 1 to 60.';
  let width: number | null = null;
  if (widthInput.value.trim() !== '') {
    width = Number(widthInput.value);
    if (!Number.isInteger(width) || width < 16 || width > 7680) {
      return 'Width must be a whole number from 16 to 7680, or empty for the original.';
    }
  }
  return { fps, width, loop: loopInput.checked };
}

convertBtn.addEventListener('click', async () => {
  if (!video || busy) return;
  const options = readOptions();
  if (typeof options === 'string') {
    showMessage(options);
    return;
  }
  showMessage(null);
  result.hidden = true;
  setProgress(0);
  setBusy(true);
  const stop = window.api.onProgress(setProgress);
  try {
    const r = await window.api.convert({ file: video.path, options });
    if ('error' in r) {
      showMessage(r.error);
    } else if ('output' in r) {
      output = r.output;
      resultText.textContent = `Saved ${r.output} (${formatSize(r.size)})`;
      resultImg.src = `${fileUrl(r.output)}?t=${Date.now()}`;
      result.hidden = false;
    }
    // A cancelled conversion (or a cancelled save dialog) needs no message.
  } finally {
    stop();
    setBusy(false);
  }
});

cancelBtn.addEventListener('click', () => {
  cancelBtn.disabled = true;
  void window.api.cancel().finally(() => { cancelBtn.disabled = false; });
});

showBtn.addEventListener('click', () => { if (output) void window.api.showInFolder(output); });

void window.api.getSettings().then((s) => { settings = s; });
