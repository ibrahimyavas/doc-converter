# Convert

A file converter for the pairs people actually convert most: **PDF ⇄ Word,
Excel ⇄ SQL, JPEG ⇄ PNG, MP4 ⇄ MOV.** Vite + React frontend, FastAPI
backend, light/dark theming, pastel design system.

| Pair | Mode | How |
|---|---|---|
| Excel ⇄ SQL | 🟢 Live | Parses/generates fully client-side via `xlsx` |
| JPEG ⇄ PNG | 🟢 Live | Re-encoded fully client-side via `<canvas>` |
| PDF ⇄ Word | 🔵 Cloud | Uploaded to `server/`, converted via CloudConvert |
| MP4 ⇄ MOV | 🔵 Cloud | Uploaded to `server/`, converted via CloudConvert |

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

**Backend** (only needed for the PDF⇄Word / MP4⇄MOV pairs — see
[server/README.md](server/README.md) for full setup):

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
