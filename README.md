# Convert

A file converter with five categories, each converting freely between
every format it lists (pick From/To, or tap swap). Vite + React
frontend, FastAPI backend, light/dark theming, pastel design system.

| Category | Formats | Mode | How |
|---|---|---|---|
| Documents | PDF, Word, Text, PowerPoint, JPEG, Excel | 🔵 Cloud | Uploaded to `server/`, converted via CloudConvert |
| Spreadsheets | Excel, CSV, JSON, SQL | 🟢 Live | Parsed/generated fully client-side via `xlsx` |
| Images | JPEG, PNG, WEBP, BMP | 🟢 Live | Re-encoded fully client-side via `<canvas>` (BMP hand-encoded — no browser supports BMP export natively) |
| Video | MP4, MOV | 🔵 Cloud | Uploaded to `server/`, converted via CloudConvert |
| Audio | MP3, WAV | 🔵 Cloud | Uploaded to `server/`, converted via CloudConvert |

There's also a **Compress** section (same format in, smaller file out):

| Category | Mode | How |
|---|---|---|
| Images | 🟢 Live | Re-encode at a chosen quality/max-dimension via `<canvas>` |
| PDF | 🔵 Cloud | CloudConvert's `optimize` task (`web`/`max` profiles) |
| Video | 🔵 Cloud | CloudConvert `convert` with a reduced target bitrate |

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

**Backend** (only needed for the "Cloud" categories/compress targets above
— see [server/README.md](server/README.md) for full setup):

```bash
cd server
python -m venv .venv
.venv\Scripts\activate      # Windows; use `source .venv/bin/activate` on macOS/Linux
pip install -r requirements.txt
cp .env.example .env        # then set CLOUDCONVERT_API_KEY
uvicorn main:app --reload --port 8787
```

## Design system

Tokens (colors, type scale, spacing, components) are documented in
[DESIGN.md](DESIGN.md) and implemented as CSS custom properties in
[src/styles.css](src/styles.css) — light and dark variants both live
there, toggled via the moon/sun button in the nav (persisted to
`localStorage`).
