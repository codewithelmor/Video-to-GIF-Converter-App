"""Interactive command-line front end (the original script's prompts, now on top of core)."""

import os
import sys

import core


def ask(prompt, default=""):
    return input(prompt).strip() or default


def main():
    print("=== Video to GIF Converter (FFmpeg) ===")

    source = ask(
        "Enter input video filename (leave blank to use the first video in this folder): "
    )
    if not source:
        videos = sorted(
            f for f in os.listdir(".") if f.lower().endswith(core.VIDEO_EXTENSIONS)
        )
        if not videos:
            print("No video file found in this directory.")
            return 1
        source = videos[0]
        print(f"Using first video found: {source}")

    output = ask(
        "Enter output GIF filename (leave blank for auto name): ",
        core.default_output(source),
    )
    fps = ask(
        f"Enter FPS (default {core.DEFAULT_FPS} | 10-15 recommended, lower = smaller file): "
    )
    width = ask(
        "Enter width (leave blank to keep original size | 480-800 recommended): "
    )

    last = [-1]

    def show(percent):
        if int(percent) // 10 != last[0]:
            last[0] = int(percent) // 10
            print(f"  {int(percent)}%")

    try:
        result = core.convert(
            source,
            output,
            fps=fps or core.DEFAULT_FPS,
            width=width or None,
            on_progress=show,
        )
    except core.ConvertError as e:
        print(f"ERROR: {e}")
        return 1
    print(
        f"\nDone! Output saved as {result['output']} ({result['size'] / 1_048_576:.1f} MB)"
    )
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except KeyboardInterrupt:
        print("\nOperation cancelled by user.")
        sys.exit(1)
