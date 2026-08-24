import os
import tempfile
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()

from fastapi import FastAPI, File, Form, HTTPException  # noqa: E402
from fastapi.middleware.cors import CORSMiddleware  # noqa: E402
from fastapi.responses import FileResponse  # noqa: E402
from starlette.background import BackgroundTask  # noqa: E402

from cloudconvert_service import (  # noqa: E402
    CloudConvertError,
    CloudConvertNotConfigured,
    convert_file,
)

app = FastAPI(title="doc-converter backend")

origins = [o.strip() for o in os.getenv("CORS_ORIGIN", "http://localhost:5173").split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health():
    return {"ok": True, "cloudconvert_configured": bool(os.getenv("CLOUDCONVERT_API_KEY"))}


@app.post("/api/convert")
def convert(file: bytes = File(...), filename: str = Form(...), to_ext: str = Form(...)):
    """Convert an uploaded file via CloudConvert and stream the result back.

    `file` is typed as `bytes` (not `UploadFile`) on purpose: it makes this
    a plain sync `def`, which FastAPI runs in a worker thread automatically
    — so the blocking CloudConvert wait doesn't stall the event loop.
    """
    if not os.getenv("CLOUDCONVERT_API_KEY"):
        raise HTTPException(
            status_code=501,
            detail="Server is not configured with a CLOUDCONVERT_API_KEY yet. Add one to server/.env and restart.",
        )

    suffix = Path(filename).suffix or ""
    fd, tmp_in_path = tempfile.mkstemp(suffix=suffix)
    with os.fdopen(fd, "wb") as f:
        f.write(file)

    try:
        out_path, out_filename = convert_file(tmp_in_path, filename, to_ext)
    except CloudConvertNotConfigured as exc:
        raise HTTPException(status_code=501, detail=str(exc)) from exc
    except CloudConvertError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    finally:
        os.unlink(tmp_in_path)

    return FileResponse(
        out_path,
        filename=out_filename,
        media_type="application/octet-stream",
        background=BackgroundTask(os.unlink, out_path),
    )
