# doc-converter backend

A small FastAPI service that converts the frontend's "cloud" categories —
**Documents** (PDF/Word/Text/PowerPoint), **Video** (MP4/MOV), and
**Audio** (MP3/WAV) — via the [CloudConvert](https://cloudconvert.com)
API. `/api/convert` is generic (it just forwards whatever `to_ext` it's
given to CloudConvert), so adding more formats to those categories on
the frontend needs no backend changes. The frontend's "live" categories
(Spreadsheets, Images) stay fully client-side and never touch this
server.

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

Returns the converted file as a binary response with
`Content-Disposition: attachment`, or a JSON `{"detail": "..."}` error
body on failure (`501` not configured, `502` CloudConvert error).

## Docker

```bash
docker build -t doc-converter-server .
docker run -p 8787:8787 \
  -e CLOUDCONVERT_API_KEY=your_key_here \
  -e CORS_ORIGIN=https://your-frontend-domain.com \
  doc-converter-server
```
