// Render a title card, end card, or thumbnail as PNG from simple HTML with Playwright.
// Copy next to a folder that has the "playwright" package installed.
// Usage:
//   node render-card.mjs --out title.png --size 1920x1080 --title "Items" --subtitle "Track stock in seconds"
//        [--footer "v1.0.0"] [--bg screenshot.png] [--accent "#0d6efd"] [--dark "#0f172a"]
import { createRequire } from 'node:module'; import path from 'node:path';
const { chromium } = createRequire(path.resolve(process.env.PW_DIR || '.') + '/')('playwright-core');
import { readFileSync } from 'node:fs';
import { extname } from 'node:path';

const args = Object.fromEntries(process.argv.slice(2).reduce((acc, v, i, a) =>
  (v.startsWith('--') ? [...acc, [v.slice(2), a[i + 1]]] : acc), []));
if (!args.out || !args.title) { console.error('Need --out and --title'); process.exit(1); }
const [w, h] = (args.size ?? '1920x1080').split('x').map(Number);
const accent = args.accent ?? '#0d6efd';
const dark = args.dark ?? '#0f172a';
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
let bg = '';
if (args.bg) {
  const mime = extname(args.bg).toLowerCase() === '.jpg' ? 'image/jpeg' : 'image/png';
  bg = `data:${mime};base64,${readFileSync(args.bg).toString('base64')}`;
}
const scale = w / 1920;
const html = `<!doctype html><html><head><meta charset="utf-8"><style>
  *{margin:0;box-sizing:border-box} body{width:${w}px;height:${h}px;overflow:hidden;font-family:"Segoe UI",system-ui,sans-serif;background:${dark};color:#fff}
  .shot{position:absolute;right:${-80 * scale}px;top:${120 * scale}px;width:${1150 * scale}px;border-radius:${18 * scale}px;
        box-shadow:0 ${20 * scale}px ${60 * scale}px rgba(0,0,0,.55);border:${2 * scale}px solid rgba(255,255,255,.15)}
  .text{position:absolute;left:${110 * scale}px;top:50%;transform:translateY(-50%);width:${bg ? 760 * scale : w - 220 * scale}px}
  .bar{width:${90 * scale}px;height:${10 * scale}px;background:${accent};border-radius:${5 * scale}px;margin-bottom:${36 * scale}px}
  h1{font-size:${(bg ? 96 : 120) * scale}px;line-height:1.05;font-weight:700;letter-spacing:-.02em}
  p{font-size:${44 * scale}px;line-height:1.3;margin-top:${28 * scale}px;color:#cbd5e1}
  footer{position:absolute;left:${110 * scale}px;bottom:${70 * scale}px;font-size:${30 * scale}px;color:#94a3b8}
</style></head><body>
  ${bg ? `<img class="shot" src="${bg}" alt="">` : ''}
  <div class="text"><div class="bar"></div><h1>${esc(args.title)}</h1>${args.subtitle ? `<p>${esc(args.subtitle)}</p>` : ''}</div>
  ${args.footer ? `<footer>${esc(args.footer)}</footer>` : ''}
</body></html>`;

const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage({ viewport: { width: w, height: h } });
await page.setContent(html, { waitUntil: 'load' });
await page.screenshot({ path: args.out });
await browser.close();
console.log(`Wrote ${args.out} (${w}x${h})`);
