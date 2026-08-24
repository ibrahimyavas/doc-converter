# doc-converter backend

A small FastAPI service backing two independent features:

1. **File conversion/compression** — the frontend's "cloud" categories
   (**Documents**, **Video**, **Audio**) plus PDF/video **compression**,
   all via the [CloudConvert](https://cloudconvert.com) API.
   `/api/convert` is generic (it just forwards whatever `to_ext` it's
   given to CloudConvert), so adding more formats to those categories on
   the frontend needs no backend changes. The frontend's "live"
   categories (Spreadsheets, Images, and image compression) stay fully
   client-side and never touch this server.
2. **PDF study tool** — `/api/study` turns text (already extracted
   client-side with pdf.js — the PDF itself never reaches this server)
   into a summary, study guide, or flashcard set via
   [OmniRoute](https://github.com/diegosouzapw/OmniRoute), a self-hosted
   AI gateway.

## Setup

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

Edit `.env` and set `CLOUDCONVERT_API_KEY`. Get a free key at
https://cloudconvert.com/dashboard/api/v2/keys (no card required; free
tier is ~25 conversion minutes/day).

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

Check it's alive:

```bash
curl http://localhost:8787/health
# {"ok":true,"cloudconvert_configured":true,"omniroute_configured":true}
```

If either `_configured` flag is `false`, the corresponding endpoint
returns `501` with a message telling you to set the missing key — the
frontend surfaces that as an inline error rather than failing silently.

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
body on failure (`501` not configured, `502` CloudConvert error).

`POST /api/study` — JSON body:

| field | type | description |
|---|---|---|
| `text` | string | extracted PDF text (truncated server-side to ~40k chars) |
| `mode` | string | `summary`, `study_guide`, or `flashcards` |

Returns `{"result": "...", "mode": "..."}`, or `{"detail": "..."}`
(`501` not configured, `502` OmniRoute error, `400` empty text).

## Troubleshooting

**CORS error in the browser console, request never completes.** Browsers
treat `http://localhost:5173` and `http://127.0.0.1:5173` as different
origins even though they're the same dev server — `CORS_ORIGIN` must
list whichever one the frontend is actually loaded from (the `.env.example`
default lists both). If you changed Vite's `server.host`, or your OS
resolves `localhost` differently, update `CORS_ORIGIN` to match the exact
URL in your browser's address bar and restart the backend.

## Docker

```bash
docker build -t doc-converter-server .
docker run -p 8787:8787 \
  -e CLOUDCONVERT_API_KEY=your_key_here \
  -e CORS_ORIGIN=https://your-frontend-domain.com \
  doc-converter-server
```
