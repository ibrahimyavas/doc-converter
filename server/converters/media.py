"""Video/audio conversion and compression via ffmpeg."""

from .tools import ConversionError, find_tool, run

VIDEO_EXTS = {"mp4", "mov", "webm", "mkv", "avi", "gif"}
AUDIO_EXTS = {"mp3", "wav", "m4a", "flac", "ogg"}

# CRF (constant rate factor): lower = better quality/bigger file. Codec
# picked per-container since not every container accepts every codec.
_VIDEO_ENCODE = {
    "mp4": ["-c:v", "libx264", "-c:a", "aac"],
    "mov": ["-c:v", "libx264", "-c:a", "aac"],
    "webm": ["-c:v", "libvpx-vp9", "-c:a", "libopus"],
    "mkv": ["-c:v", "libx264", "-c:a", "aac"],
    "avi": ["-c:v", "mpeg4", "-c:a", "libmp3lame"],
}

_COMPRESS_CRF = {"light": 26, "strong": 34}


def _ffmpeg():
    return find_tool("FFMPEG_PATH", "ffmpeg")


def convert_media(input_path: str, output_path: str, to_ext: str) -> None:
    ffmpeg = _ffmpeg()

    if to_ext == "gif":
        # A quick single-pass GIF — not palette-optimized (that needs a
        # two-pass filter graph), but a reasonable, fast default.
        run(
            [ffmpeg, "-y", "-i", input_path, "-vf", "fps=12,scale=480:-1:flags=lanczos", output_path],
            timeout=180,
        )
        return

    args = [ffmpeg, "-y", "-i", input_path]
    if to_ext in _VIDEO_ENCODE:
        args += _VIDEO_ENCODE[to_ext]
    args.append(output_path)
    run(args, timeout=180)


def compress_media(input_path: str, output_path: str, ext: str, level: str) -> None:
    ffmpeg = _ffmpeg()
    crf = _COMPRESS_CRF.get(level)
    if not crf:
        raise ConversionError(f"Unknown compression level: {level!r}")

    if ext in AUDIO_EXTS:
        # Bitrate-based for audio — CRF doesn't apply.
        bitrate = "96k" if level == "strong" else "160k"
        run([ffmpeg, "-y", "-i", input_path, "-b:a", bitrate, output_path], timeout=180)
        return

    codec_args = _VIDEO_ENCODE.get(ext, ["-c:v", "libx264", "-c:a", "aac"])
    run(
        [ffmpeg, "-y", "-i", input_path, *codec_args, "-crf", str(crf), "-preset", "veryfast", output_path],
        timeout=300,
    )
