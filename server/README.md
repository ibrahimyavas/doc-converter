# doc-converter backend

A small FastAPI service that converts the frontend's "cloud" categories —
**Documents** (PDF/Word/Text/PowerPoint/JPEG/Excel), **Video** (MP4/MOV),
and **Audio** (MP3/WAV) — plus PDF/video **compression**, all via the
[CloudConvert](https://cloudconvert.com) API. `/api/convert` is generic
(it just forwards whatever `to_ext` it's given to CloudConvert), so
adding more formats to those categories on the frontend needs no backend
changes. The frontend's "live" categories (Spreadsheets, Images, and
image compression) stay fully client-side and never touch this server.

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

## Run

```bash
uvicorn main:app --reload --port 8787
```

Check it's alive:

```bash
curl http://localhost:8787/health
# {"ok":true,"cloudconvert_configured":true}
```

If `cloudconvert_configured` is `false`, the `/api/convert` endpoint
returns `501` with a message telling you to set the API key — the
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
