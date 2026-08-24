"""Thin wrapper around the CloudConvert Python SDK.

Handles the import/upload -> process -> export/url task chain and
downloads the result to a local temp file, so the FastAPI route only has
to deal with plain file paths. "process" is either a `convert` task
(format A -> format B) or an `optimize` task (format A -> smaller
format A, used for PDF compression).
"""

import os
import tempfile
from pathlib import Path

import cloudconvert
import requests


class CloudConvertNotConfigured(Exception):
    """Raised when CLOUDCONVERT_API_KEY is missing."""


class CloudConvertError(Exception):
    """Raised when CloudConvert accepts the job but the conversion itself fails."""


_configured = False


def _ensure_configured() -> None:
    global _configured
    api_key = os.getenv("CLOUDCONVERT_API_KEY")
    if not api_key:
        raise CloudConvertNotConfigured(
            "CLOUDCONVERT_API_KEY is not set. Add one to server/.env and restart the server."
        )
    if not _configured:
        cloudconvert.configure(
            api_key=api_key,
            sandbox=os.getenv("CLOUDCONVERT_SANDBOX", "false").strip().lower() == "true",
        )
        _configured = True


def _run_job(input_path: str, original_filename: str, process_task: dict, out_ext: str) -> tuple[str, str]:
    """Run an upload -> `process_task` -> export/url job and download the result.

    `process_task` is the middle task's body (an `operation: "convert"` or
    `operation: "optimize"` dict); its `input` is filled in automatically.
    Returns (output_path, output_filename); caller owns the temp file.
    """
    _ensure_configured()

    try:
        job = cloudconvert.Job.create(
            payload={
                "tasks": {
                    "upload-my-file": {"operation": "import/upload"},
                    "process-my-file": {**process_task, "input": "upload-my-file"},
                    "export-my-file": {"operation": "export/url", "input": "process-my-file"},
                }
            }
        )

        upload_task_stub = next(t for t in job["tasks"] if t["name"] == "upload-my-file")
        upload_task = cloudconvert.Task.find(id=upload_task_stub["id"])
        cloudconvert.Task.upload(file_name=input_path, task=upload_task)

        export_task_stub = next(t for t in job["tasks"] if t["name"] == "export-my-file")
        result = cloudconvert.Task.wait(id=export_task_stub["id"])
    except (CloudConvertNotConfigured, CloudConvertError):
        raise
    except Exception as exc:  # the SDK raises its own exception types for API errors
        raise CloudConvertError(f"CloudConvert request failed: {exc}") from exc

    if result.get("status") != "finished":
        message = result.get("message") or "CloudConvert job did not finish successfully."
        raise CloudConvertError(message)

    files = (result.get("result") or {}).get("files") or []
    if not files:
        raise CloudConvertError("CloudConvert returned no output file.")
    remote = files[0]

    out_fd, out_path = tempfile.mkstemp(suffix=f".{out_ext}")
    try:
        response = requests.get(remote["url"], timeout=120)
        response.raise_for_status()
        with os.fdopen(out_fd, "wb") as f:
            f.write(response.content)
    except Exception:
        # os.fdopen() may or may not have taken ownership of out_fd by the
        # time we get here, so closing it can legitimately fail — that's
        # fine, we only care that it isn't leaked.
        try:
            os.close(out_fd)
        except OSError:
            pass
        os.unlink(out_path)
        raise

    out_filename = remote.get("filename") or f"{Path(original_filename).stem}.{out_ext}"
    return out_path, out_filename


def convert_file(input_path: str, original_filename: str, to_ext: str) -> tuple[str, str]:
    """Convert the file at `input_path` to `to_ext` via CloudConvert."""
    to_ext = to_ext.lstrip(".").lower()
    task = {"operation": "convert", "output_format": to_ext}
    return _run_job(input_path, original_filename, task, to_ext)


# PDF compression profiles, from gentlest to most aggressive. CloudConvert's
# "optimize" operation only documents PDF/PNG/JPG as inputs — PDF is what we
# use it for here.
_PDF_PROFILES = {"light": "web", "strong": "max"}

# Video compression has no dedicated "optimize" operation, so we re-run
# `convert` with a lower target bitrate instead. Values are conservative
# enough to noticeably shrink most source files without visibly wrecking
# quality at "light", and prioritize size at "strong".
_VIDEO_BITRATES = {"light": 1500, "strong": 600}  # kbit/s


def compress_file(input_path: str, original_filename: str, category: str, level: str) -> tuple[str, str]:
    """Compress a PDF or video file via CloudConvert.

    `category` is "pdf" or "video"; `level` is "light" or "strong".
    Output stays in the same format as the input — this shrinks a file,
    it doesn't convert it.
    """
    ext = Path(original_filename).suffix.lstrip(".").lower()

    if category == "pdf":
        profile = _PDF_PROFILES.get(level)
        if not profile:
            raise CloudConvertError(f"Unknown PDF compression level: {level!r}")
        task = {"operation": "optimize", "input_format": "pdf", "profile": profile}
        return _run_job(input_path, original_filename, task, ext or "pdf")

    if category == "video":
        bitrate = _VIDEO_BITRATES.get(level)
        if not bitrate:
            raise CloudConvertError(f"Unknown video compression level: {level!r}")
        task = {"operation": "convert", "output_format": ext, "video_bitrate": bitrate}
        return _run_job(input_path, original_filename, task, ext)

    raise CloudConvertError(f"Unknown compression category: {category!r}")
