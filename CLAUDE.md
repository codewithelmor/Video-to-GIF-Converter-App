# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A standalone video-to-GIF converter. FFmpeg's two-pass palette technique (`palettegen`, then `paletteuse`) does the work. FFmpeg itself comes from the `imageio-ffmpeg` pip package (a static binary), so the finished app needs nothing installed on the machine. There are no tests and no linter configured.

Two front ends share one Python core:
- CLI: `python backend/cli.py` (interactive prompts)
- Electron + TypeScript desktop app in `app/`, which spawns the Python backend as a subprocess

## Commands

```bash
pip install -r backend/requirements.txt    # imageio-ffmpeg (bundled FFmpeg)
python backend/cli.py                      # interactive CLI

# JSON backend, as the Electron app drives it (one JSON line per event)
python -X utf8 -u backend/backend.py check
python -X utf8 -u backend/backend.py probe <video>
python -X utf8 -u backend/backend.py convert <video> --output <gif> [--fps N] [--width W] [--no-loop]

cd app && npm install && npm start         # dev: compiles TS, launches Electron (needs python on PATH)
cd app && npm run typecheck                # tsc --noEmit; the only static check available

# Full installer (PyInstaller backend + electron-builder); output in app/dist/
powershell -ExecutionPolicy Bypass -File scripts\build-all.ps1 [-Clean]   # Windows
scripts/build-all.sh [--clean]                                            # Linux / macOS
```

PyInstaller cannot cross-compile: each OS must build on itself (`.github/workflows/build.yml` does all three). `build-all.*` runs `build-backend` -> `npm run dist` and writes to the git-ignored `build/` (frozen backend in `build/backend`), which `app/package.json` `extraResources` copies into the package. `build-backend.*` passes `--collect-all imageio_ffmpeg`; that flag is what puts the FFmpeg binary in the installer, and `build-all.*` smoke-tests it with the backend's `check` command.

## Architecture

**`backend/core.py`** holds all logic: `ffmpeg_path` (the `FFMPEG_BINARY` env var, then the bundled binary, then `ffmpeg` on PATH), `probe` (parses `ffmpeg -i` stderr for duration, size and fps; there is no ffprobe), and `convert` (two FFmpeg passes with `-progress pipe:1`; progress maps pass 1 to 0-40% and pass 2 to 40-100%). It writes into a temp directory and moves the GIF into place only when complete. **The core must stay UI-agnostic**: it never prints or prompts, signals bad user data with `ConvertError` and a user cancel with `Cancelled`. Prompts belong in `cli.py`; the JSON-lines protocol belongs in `backend.py`.

**Event contract spans three files.** `backend/backend.py` writes events (`check`, `probe`, `progress`, `convert`, `cancelled`, `error`), `app/src/types.d.ts` types them (`BackendEvent` and the data interfaces), and `app/src/main.ts` and `app/src/renderer/renderer.ts` consume them. Changing an event means updating all of them. `types.d.ts` is deliberately ambient (no imports/exports) so `renderer.ts` compiles to a plain browser script under the CSP in `index.html`; adding an `import`/`export` to the renderer breaks it at runtime (`exports is not defined`).

**Electron process split.** `main.ts` spawns the backend for each request (`python3`/`python backend.py` in dev, `resources/backend/backend[.exe]` when packaged) and returns the last JSON line over IPC; `convert` also forwards `progress` events to the renderer as `video:progress`. Cancelling writes `cancel` to the backend's stdin, which kills FFmpeg and discards the partial output (EOF on stdin is ignored on purpose, so running the backend without a terminal does not cancel). `preload.ts` exposes the `Api` interface as `window.api`, including `webUtils.getPathForFile` for drag and drop. Compiled output goes to `app/out/` (git-ignored); `npm run build` also copies `index.html` and `style.css` there via `scripts/copy-static.js`.

## Gotchas

- Always run the backend with `-X utf8 -u` (unbuffered stdout, UTF-8 file names); Electron also sets `PYTHONIOENCODING`.
- The renderer's CSP allows images from `file:` only so the finished GIF can be previewed; do not add inline styles or scripts.
- The `imageio-ffmpeg` binary is a GPL build; keep the README license note when distributing.
- `appId`/`homepage` in `app/package.json` are placeholders.
- On this repo's Windows setup under Node 26, Electron's postinstall silently fails to extract its binary. `build-all.*` repairs it; for plain `npm start` extract the zip from `%LOCALAPPDATA%\electron\Cache` into `node_modules/electron/dist` and write `electron.exe` to `node_modules/electron/path.txt`.
- Linux/macOS packaging scripts and the CI workflow have not been run yet; only the Windows build was ever verified.
