# Demo plan: Video to GIF Converter 1.0.0

Date: 2026-11-02 | Owner: repo owner | Status: Draft (user-authorized production run; not yet approved for publishing)

## Goal

- **Type:** Quick overview
- **Target length:** about 1:15 (45-90 s)
- **Audience:** colleagues and anyone who needs a small GIF from a screen recording
- **After watching, they should:** install the app and convert a clip
- **Shared on:** not decided (README / internal share). No upload without approval.

## Story

| Part | What we say | What we show | Seconds |
|---|---|---|---|
| Problem | Need a quick GIF from a screen recording? | App open, drop zone | 11 |
| Solution | Choose a video, set FPS and width, Convert & save | Journey J1: choose video, options, convert | 35 |
| Result | The GIF plays in the app; Show in folder | Result preview, Explorer | 16 |
| Call to action | Pick a video, choose two numbers | End card | 8 |

## Journeys

- J1 Convert a video to a GIF (choose, info, FPS 12, width 480, Convert & save, progress, preview, Show in folder).

## Production settings

- App type and driver: Electron (packaged build 1.0.0, win-unpacked). Playwright for Electron drives the page; real mouse input and the real Windows file dialogs are used. Screen capture by FFmpeg gdigrab of the app window region.
- Resolution / fps: 1920x1080 / 30 (window captured at 1600x1000, scaled and padded)
- Vertical cut: no
- Voice-over: local-free option is not used; cloud neural TTS via edge-tts 7.3.1, voice en-US-AndrewNeural (American male, stock voice, no cloning)
- AI voice disclosure: "Narration: AI-generated voice" on the end card
- Music: none
- Branding: app's own dark theme and blue accent (#4a86ff style); cards use the same dark palette
- Captions: .srt + .vtt

## Safe data

- Sample input: user-supplied 6.4 s Notepad++ clip, copied to C:\Demo\gif-demo\input\sample.mp4 (original untouched; frames checked, no private data).
- App user-data folder redirected to C:\Demo\gif-demo\userdata so no user-profile paths appear in file dialogs.

## Out of scope

- Cancel button, drag and drop, loop-once option: exist per README but are not shown, so the script does not claim them.
