"""
Video -> GIF conversion on top of FFmpeg. UI-agnostic: it never prints or prompts.
Bad user input is signalled with ConvertError, a user cancel with Cancelled.

FFmpeg comes from the bundled `imageio-ffmpeg` package (a static binary), so the app needs
nothing installed on the machine. The FFMPEG_BINARY environment variable overrides it, and
a system `ffmpeg` on PATH is the last resort.
"""

import os
import re
import shutil
import subprocess
import tempfile
import threading

VIDEO_EXTENSIONS = (
    ".mp4",
    ".mkv",
    ".mov",
    ".avi",
    ".webm",
    ".m4v",
    ".wmv",
    ".flv",
    ".mpg",
    ".mpeg",
    ".ts",
    ".3gp",
)

DEFAULT_FPS = 10
MAX_FPS = 60
MAX_WIDTH = 7680

_CREATE_NO_WINDOW = 0x08000000  # keeps a console window from flashing on Windows


class ConvertError(Exception):
    """Bad user data or an FFmpeg failure; the message is safe to show to the user."""


class Cancelled(Exception):
    """The conversion was cancelled by the caller."""


# ---- locating FFmpeg ---------------------------------------------------------


def _bundled_ffmpeg():
    try:
        import imageio_ffmpeg

        exe = imageio_ffmpeg.get_ffmpeg_exe()
    except (ImportError, RuntimeError, OSError):  # package missing or no binary for this OS
        return None
    return exe if exe and os.path.isfile(exe) else None


def ffmpeg_path():
    override = os.environ.get("FFMPEG_BINARY")
    if override and os.path.isfile(override):
        return override
    exe = _bundled_ffmpeg()
    if exe:
        return exe
    found = shutil.which("ffmpeg")
    if found:
        return found
    raise ConvertError(
        "FFmpeg was not found. Reinstall the app, or install FFmpeg and add it to PATH."
    )


def ffmpeg_version():
    """First line of `ffmpeg -version`; proves the bundled binary actually runs."""
    proc = subprocess.run(
        [ffmpeg_path(), "-version"],
        check=False,
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
        creationflags=_CREATE_NO_WINDOW if os.name == "nt" else 0,
    )
    first = proc.stdout.splitlines()[0] if proc.stdout else ""
    if proc.returncode != 0 or not first:
        raise ConvertError("The FFmpeg binary could not be run.")
    return first


# ---- probing -----------------------------------------------------------------

_DURATION = re.compile(r"Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)")
_VIDEO_STREAM = re.compile(r"Stream #\S+.*?: Video: .*?[,\s](\d{2,5})x(\d{2,5})")
_FPS = re.compile(r"(\d+(?:\.\d+)?)\s+fps")


def _check_input(path):
    if not path or not os.path.isfile(path):
        raise ConvertError(f"File not found: {path}")


def probe(path):
    """Reads duration, size and frame rate of a video. Raises ConvertError if it is not a video."""
    _check_input(path)
    proc = subprocess.run(
        [ffmpeg_path(), "-hide_banner", "-i", path],
        check=False,
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
        creationflags=_CREATE_NO_WINDOW if os.name == "nt" else 0,
    )
    info = (
        proc.stderr
    )  # `ffmpeg -i` without an output always exits 1 after printing the info
    stream = _VIDEO_STREAM.search(info)
    if not stream:
        raise ConvertError("This file has no video stream FFmpeg can read.")

    duration = None
    m = _DURATION.search(info)
    if m:
        duration = int(m.group(1)) * 3600 + int(m.group(2)) * 60 + float(m.group(3))

    fps = None
    m = _FPS.search(info[stream.start() :].split("\n", 1)[0])
    if m:
        fps = float(m.group(1))

    return {
        "name": os.path.basename(path),
        "path": os.path.abspath(path),
        "duration": duration,
        "width": int(stream.group(1)),
        "height": int(stream.group(2)),
        "fps": fps,
        "size": os.path.getsize(path),
    }


def default_output(path):
    return os.path.splitext(os.path.abspath(path))[0] + ".gif"


# ---- converting --------------------------------------------------------------


def _filters(fps, width):
    chain = f"fps={fps}"
    if width:
        # never upscale: a GIF wider than the source only grows the file
        chain += f",scale='min({width},iw)':-1:flags=lanczos"
    return chain


def _clean_options(fps, width):
    try:
        fps = int(fps) if fps not in (None, "") else DEFAULT_FPS
        width = int(width) if width not in (None, "", 0) else None
    except (TypeError, ValueError):
        raise ConvertError("FPS and width must be whole numbers.")
    if not 1 <= fps <= MAX_FPS:
        raise ConvertError(f"FPS must be between 1 and {MAX_FPS}.")
    if width is not None and not 16 <= width <= MAX_WIDTH:
        raise ConvertError(f"Width must be between 16 and {MAX_WIDTH} pixels.")
    return fps, width


def _run_ffmpeg(args, duration, stage_start, stage_span, on_progress, cancel):
    """Runs one FFmpeg pass, reporting progress as stage_start..stage_start+stage_span percent."""
    proc = subprocess.Popen(
        [
            ffmpeg_path(),
            "-hide_banner",
            "-nostdin",
            "-loglevel",
            "error",
            "-nostats",
            "-progress",
            "pipe:1",
            *args,
        ],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        encoding="utf-8",
        errors="replace",
        creationflags=_CREATE_NO_WINDOW if os.name == "nt" else 0,
    )
    errors = []
    # Drain stderr on a thread so a full pipe can never stall FFmpeg.
    reader = threading.Thread(target=lambda: errors.extend(proc.stderr), daemon=True)
    reader.start()

    # Lets another thread (the cancel signal) stop FFmpeg while we block on its stdout.
    stop = threading.Event()

    def watch():
        while not stop.wait(0.1):
            if cancel is not None and cancel.is_set():
                proc.kill()
                return

    threading.Thread(target=watch, daemon=True).start()

    try:
        for line in proc.stdout:
            key, _, value = line.strip().partition("=")
            if (
                key in ("out_time_us", "out_time_ms")
                and duration
                and value.lstrip("-").isdigit()
            ):
                done = min(max(int(value) / 1_000_000 / duration, 0.0), 1.0)
                on_progress(stage_start + done * stage_span)
        code = proc.wait()
    finally:
        stop.set()
        if proc.poll() is None:
            proc.kill()
        reader.join(timeout=2)

    if cancel is not None and cancel.is_set():
        raise Cancelled()
    if code != 0:
        detail = "".join(errors).strip().splitlines()
        raise ConvertError(
            "FFmpeg failed: " + (detail[-1] if detail else f"exit code {code}")
        )


def convert(
    path, output, fps=DEFAULT_FPS, width=None, loop=True, on_progress=None, cancel=None
):
    """
    Converts a video to a GIF using FFmpeg's two-pass palette technique (palettegen, then
    paletteuse), which avoids the banding of a default GIF encode.

    on_progress(percent) is called with 0..100; cancel is an optional threading.Event.
    Returns {"output", "size"}.
    """
    on_progress = on_progress or (lambda _percent: None)
    fps, width = _clean_options(fps, width)
    info = probe(path)
    if not output:
        output = default_output(path)
    output = os.path.abspath(output)
    if os.path.normcase(output) == os.path.normcase(info["path"]):
        raise ConvertError("The output file would overwrite the source video.")
    out_dir = os.path.dirname(output)
    if not os.path.isdir(out_dir):
        raise ConvertError(f"Output folder does not exist: {out_dir}")

    filters = _filters(fps, width)
    duration = info["duration"]
    on_progress(0)

    with tempfile.TemporaryDirectory(prefix="video2gif-") as tmp:
        palette = os.path.join(tmp, "palette.png")
        partial = os.path.join(tmp, "out.gif")  # only moved into place once complete

        _run_ffmpeg(
            ["-y", "-i", path, "-vf", f"{filters},palettegen", palette],
            duration,
            0,
            40,
            on_progress,
            cancel,
        )
        _run_ffmpeg(
            [
                "-y",
                "-i",
                path,
                "-i",
                palette,
                "-filter_complex",
                f"{filters}[x];[x][1:v]paletteuse",
                "-loop",
                "0" if loop else "-1",
                partial,
            ],
            duration,
            40,
            60,
            on_progress,
            cancel,
        )

        shutil.move(partial, output)

    on_progress(100)
    return {"output": output, "size": os.path.getsize(output)}
