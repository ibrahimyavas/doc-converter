# doc-converter backend

A small FastAPI service backing two independent, fully self-hosted
features — no cloud conversion API, no per-conversion cost or rate
limit:

1. **File conversion/compression** — the frontend's "cloud" categories
   (**Documents**, **Video**, **Audio**) plus PDF/video **compression**,
   all done with local tools:
   - `ffmpeg` — video/audio conversion and compression
   - `LibreOffice` (headless) — document conversion (docx, txt, pptx,
     xlsx, html, rtf, odt, epub)
   - `Poppler` (`pdftoppm`, `pdftotext`) — PDF ⇄ image and PDF → text
     extraction (LibreOffice can't export text formats *from* a PDF —
     see `converters/documents.py`'s docstring for why)
   - `mutool` (MuPDF) — PDF compression
   - `Pillow` / `python-pptx` — image ⇄ PDF and text → PPTX, for the
     format pairs no LibreOffice filter bridges directly

   The frontend's "live" categories (Spreadsheets, Images, and image
   compression) stay fully client-side and never touch this server.
2. **PDF study tool** — `/api/study` turns text (already extracted
   client-side with pdf.js — the PDF itself never reaches this server)
   into a summary, study guide, or flashcard set via
   [OmniRoute](https://github.com/diegosouzapw/OmniRoute), a self-hosted
   AI gateway.

## Setup

Install the four conversion tools first — via your OS package manager
where possible:

```bash
# Debian/Ubuntu
sudo apt install ffmpeg libreoffice poppler-utils mupdf-tools

# macOS
brew install ffmpeg libreoffice poppler mupdf-tools

# Windows: no single package manager has all four with matching IDs.
# What actually worked here:
winget install --id Gyan.FFmpeg -e
winget install --id TheDocumentFoundation.LibreOffice -e
winget install --id oschwartz10612.Poppler -e
winget install --id ArtifexSoftware.mutool -e   # Ghostscript's installer
  # hard-requires admin elevation; mutool is the winget-friendly substitute
  # for PDF compression (see converters/pdf_tools.py for the tradeoff).
```

Then the Python side:

```bash
cd server
python -m venv .venv

# Windows
.venv\Scripts\activate
# macOS/Linux
source .venv/bin/activate

pip install -r requirements.txt
cp .env.example .env
```

If a tool ends up somewhere not on PATH (common on Windows with
winget — packages land under
`%LOCALAPPDATA%\Microsoft\WinGet\Packages\...`), point `.env` at it
directly: `FFMPEG_PATH`, `SOFFICE_PATH`, `PDFTOPPM_PATH`,
`PDFTOTEXT_PATH`, `MUTOOL_PATH`. Leave them unset if the tool is
already on PATH (the normal case in Docker / most Linux setups).

For the study tool, also install and run OmniRoute, then set
`OMNIROUTE_API_KEY` (from its dashboard) in `.env`:

```bash
npm install -g omniroute
omniroute   # serves on http://localhost:20128/v1
```

`OMNIROUTE_MODEL` defaults to `auto/best-chat`. OmniRoute's free-tier
pool aggregates community providers and can be flaky (429s) — the
backend retries once automatically, but if you hit persistent failures,
add a provider API key via OmniRoute's own dashboard for a more reliable
pool.

## Run

```bash
uvicorn main:app --reload --port 8787
```

Check it's alive, and which tools it actually found:

```bash
curl http://localhost:8787/health
# {"ok":true,"omniroute_configured":true,"tools":{"ffmpeg":true,"soffice":true,"pdftoppm":true,"mutool":true}}
```

If `omniroute_configured` is `false`, `/api/study` returns `501`. If any
tool under `tools` is `false`, the conversions/compressions that need it
return `501` — both cases carry a message saying exactly what's missing,
which the frontend surfaces as an inline error rather than failing
silently.

## API

`POST /api/convert` — multipart form:

| field | type | description |
|---|---|---|
| `file` | file | the file to convert |
| `filename` | text | original filename (with extension) |
| `to_ext` | text | target extension, e.g. `docx`, `pdf`, `mov`, `mp4` |

`POST /api/compress` — same-format-in, smaller-out. Multipart form:

| field | type | description |
|---|---|---|
| `file` | file | the file to shrink |
| `filename` | text | original filename (with extension) |
| `category` | text | `pdf` or `video` |
| `level` | text | `light` or `strong` |

Both return the file as a binary response with
`Content-Disposition: attachment`, or a JSON `{"detail": "..."}` error
body on failure (`501` missing tool, `502` conversion failed).

`POST /api/study` — JSON body:

| field | type | description |
|---|---|---|
| `text` | string | extracted PDF text (truncated server-side to ~40k chars) |
| `mode` | string | `summary`, `study_guide`, or `flashcards` |

Returns `{"result": "...", "mode": "..."}`, or `{"detail": "..."}`
(`501` not configured, `502` OmniRoute error, `400` empty text).

## How document conversion actually works

`converters/documents.py`'s module docstring has the full explanation,
but the short version: LibreOffice is really three applications (Writer,
Calc, Impress) sharing one CLI, and none of them can export directly to
a format outside their own family — Writer has no xlsx export, Calc has
no docx export, and a PDF opened via `--convert-to` goes through
LibreOffice's Draw import (a flat visual reproduction) which can't
export to *any* text format. Every family can export to PDF natively
though, so that's the hub every cross-family conversion routes through:
extract with `pdftotext`, then hand the plain text to the target
family's own importer (or, for pptx, build the deck directly with
`python-pptx`, since Writer has no text→slides bridge to lean on
either). This is why PDF/JPG as a *source* for docx/txt/etc. needed a
specific fix during testing — it's not a corner case, it's how
LibreOffice's CLI is shaped.

## Known limitations (honestly documented, not hidden)

- **PDF compression is modest.** Without Ghostscript (its installer
  hard-requires admin elevation, unavailable here), PDF compression uses
  `mutool clean` — real stream recompression and object garbage
  collection, but it doesn't *downsample image resolution* the way
  Ghostscript's `/screen`/`/ebook` profiles do. Image-heavy PDFs won't
  shrink as dramatically as they would with Ghostscript.
- **PDF/image → PPTX/XLSX is text-only.** These go through `pdftotext`
  extraction, so a source PDF's layout, images, and tables become plain
  text dumped into a spreadsheet cell or slide — not a structural
  reconstruction.
- **JPG → any text format has no OCR.** The image itself has no text
  layer to extract, so the output is a near-empty document — expected,
  not a bug.
- **`pdftoppm`/PDF exports take the first page only** for single-file
  outputs (PDF → JPG, and the PDF hop inside cross-format conversions).

## Troubleshooting

**CORS error in the browser console, request never completes.** Browsers
treat `http://localhost:5173` and `http://127.0.0.1:5173` as different
origins even though they're the same dev server — `CORS_ORIGIN` must
list whichever one the frontend is actually loaded from (the `.env.example`
default lists both). If you changed Vite's `server.host`, or your OS
resolves `localhost` differently, update `CORS_ORIGIN` to match the exact
URL in your browser's address bar and restart the backend.

**"LibreOffice failed: ... no export filter ... aborting"** — you're
likely calling `_convert_via_libreoffice` directly with a PDF (or any
cross-family pair) instead of going through `convert_document()`, which
routes those through the PDF/text hop described above.

## Docker

```bash
docker build -t doc-converter-server .
docker run -p 8787:8787 \
  -e CORS_ORIGIN=https://your-frontend-domain.com \
  -e OMNIROUTE_API_KEY=your_key_here \
  doc-converter-server
```

The image installs `ffmpeg`, `libreoffice`, `poppler-utils`, and
`mupdf-tools` via apt — a large layer (LibreOffice alone is a few
hundred MB), which is the real tradeoff of not depending on a cloud
conversion API.
