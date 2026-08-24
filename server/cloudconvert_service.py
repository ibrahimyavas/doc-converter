"""Thin wrapper around the CloudConvert Python SDK.

Handles the import/upload -> convert -> export/url task chain and
downloads the result to a local temp file, so the FastAPI route only has
to deal with plain file paths.
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


def convert_file(input_path: str, original_filename: str, to_ext: str) -> tuple[str, str]:
    """Convert the file at `input_path` via CloudConvert.

    Returns (output_path, output_filename). Caller owns the returned temp
    file and is responsible for deleting it once the response is sent.
    """
    _ensure_configured()
    to_ext = to_ext.lstrip(".").lower()

    try:
        job = cloudconvert.Job.create(
            payload={
                "tasks": {
                    "upload-my-file": {"operation": "import/upload"},
                    "convert-my-file": {
                        "operation": "convert",
                        "input": "upload-my-file",
                        "output_format": to_ext,
                    },
                    "export-my-file": {"operation": "export/url", "input": "convert-my-file"},
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

    out_fd, out_path = tempfile.mkstemp(suffix=f".{to_ext}")
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

    out_filename = remote.get("filename") or f"{Path(original_filename).stem}.{to_ext}"
    return out_path, out_filename
