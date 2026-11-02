# Demo quality check

Video: `docs/product/10-launch/demo/exports/video-to-gif-converter-demo-v1.0.0.mp4` | SHA-256: `bf475ef6b1fdbd982ac69d35a92b5d5425b20acd2d0226bb9931ee4d92cc2474` | App version: 1.0.0 (packaged win-unpacked build, `app.getVersion()` = 1.0.0) | Checked: 2026-11-02

Automated: `check_video.py` PASS (0 High, 1 warning). Visual review: all 3 contact sheets (`exports/qc-frames/`) read.

| # | Check | Sev | Result | Notes |
|---|---|---|---|---|
| 1 | Journey J1 shown start to finish | High | PASS | Open, choose, info, FPS 12, width 480, convert and save, preview, Show in folder. 7/7 steps PASS in `recordings/j1/run.log` |
| 2 | Result visible at least 1.5 s | High | PASS | GIF preview held ~7 s, Explorer ~11 s |
| 3 | No failed/skipped/hidden steps, no error dialogs | High | PASS | |
| 4 | No private data | High | PASS | Paths are C:\Demo\gif-demo\...; no user name, machine name, Downloads or repo path in any frame (Open, Save As, Explorer reviewed). Sample clip contains only the word "Testing" |
| 5 | No notifications, other apps | High | PASS | Window region only, nothing else captured |
| 6 | Captions (.srt, .vtt) present, timed | High | PASS | 17 cues, no overlaps, end before video end |
| 7 | Version on cards matches build | High | PASS | 1.0.0 on title and end card |
| 8 | H.264 High, yuv420p, AAC 48 kHz, faststart | High | PASS | |
| 9 | 1920x1080 / 30 fps | Med | PASS | |
| 10 | Length within plan | Med | PASS | 74.7 s (plan about 75 s) |
| 11 | Loudness / true peak | Med | PASS | -16.3 LUFS, -1.5 dBTP |
| 12 | Voice matches screen | Med | PASS | Narration placed at scene markers from the real run; dialogs and results line up with the sentences on the contact sheets |
| 13 | Pacing | Med | PASS with note | Narration ~164 wpm while speaking, ~130 wpm overall. First 10 s and some holds are still screens while the voice talks |
| 14 | No long black or frozen parts | Med | WARN (accepted) | Still screens occur only under narration or on the cards |
| 15 | Branding consistent | Low | PASS | |
| 16 | Card text true; AI voice disclosed | Med | PASS | End card: "Narration: AI-generated voice" |
| 17 | Music | High | PASS | None |

Notes (not failures):
- The progress bar is on screen only about 0.8 s (the 6.4 s clip converts that fast) and is partly behind the Save dialog at 0%. The narration says it "shows while it works", which is accurate, but the viewer sees it briefly.
- The window is shown at 1.25x zoom inside the 1920x1080 frame with side bars; text is readable but not large.

**Result:** Pass
