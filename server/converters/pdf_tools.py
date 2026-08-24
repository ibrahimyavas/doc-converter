"""PDF compression via mutool (MuPDF's CLI). No Ghostscript here — its
installer hard-requires admin elevation, which isn't available in this
environment; mutool's `clean` command covers real (if more modest)
compression: recompressing image/font streams and garbage-collecting
duplicate/unused objects. It won't downsample image *resolution* the way
Ghostscript's /screen or /ebook profiles do, so gains are smaller on
image-heavy PDFs — documented as such rather than overpromised.
"""

from .tools import ConversionError, find_tool, run

# -z deflate streams, -f/-i recompress font/image streams, -c clean
# content streams. Strong adds -s (sanitize, can shrink malformed
# content further) and -gggg (garbage collect + compact xref + merge
# duplicate objects + dedupe streams — the most aggressive combination).
_PROFILES = {
    "light": ["-z", "-f", "-i", "-c", "-g"],
    "strong": ["-z", "-f", "-i", "-c", "-s", "-gggg"],
}


def compress_pdf(input_path: str, output_path: str, level: str) -> None:
    flags = _PROFILES.get(level)
    if not flags:
        raise ConversionError(f"Unknown PDF compression level: {level!r}")
    mutool = find_tool("MUTOOL_PATH", "mutool")
    run([mutool, "clean", *flags, input_path, output_path], timeout=120)
