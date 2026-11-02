"""
JSON-lines front end for the Electron app. Every line on stdout is one JSON event:
  check                                          {"event": "check", "ffmpeg": "<version line>"}
  probe <file>                                   {"event": "probe", ...video info}
  convert <file> --output P [--fps N] [--width W] [--no-loop]
                                                 {"event": "progress", "percent"} (many), then
                                                 {"event": "convert", "output", "size"}
  any failure                                    {"event": "error", "message"}   (exit code 1)
  cancelled                                      {"event": "cancelled"}          (exit code 1)

While converting, the line "cancel" on stdin stops FFmpeg and discards the partial output.
"""

import argparse
import json
import sys
import threading

import core


def send(event, **data):
    sys.stdout.write(json.dumps({"event": event, **data}, ensure_ascii=False) + "\n")
    sys.stdout.flush()


def build_parser():
    parser = argparse.ArgumentParser(
        description="Video to GIF backend (JSON lines on stdout)"
    )
    commands = parser.add_subparsers(dest="command", required=True)

    commands.add_parser("check", help="verify the bundled FFmpeg runs")

    probe = commands.add_parser(
        "probe", help="read duration, size and frame rate of a video"
    )
    probe.add_argument("file")

    convert = commands.add_parser("convert", help="convert a video to a GIF")
    convert.add_argument("file")
    convert.add_argument("--output", help="GIF path (default: next to the video)")
    convert.add_argument("--fps", default=core.DEFAULT_FPS)
    convert.add_argument(
        "--width", default=None, help="width in pixels (default: original)"
    )
    convert.add_argument("--no-loop", action="store_true", help="play the GIF once")
    return parser


def watch_stdin_for_cancel(cancel):
    """Sets `cancel` when the parent sends a 'cancel' line (EOF is ignored)."""

    def run():
        for line in sys.stdin:
            if line.strip() == "cancel":
                cancel.set()
                return

    threading.Thread(target=run, daemon=True).start()


def main():
    args = build_parser().parse_args()
    for stream in (sys.stdout, sys.stdin):
        if hasattr(stream, "reconfigure"):
            stream.reconfigure(encoding="utf-8")

    try:
        if args.command == "check":
            send("check", ffmpeg=core.ffmpeg_version())
        elif args.command == "probe":
            send("probe", **core.probe(args.file))
        else:
            cancel = threading.Event()
            watch_stdin_for_cancel(cancel)
            last = [-1]

            def on_progress(percent):
                whole = int(percent)
                if whole != last[0]:  # at most one event per percent
                    last[0] = whole
                    send("progress", percent=whole)

            result = core.convert(
                args.file,
                args.output,
                fps=args.fps,
                width=args.width,
                loop=not args.no_loop,
                on_progress=on_progress,
                cancel=cancel,
            )
            send("convert", **result)
    except core.Cancelled:
        send("cancelled")
        return 1
    except (core.ConvertError, OSError) as e:
        send("error", message=str(e))
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
