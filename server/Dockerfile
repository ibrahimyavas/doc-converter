FROM python:3.12-slim

WORKDIR /app

# Everything file conversion needs, fully self-hosted — no cloud API:
#   ffmpeg          -> video/audio
#   libreoffice     -> documents (docx/txt/pptx/xlsx/html/rtf/odt/epub)
#   poppler-utils   -> pdftoppm (PDF->image), pdftotext (PDF->text)
#   mupdf-tools     -> mutool (PDF compression)
# This is a big layer (LibreOffice alone is a few hundred MB) — that's
# the real cost of not depending on a cloud conversion API.
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    libreoffice \
    poppler-utils \
    mupdf-tools \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

ENV PORT=8787
EXPOSE 8787

# CORS_ORIGIN / OMNIROUTE_API_KEY are read from the environment at
# runtime (pass them via `docker run -e ...` or your host's env config,
# not baked into the image). FFMPEG_PATH etc. aren't needed here — apt
# puts every tool on PATH already.
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8787"]
