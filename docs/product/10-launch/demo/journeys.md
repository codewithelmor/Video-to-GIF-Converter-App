# Journeys

## J1 Convert a video to a GIF
| # | Step | Check |
|---|---|---|
| 1 | App starts | heading "Video to GIF Converter" visible |
| 2 | Click Choose video..., select sample.mp4 in the Open dialog | file name and info line visible |
| 3 | Set FPS 12 and Width 480 | input values equal 12 and 480 |
| 4 | Click Convert & save..., save as sample.gif in the output folder | progress visible, then result visible |
| 5 | GIF preview loads | img naturalWidth = 480 |
| 6 | Click Show in folder | Explorer window opens on the output folder |
Result: C:\Demo\gif-demo\output\sample.gif exists, valid GIF 480 px wide.
