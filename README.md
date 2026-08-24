# Convert

A file converter with five categories, each converting freely between
every format it lists (pick From/To, or tap swap). Vite + React
frontend, FastAPI backend — **fully self-hosted conversion, no cloud
API**: ffmpeg, LibreOffice, Poppler, and mutool do the actual work.
Light/dark theming, pastel design system.

| Category | Formats | Mode | How |
|---|---|---|---|
| Documents | PDF, Word, Text, PowerPoint, JPEG, Excel, HTML, RTF, EPUB, OpenDocument | 🔵 Cloud | Uploaded to `server/`, converted locally via LibreOffice + Poppler |
| Spreadsheets | Excel, CSV, JSON, SQL | 🟢 Live | Parsed/generated fully client-side via `xlsx` |
| Images | JPEG, PNG, WEBP, BMP | 🟢 Live | Re-encoded fully client-side via `<canvas>` (BMP hand-encoded — no browser supports BMP export natively) |
| Video | MP4, MOV, WEBM, MKV, AVI, GIF | 🔵 Cloud | Uploaded to `server/`, converted locally via ffmpeg |
| Audio | MP3, WAV, M4A, FLAC, OGG | 🔵 Cloud | Uploaded to `server/`, converted locally via ffmpeg |

("Cloud" here means "goes through our backend," not a third-party API —
see [server/README.md](server/README.md) for why that distinction
matters and how the local tools are wired up.)

There's also a **Compress** section (same format in, smaller file out):

| Category | Mode | How |
|---|---|---|
| Images | 🟢 Live | Re-encode at a chosen quality/max-dimension via `<canvas>` |
| PDF | 🔵 Cloud | `mutool clean` — stream recompression + object garbage collection |
| Video | 🔵 Cloud | ffmpeg with a reduced target bitrate |

...and a **Study** section: upload a PDF, extract its text client-side
(`pdfjs-dist`), and get a 🟡 AI-generated summary, study guide, or
flashcard set back via [OmniRoute](https://github.com/diegosouzapw/OmniRoute)
(also self-hosted) — only the extracted text leaves your browser, never
the PDF file itself.

## Structure

```
doc-converter/
├── src/            # React frontend (Vite)
├── server/         # FastAPI backend — see server/README.md
├── DESIGN.md       # Design system reference (tokens, components)
└── .env.example    # VITE_API_BASE_URL for the frontend
```

## Run it

**Frontend:**

```bash
npm install
cp .env.example .env   # optional — defaults to http://localhost:8787
npm run dev             # http://localhost:5173
```

**Backend** (needed for the "Cloud" categories/compress targets and the
Study tool — see [server/README.md](server/README.md) for full setup,
including installing ffmpeg/LibreOffice/Poppler/mutool):

```bash
cd server
python -m venv .venv
.venv\Scripts\activate      # Windows; use `source .venv/bin/activate` on macOS/Linux
pip install -r requirements.txt
cp .env.example .env
uvicorn main:app --reload --port 8787
```

## Design system

Tokens (colors, type scale, spacing, components) are documented in
[DESIGN.md](DESIGN.md) and implemented as CSS custom properties in
[src/styles.css](src/styles.css) — light and dark variants both live
there, toggled via the moon/sun button in the nav (persisted to
`localStorage`).
