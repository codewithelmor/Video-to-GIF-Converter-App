// Drives the packaged Video to GIF Converter 1.0.0 like a real user and records the window with FFmpeg gdigrab.
// Usage: node record-j1.mjs [--dry]   (set PW_DIR to a folder that has playwright-core installed)
// Real mouse input, real Windows open/save dialogs, real FFmpeg conversion. Every step is checked.
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const { _electron: electron } = createRequire(path.resolve(process.env.PW_DIR || '.') + '/')('playwright-core');
const here = path.dirname(fileURLToPath(import.meta.url));
const demo = path.resolve(here, '..');
const dry = process.argv.includes('--dry');
const EXE = process.env.GIF_APP_EXE || 'C:/Users/elmorc/source/repos/_Azure-Config-Converter-App/app/dist/win-unpacked/Video to GIF Converter.exe';
const WORK = 'C:/Demo/gif-demo';
const OUT_GIF = 'C:\\Demo\\gif-demo\\output\\sample.gif';
const WIN = { x: 4000, y: 10, width: 1200, height: 1000 };   // third monitor, 100% scaling
const ZOOM = 1.25;
const recDir = path.join(demo, 'recordings', 'j1'); fs.mkdirSync(recDir, { recursive: true });
const shots = path.join(demo, 'thumbnail', 'screenshots'); fs.mkdirSync(shots, { recursive: true });
const durations = JSON.parse(fs.readFileSync(path.join(demo, 'audio', 'durations.json'), 'utf8'));
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const log = []; const L = (m) => { console.log(m); log.push(m); };
const fail = (m) => { L('STEP FAIL: ' + m); throw new Error(m); };

// ---- input helper (real mouse and keyboard, real file dialogs)
const ps = spawn('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', path.join(here, 'input.ps1')], { stdio: ['pipe', 'pipe', 'inherit'] });
let psBuf = ''; const psWait = [];
ps.stdout.on('data', d => { psBuf += d; let i; while ((i = psBuf.indexOf('\n')) >= 0) { const l = psBuf.slice(0, i).trim(); psBuf = psBuf.slice(i + 1); psWait.shift()?.(l); } });
const readyP = new Promise(r => psWait.push(r));
const sendRaw = (cmd) => new Promise(res => { const lines = []; const h = (l) => { if (l === 'ok') res(lines); else { lines.push(l); psWait.push(h); } }; psWait.push(h); ps.stdin.write(cmd + '\n'); });
const inp = {
  move: (x, y, ms = 700) => sendRaw(`move ${Math.round(x)} ${Math.round(y)} ${ms}`), click: () => sendRaw('click'),
  key: (k) => sendRaw('key ' + k), type: (t) => sendRaw('type ' + t),
  winmove: (t, x, y, w, h) => sendRaw(`winmove ${t}|${x}|${y}|${w}|${h}`), winclose: (t) => sendRaw('winclose ' + t),
};
await readyP;

// ---- app
for (const f of fs.readdirSync(`${WORK}/output`)) fs.rmSync(`${WORK}/output/${f}`);
const app = await electron.launch({ executablePath: EXE, args: [`--user-data-dir=${WORK}/userdata`] });
const win = await app.firstWindow();
await app.evaluate(({ BrowserWindow }, o) => { const w = BrowserWindow.getAllWindows()[0]; w.setBounds(o.b); w.setAlwaysOnTop(true); w.focus(); w.webContents.setZoomFactor(o.z); }, { b: WIN, z: ZOOM });
await sleep(800);
const content = await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].getContentBounds());
const version = await app.evaluate(({ app }) => app.getVersion());
L(`app version ${version}, content bounds ${JSON.stringify(content)}`);
const center = async (sel) => {
  const r = await win.locator(sel).evaluate(e => { const b = e.getBoundingClientRect(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; });
  return { x: content.x + r.x * ZOOM, y: content.y + r.y * ZOOM };
};
const realClick = async (sel, ms = 900) => { const c = await center(sel); await inp.move(c.x, c.y, ms); await sleep(150); await inp.click(); };

// ---- recording
let ff = null, t0 = 0;
if (!dry) {
  const raw = path.join(recDir, 'raw.mp4');
  ff = spawn('ffmpeg', ['-y', '-f', 'gdigrab', '-framerate', '30', '-draw_mouse', '1', '-offset_x', String(WIN.x), '-offset_y', String(WIN.y),
    '-video_size', `${WIN.width}x${WIN.height}`, '-i', 'desktop', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '16', '-pix_fmt', 'yuv420p', raw],
    { stdio: ['pipe', 'ignore', 'pipe'] });
  await new Promise((res, rej) => { ff.stderr.on('data', d => { if (!t0 && /frame=\s*\d+/.test(String(d))) { t0 = Date.now(); res(); } }); ff.on('exit', () => rej(new Error('ffmpeg exited'))); });
} else t0 = Date.now();
const now = () => (Date.now() - t0) / 1000;
const markers = []; let cur = null;
const sceneStart = (id) => { if (cur) cur.end = +now().toFixed(2); cur = { id, start: +now().toFixed(2), minSeconds: +(durations[id] + 1.3).toFixed(2) }; markers.push(cur); L(`scene ${id} @ ${cur.start}s`); };
const sceneHold = async () => { const need = cur.start + cur.minSeconds - now(); if (need > 0) await sleep(need * 1000); };
let exitCode = 0;
try {
  // s01 app open
  sceneStart('s01');
  if (!(await win.getByRole('heading', { name: 'Video to GIF Converter' }).isVisible())) fail('heading not visible');
  await win.screenshot({ path: path.join(shots, '01-start.png') });
  L('PASS step 1: app open, heading visible');
  await inp.move(content.x + 700, content.y + 560, 600);
  await sceneHold();

  // s02 choose video through the real Open dialog
  sceneStart('s02');
  await realClick('#pickBtn');
  await sleep(2200);                      // dialog opens in the demo input folder; hold so viewers see it
  await inp.type('sample.mp4'); await sleep(500); await inp.key('{ENTER}');
  await win.locator('#videoSection').waitFor({ state: 'visible', timeout: 15000 });
  const name = await win.locator('#fileName').innerText();
  if (name !== 'sample.mp4') fail('file name ' + name);
  L('PASS step 2: video chosen: ' + name);
  await sceneHold();

  // s03 info
  sceneStart('s03');
  const info = await win.locator('#videoInfo').innerText();
  if (!/1920×1080/.test(info)) fail('info ' + info);
  L('PASS step 3: info line: ' + info);
  await win.screenshot({ path: path.join(shots, '02-info.png') });
  await sceneHold();

  // s04 options
  sceneStart('s04');
  await realClick('#fps', 1000); await win.locator('#fps').press('Control+a'); await win.keyboard.type('12', { delay: 160 });
  await sleep(500);
  await realClick('#width', 900); await win.locator('#width').press('Control+a'); await win.keyboard.type('480', { delay: 160 });
  if ((await win.locator('#fps').inputValue()) !== '12' || (await win.locator('#width').inputValue()) !== '480') fail('option values');
  if (!(await win.locator('#loop').isChecked())) fail('loop not checked');
  L('PASS step 4: FPS 12, width 480, loop on');
  await win.screenshot({ path: path.join(shots, '03-options.png') });
  await sceneHold();

  // s05 convert and save through the real Save dialog
  sceneStart('s05');
  await realClick('#convertBtn', 1000);
  await sleep(2000);                       // Save dialog visible
  await inp.key('^a'); await inp.type(OUT_GIF);
  const toEnter = cur.start + 4.3 - now(); if (toEnter > 0) await sleep(toEnter * 1000);   // press Save as the voice mentions the progress bar
  await inp.key('{ENTER}');
  const t1 = Date.now(); const seen = []; let progressSeen = false;
  while (Date.now() - t1 < 60000) {
    if (await win.locator('#progressBox').isVisible()) {
      progressSeen = true; seen.push(await win.locator('#progressText').innerText());
      if (seen.length === 3) await win.screenshot({ path: path.join(shots, '04-progress.png') });
    }
    if (await win.locator('#result').isVisible()) break;
    await sleep(60);
  }
  L(`conversion took ${((Date.now() - t1) / 1000).toFixed(1)}s; progress texts seen: ${seen.join(',') || 'none'}`);
  if (!(await win.locator('#result').isVisible())) fail('result never appeared');
  if (!progressSeen) L('NOTE: progress bar was not observed (conversion too fast)');
  L('PASS step 5: conversion finished, result visible');
  await sceneHold();

  // s06 preview
  sceneStart('s06');
  await win.evaluate(() => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'smooth' }));
  await win.waitForFunction(() => { const i = document.getElementById('resultImg'); return i.complete && i.naturalWidth > 0; }, null, { timeout: 10000 });
  const nat = await win.locator('#resultImg').evaluate(i => [i.naturalWidth, i.naturalHeight]);
  const rtext = await win.locator('#resultText').innerText();
  if (nat[0] !== 480) fail('gif width ' + nat);
  if (!fs.existsSync(OUT_GIF)) fail('gif file missing');
  L(`PASS step 6: preview loaded ${nat.join('x')}; "${rtext}"`);
  await win.screenshot({ path: path.join(shots, '05-result.png') });
  await sceneHold();

  // s07 show in folder (opens a real Explorer window)
  sceneStart('s07');
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setAlwaysOnTop(false));   // let Explorer appear above the app
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setAlwaysOnTop(false));   // let Explorer appear above the app
  await realClick('#showBtn', 1000);
  let moved = [];
  for (let i = 0; i < 20 && !moved.includes('moved'); i++) { await sleep(400); moved = await inp.winmove('output - File Explorer', WIN.x + 100, WIN.y + 260, 1000, 600); }
  if (!moved.includes('moved')) fail('Explorer window "output" did not open');
  L('PASS step 7: Explorer opened on the output folder');
  await sceneHold();

  // s08 wrap up
  sceneStart('s08');
  await sceneHold();
  cur.end = +now().toFixed(2);
} catch (e) { exitCode = 1; L('ERROR ' + e.message); }
finally {
  if (ff) { ff.stdin.write('q'); await new Promise(r => ff.on('exit', r)); }
  await inp.winclose('output - File Explorer').catch(() => {});
  await sleep(500);
  await app.close().catch(() => {});
  ps.kill();
  if (!dry) fs.writeFileSync(path.join(recDir, 'markers.json'), JSON.stringify({ clock: 'seconds since first captured frame', scenes: markers }, null, 1));
  fs.writeFileSync(path.join(recDir, dry ? 'run-dry.log' : 'run.log'), log.join('\n') + `\n${exitCode ? 'JOURNEY FAIL' : 'JOURNEY PASS'}\n`);
  console.log(exitCode ? 'JOURNEY FAIL' : 'JOURNEY PASS');
  process.exit(exitCode);
}
