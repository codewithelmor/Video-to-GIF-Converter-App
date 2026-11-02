# Video to GIF Converter

Turn a video into a high-quality GIF with a desktop app or the command line. It uses FFmpeg's two-pass palette technique (`palettegen` + `paletteuse`) to avoid the banding of a default GIF encode. **Everything is bundled**: the installer contains the app, its Python backend and FFmpeg, so there is nothing to install and no network access is needed.

## Features

- **Drag and drop** a video (or choose one): `.mp4`, `.mkv`, `.mov`, `.avi`, `.webm`, `.m4v`, `.wmv`, `.flv`, `.mpg`, `.ts`, `.3gp`.
- **Frame rate and width** controls; the height follows automatically. A GIF is never scaled wider than its source.
- **Loop forever** or play once.
- **Live progress** with a Cancel button; a cancelled or failed conversion leaves no partial file.
- **Preview** of the finished GIF and a *Show in folder* button.
- **Standalone installer** for Windows, Linux and macOS.

## Usage

### Desktop app

Drop a video on the window, set the FPS and width (10-15 FPS and 480-800 px keep files small), and click **Convert & save…**.

### Command line

```bash
pip install -r backend/requirements.txt
python backend/cli.py
```

You are asked for the input video (Enter = first video in the current folder), output name, FPS and width.

### JSON backend

This is how the Electron app drives Python. Always run it with `-X utf8 -u`.

```bash
python -X utf8 -u backend/backend.py check                      # verify the bundled FFmpeg runs
python -X utf8 -u backend/backend.py probe <video>
python -X utf8 -u backend/backend.py convert <video> --output out.gif [--fps 10] [--width 480] [--no-loop]
```

## Development

| Requirement | Notes |
|---|---|
| Python 3.10+ | Runs the backend; `pip install -r backend/requirements.txt` (pulls in the bundled FFmpeg) |
| Node.js | Only for developing or packaging the desktop app |

```bash
cd app
npm install
npm start          # compiles TypeScript and launches Electron (needs python on PATH)
npm run typecheck
```

## Building Installers

PyInstaller cannot cross-compile, so build on the OS you are targeting. The build freezes the backend together with FFmpeg and checks that the packaged FFmpeg runs.

| OS | Command | Output in `app/dist/` |
|----|---------|-----------------------|
| Windows | `powershell -ExecutionPolicy Bypass -File scripts\build-all.ps1` | `*Setup*.exe` |
| Linux | `scripts/build-all.sh` | `*.AppImage`, `*.deb` |
| macOS | `scripts/build-all.sh` | `*.dmg` |

Add `-Clean` / `--clean` for a fresh build. Builds are unsigned.

## Licenses

The FFmpeg binary comes from the [`imageio-ffmpeg`](https://github.com/imageio/imageio-ffmpeg) package, which ships GPL-licensed static builds. If you distribute the installer, comply with FFmpeg's license terms.

## Project Structure

```text
_Azure-Config-Converter-App/
├── .agents
│   └── skills
│       ├── app-icon-restyle
│       │   ├── scripts
│       │   │   └── export_icons.py
│       │   └── SKILL.md
│       └── skill-creator
│           ├── agents
│           │   ├── analyzer.md
│           │   ├── comparator.md
│           │   └── grader.md
│           ├── assets
│           │   └── eval_review.html
│           ├── eval-viewer
│           │   ├── generate_review.py
│           │   └── viewer.html
│           ├── references
│           │   └── schemas.md
│           ├── scripts
│           │   ├── __init__.py
│           │   ├── aggregate_benchmark.py
│           │   ├── generate_report.py
│           │   ├── improve_description.py
│           │   ├── package_skill.py
│           │   ├── quick_validate.py
│           │   ├── run_eval.py
│           │   ├── run_loop.py
│           │   └── utils.py
│           ├── LICENSE.txt
│           └── SKILL.md
├── .claude
│   ├── commands
│   │   └── commit.md
│   ├── skills
│   │   ├── app-icon-restyle
│   │   │   ├── scripts
│   │   │   │   └── export_icons.py
│   │   │   └── SKILL.md
│   │   └── skill-creator
│   │       ├── agents
│   │       │   ├── analyzer.md
│   │       │   ├── comparator.md
│   │       │   └── grader.md
│   │       ├── assets
│   │       │   └── eval_review.html
│   │       ├── eval-viewer
│   │       │   ├── generate_review.py
│   │       │   └── viewer.html
│   │       ├── references
│   │       │   └── schemas.md
│   │       ├── scripts
│   │       │   ├── __init__.py
│   │       │   ├── aggregate_benchmark.py
│   │       │   ├── generate_report.py
│   │       │   ├── improve_description.py
│   │       │   ├── package_skill.py
│   │       │   ├── quick_validate.py
│   │       │   ├── run_eval.py
│   │       │   ├── run_loop.py
│   │       │   └── utils.py
│   │       ├── LICENSE.txt
│   │       └── SKILL.md
│   └── settings.json
├── .github
│   └── workflows
│       └── build.yml
├── app
│   ├── assets
│   │   ├── icons
│   │   │   ├── 128x128.png
│   │   │   ├── 16x16.png
│   │   │   ├── 256x256.png
│   │   │   ├── 32x32.png
│   │   │   ├── 48x48.png
│   │   │   ├── 512x512.png
│   │   │   └── 64x64.png
│   │   ├── icon.ico
│   │   └── icon.png
│   ├── scripts
│   │   └── copy-static.js
│   ├── src
│   │   ├── renderer
│   │   │   ├── index.html
│   │   │   ├── renderer.ts
│   │   │   └── style.css
│   │   ├── main.ts
│   │   ├── preload.ts
│   │   └── types.d.ts
│   ├── package-lock.json
│   ├── package.json
│   └── tsconfig.json
├── backend
│   ├── backend.py
│   ├── cli.py
│   ├── core.py
│   └── requirements.txt
├── scripts
│   ├── build-all.ps1
│   ├── build-all.sh
│   ├── build-backend.ps1
│   ├── build-backend.sh
│   └── update_readme_tree.py
├── .gitattributes
├── .gitignore
├── CLAUDE.md
├── README.md
└── skills-lock.json
```
