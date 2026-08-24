import os
import shutil
import tempfile
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()

from fastapi import FastAPI, File, Form, HTTPException  # noqa: E402
from fastapi.middleware.cors import CORSMiddleware  # noqa: E402
from fastapi.responses import FileResponse  # noqa: E402
from pydantic import BaseModel  # noqa: E402
from starlette.background import BackgroundTask  # noqa: E402

from converters.documents import LIBREOFFICE_EXTS, convert_document  # noqa: E402
from converters.media import AUDIO_EXTS, VIDEO_EXTS, compress_media, convert_media  # noqa: E402
from converters.pdf_tools import compress_pdf  # noqa: E402
from converters.tools import ConversionError, ToolNotFound, tool_available  # noqa: E402
from omniroute_service import (  # noqa: E402
    OmniRouteError,
    OmniRouteNotConfigured,
    generate_study_content,
)

app = FastAPI(title="doc-converter backend")

origins = [o.strip() for o in os.getenv("CORS_ORIGIN", "http://localhost:5173").split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_methods=["*"],
    allow_headers=["*"],
    # Without this, browsers silently block JS from reading
    # Content-Disposition on the response (console: "Refused to get
    # unsafe header") — the frontend reads it to name the downloaded
    # file, so it was falling back to a client-computed name every time.
    expose_headers=["Content-Disposition"],
)

DOCUMENT_EXTS = LIBREOFFICE_EXTS | {"jpg"}


@app.get("/health")
def health():
    return {
        "ok": True,
        "omniroute_configured": bool(os.getenv("OMNIROUTE_API_KEY")),
        "tools": {
            "ffmpeg": tool_available("FFMPEG_PATH", "ffmpeg"),
            "soffice": tool_available("SOFFICE_PATH", "soffice"),
            "pdftoppm": tool_available("PDFTOPPM_PATH", "pdftoppm"),
            "mutool": tool_available("MUTOOL_PATH", "mutool"),
        },
    }


def _new_workdir() -> str:
    """One throwaway directory per request. Every intermediate file a
    conversion chain produces (jpg -> pdf -> txt -> pptx, LibreOffice
    profiles, ...) lives inside it, so cleanup is always "delete this one
    directory" instead of tracking every temp file/dir each helper
    creates individually.
    """
    return tempfile.mkdtemp(prefix="dc_req_")


def _stream_and_cleanup_workdir(path: str, filename: str, workdir: str) -> FileResponse:
    return FileResponse(
        path,
        filename=filename,
        media_type="application/octet-stream",
        background=BackgroundTask(shutil.rmtree, workdir, ignore_errors=True),
    )


@app.post("/api/convert")
def convert(file: bytes = File(...), filename: str = Form(...), to_ext: str = Form(...)):
    """Convert an uploaded file using local tools (ffmpeg / LibreOffice /
    Poppler / Pillow) — no cloud API involved. `file` is `bytes` (not
    UploadFile) so this stays a plain sync `def`, which FastAPI runs in a
    worker thread automatically; the subprocess calls underneath are
    blocking.
    """
    from_ext = Path(filename).suffix.lstrip(".").lower()
    to_ext = to_ext.lstrip(".").lower()

    workdir = _new_workdir()
    tmp_in = os.path.join(workdir, f"input.{from_ext}" if from_ext else "input")
    with open(tmp_in, "wb") as f:
        f.write(file)

    try:
        if from_ext in VIDEO_EXTS | AUDIO_EXTS or to_ext in VIDEO_EXTS | AUDIO_EXTS:
            tmp_out = os.path.join(workdir, f"output.{to_ext}")
            convert_media(tmp_in, tmp_out, to_ext)
            produced = tmp_out
        elif from_ext in DOCUMENT_EXTS or to_ext in DOCUMENT_EXTS:
            produced = convert_document(tmp_in, from_ext, to_ext, workdir)
        else:
            raise HTTPException(status_code=400, detail=f"Don't know how to convert .{from_ext} to .{to_ext}.")
    except ToolNotFound as exc:
        shutil.rmtree(workdir, ignore_errors=True)
        raise HTTPException(status_code=501, detail=str(exc)) from exc
    except ConversionError as exc:
        shutil.rmtree(workdir, ignore_errors=True)
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    except HTTPException:
        shutil.rmtree(workdir, ignore_errors=True)
        raise

    out_filename = f"{Path(filename).stem}.{to_ext}"
    return _stream_and_cleanup_workdir(produced, out_filename, workdir)


@app.post("/api/compress")
def compress(
    file: bytes = File(...),
    filename: str = Form(...),
    category: str = Form(...),
    level: str = Form(...),
):
    """Shrink a PDF or video file locally (mutool / ffmpeg) — same format
    in and out.
    """
    ext = Path(filename).suffix.lstrip(".").lower()
    workdir = _new_workdir()
    tmp_in = os.path.join(workdir, f"input.{ext}" if ext else "input")
    with open(tmp_in, "wb") as f:
        f.write(file)
    tmp_out = os.path.join(workdir, f"output.{ext}")

    try:
        if category == "pdf":
            compress_pdf(tmp_in, tmp_out, level)
        elif category == "video":
            compress_media(tmp_in, tmp_out, ext, level)
        else:
            raise HTTPException(status_code=400, detail=f"Unknown compress category: {category!r}")
    except ToolNotFound as exc:
        shutil.rmtree(workdir, ignore_errors=True)
        raise HTTPException(status_code=501, detail=str(exc)) from exc
    except ConversionError as exc:
        shutil.rmtree(workdir, ignore_errors=True)
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    except HTTPException:
        shutil.rmtree(workdir, ignore_errors=True)
        raise

    return _stream_and_cleanup_workdir(tmp_out, filename, workdir)


class StudyRequest(BaseModel):
    text: str
    mode: str  # "summary" | "study_guide" | "flashcards"


@app.post("/api/study")
def study(req: StudyRequest):
    """Turn extracted PDF text into a summary/study guide/flashcards via
    OmniRoute. The PDF itself never reaches this server — only whatever
    text the frontend already extracted client-side with pdf.js.
    """
    if not req.text.strip():
        raise HTTPException(status_code=400, detail="No text to work with — the PDF may be empty or image-only.")
    try:
        result = generate_study_content(req.text, req.mode)
    except OmniRouteNotConfigured as exc:
        raise HTTPException(status_code=501, detail=str(exc)) from exc
    except OmniRouteError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    return {"result": result, "mode": req.mode}
