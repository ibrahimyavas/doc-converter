// xlsx is ~500KB minified — load it lazily so JPEG/PNG and other pairs
// don't pay for it on first paint.
let _xlsxPromise;
function loadXlsx() {
  return (_xlsxPromise ??= import("xlsx"));
}

// Each category lists every format it supports; the UI renders two
// dropdowns (From / To) rather than a fixed pair, so any format can
// convert to any other format in the same category.
// mode: "live"  = real conversion, runs fully in the browser, file never
//                 leaves the machine.
//       "cloud" = real conversion, but goes through our FastAPI backend
//                 (server/), which runs local tools (ffmpeg, LibreOffice,
//                 Poppler) — no third-party API, fully self-hosted. The
//                 file is uploaded to that server for this category only.
export const CATEGORIES = [
  {
    id: "documents",
    label: "Documents",
    icon: "FileText",
    mode: "cloud",
    description: "PDF, Word, slides, text, ebooks, and more, any direction.",
    formats: [
      { ext: "pdf", label: "PDF", accept: ".pdf" },
      { ext: "docx", label: "Word", accept: ".docx,.doc" },
      { ext: "txt", label: "Text", accept: ".txt" },
      { ext: "pptx", label: "PowerPoint", accept: ".pptx,.ppt" },
      { ext: "jpg", label: "JPEG", accept: ".jpg,.jpeg" },
      { ext: "xlsx", label: "Excel", accept: ".xlsx,.xls" },
      { ext: "html", label: "HTML", accept: ".html,.htm" },
      { ext: "rtf", label: "RTF", accept: ".rtf" },
      { ext: "epub", label: "EPUB", accept: ".epub" },
      { ext: "odt", label: "OpenDocument", accept: ".odt" },
    ],
  },
  {
    id: "spreadsheets",
    label: "Spreadsheets",
    icon: "Table",
    mode: "live",
    description: "Excel, CSV, JSON, and SQL — all convert through each other.",
    formats: [
      { ext: "xlsx", label: "Excel", accept: ".xlsx,.xls" },
      { ext: "csv", label: "CSV", accept: ".csv" },
      { ext: "json", label: "JSON", accept: ".json" },
      { ext: "sql", label: "SQL", accept: ".sql" },
    ],
  },
  {
    id: "images",
    label: "Images",
    icon: "Image",
    mode: "live",
    description: "Lossless, pixel-accurate re-encoding in your browser.",
    formats: [
      { ext: "jpg", label: "JPEG", accept: ".jpg,.jpeg" },
      { ext: "png", label: "PNG", accept: ".png" },
      { ext: "webp", label: "WEBP", accept: ".webp" },
      { ext: "bmp", label: "BMP", accept: ".bmp" },
    ],
  },
  {
    id: "video",
    label: "Video",
    icon: "Video",
    mode: "cloud",
    description: "MP4, MOV, WEBM, MKV, AVI, and GIF, any direction.",
    formats: [
      { ext: "mp4", label: "MP4", accept: ".mp4" },
      { ext: "mov", label: "MOV", accept: ".mov" },
      { ext: "webm", label: "WEBM", accept: ".webm" },
      { ext: "mkv", label: "MKV", accept: ".mkv" },
      { ext: "avi", label: "AVI", accept: ".avi" },
      { ext: "gif", label: "GIF", accept: ".gif" },
    ],
  },
  {
    id: "audio",
    label: "Audio",
    icon: "Music",
    mode: "cloud",
    description: "MP3, WAV, M4A, FLAC, and OGG, any direction.",
    formats: [
      { ext: "mp3", label: "MP3", accept: ".mp3" },
      { ext: "wav", label: "WAV", accept: ".wav" },
      { ext: "m4a", label: "M4A", accept: ".m4a" },
      { ext: "flac", label: "FLAC", accept: ".flac" },
      { ext: "ogg", label: "OGG", accept: ".ogg" },
    ],
  },
];

// Compression is a different shape from conversion: same format in, same
// (or a chosen lossy) format out, just smaller. So it gets its own list —
// a single accepted-input spec plus either a quality control (images,
// live) or a light/strong level (PDF/video, cloud).
export const COMPRESS_CATEGORIES = [
  {
    id: "images",
    label: "Images",
    icon: "Image",
    mode: "live",
    description: "Re-encode at a lower quality, fully in your browser.",
    accept: ".jpg,.jpeg,.png,.webp,.bmp",
    // Output choices only — BMP is uncompressed, so it's a fine input but
    // a pointless compression target.
    outputFormats: [
      { ext: "jpg", label: "JPEG" },
      { ext: "webp", label: "WEBP" },
      { ext: "png", label: "PNG" },
    ],
  },
  {
    id: "pdf",
    label: "PDF",
    icon: "FileText",
    mode: "cloud",
    description: "Shrink file size via our server's mutool-based PDF optimizer.",
    accept: ".pdf",
  },
  {
    id: "video",
    label: "Video",
    icon: "Video",
    mode: "cloud",
    description: "Re-encode at a lower bitrate via our server's ffmpeg.",
    accept: ".mp4,.mov",
  },
];

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8787";

function baseName(filename) {
  const dot = filename.lastIndexOf(".");
  return dot === -1 ? filename : filename.slice(0, dot);
}

function download(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

/* ---------------------------- Images (live) ---------------------------- */
// jpg/png/webp/bmp, any direction. Decoding all four is native browser
// <img> support; encoding jpg/png/webp goes through canvas.toBlob, but no
// browser's toBlob supports "image/bmp" — so BMP output is hand-encoded
// from raw pixel data below.

function encodeBmp(imageData) {
  const { width, height, data } = imageData;
  const rowSize = Math.ceil((width * 3) / 4) * 4; // rows pad to a 4-byte boundary
  const pixelArraySize = rowSize * height;
  const fileSize = 54 + pixelArraySize;
  const buffer = new ArrayBuffer(fileSize);
  const view = new DataView(buffer);

  // BITMAPFILEHEADER
  view.setUint8(0, 0x42); // 'B'
  view.setUint8(1, 0x4d); // 'M'
  view.setUint32(2, fileSize, true);
  view.setUint32(10, 54, true); // pixel data offset

  // BITMAPINFOHEADER
  view.setUint32(14, 40, true);
  view.setInt32(18, width, true);
  view.setInt32(22, height, true); // positive height = bottom-up rows
  view.setUint16(26, 1, true); // color planes
  view.setUint16(28, 24, true); // bits per pixel
  view.setUint32(34, pixelArraySize, true);
  view.setInt32(38, 2835, true); // ~72dpi
  view.setInt32(42, 2835, true);

  let offset = 54;
  for (let y = height - 1; y >= 0; y--) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      view.setUint8(offset++, data[i + 2]); // B
      view.setUint8(offset++, data[i + 1]); // G
      view.setUint8(offset++, data[i]); // R
    }
    for (let p = 0; p < rowSize - width * 3; p++) view.setUint8(offset++, 0);
  }

  return new Blob([buffer], { type: "image/bmp" });
}

const CANVAS_MIME = { jpg: "image/jpeg", png: "image/png", webp: "image/webp" };

// Decode `file` into a same-size <canvas>, optionally flattened onto white
// (needed before encoding to a format with no alpha channel, i.e. JPEG).
// Shared by convertImage (format A -> B) and compressImage (format A ->
// smaller format A, or a chosen output format at a lower quality).
function renderToCanvas(file, { flattenWhite = false, maxDimension } = {}, onProgress) {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read the image file."));
    reader.onload = () => {
      onProgress?.(35);
      img.onload = () => {
        onProgress?.(65);
        let { naturalWidth: w, naturalHeight: h } = img;
        if (maxDimension && Math.max(w, h) > maxDimension) {
          const scale = maxDimension / Math.max(w, h);
          w = Math.round(w * scale);
          h = Math.round(h * scale);
        }
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (flattenWhite) {
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(0, 0, w, h);
        }
        ctx.drawImage(img, 0, 0, w, h);
        resolve({ canvas, ctx });
      };
      img.onerror = () => reject(new Error("Could not decode the image file."));
      img.src = reader.result;
    };
    onProgress?.(10);
    reader.readAsDataURL(file);
  });
}

function encodeCanvas(canvas, ctx, toExt, quality, onProgress) {
  return new Promise((resolve, reject) => {
    if (toExt === "bmp") {
      try {
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        onProgress?.(100);
        resolve(encodeBmp(imageData));
      } catch (err) {
        reject(new Error(`Could not encode BMP: ${err.message}`));
      }
      return;
    }
    canvas.toBlob(
      (blob) => {
        onProgress?.(100);
        if (!blob) return reject(new Error(`Your browser can't export ${toExt.toUpperCase()} images.`));
        resolve(blob);
      },
      CANVAS_MIME[toExt],
      quality
    );
  });
}

async function convertImage(file, toExt, onProgress) {
  const { canvas, ctx } = await renderToCanvas(file, { flattenWhite: toExt === "jpg" }, onProgress);
  return encodeCanvas(canvas, ctx, toExt, 0.92, onProgress);
}

// Quality/downscale-driven re-encode — same idea as convertImage, but the
// caller picks the quality (and PNG/BMP inputs can be re-targeted to a
// lossy format, since neither compresses meaningfully as itself).
async function compressImage(file, toExt, quality, maxDimension, onProgress) {
  const { canvas, ctx } = await renderToCanvas(file, { flattenWhite: toExt === "jpg", maxDimension }, onProgress);
  return encodeCanvas(canvas, ctx, toExt, quality, onProgress);
}

/* ------------------------- Spreadsheets (live) ---------------------------
   xlsx/csv/json/sql all convert through a shared intermediate shape:
     Table = { name: string, headers: string[], rows: any[][] }
   parseToTables() reads any supported format into Table[]; the
   tablesTo*Blob() functions write Table[] back out to any of them. */

function sqlLiteral(value) {
  if (value === null || value === undefined || value === "") return "NULL";
  if (typeof value === "number") return String(value);
  if (typeof value === "boolean") return value ? "1" : "0";
  return `'${String(value).replace(/'/g, "''")}'`;
}

function sheetToTable(XLSX, sheet, name) {
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null, blankrows: false });
  const headers = (rows[0] || []).map((h, i) => (h ? String(h) : `col_${i + 1}`));
  return { name, headers, rows: rows.slice(1) };
}

function parseSqlToTables(text) {
  const tables = new Map(); // name -> { headers, rows }

  // NOTE: the prefix must be lazy (*?) — greedy [^(]* over-consumes past the
  // table name, then backtracking settles for the *minimal* match that still
  // satisfies the rest of the pattern, which is just the identifier's last
  // character (e.g. captures "e" out of "people"). Lazy stops at the first
  // position where the whole pattern succeeds, i.e. right at the real name.
  const createRe = /CREATE\s+TABLE[^(]*?`?(\w+)`?\s*\(([^;]+)\)\s*;/gis;
  let m;
  while ((m = createRe.exec(text))) {
    const [, table, colsBlock] = m;
    const headers = colsBlock
      .split(",")
      .map((c) => c.trim().replace(/`/g, "").split(/\s+/)[0])
      .filter(Boolean);
    if (!tables.has(table)) tables.set(table, { headers, rows: [] });
  }

  const insertRe = /INSERT\s+INTO\s+`?(\w+)`?\s*(?:\(([^)]+)\))?\s*VALUES\s*\(([^;]+)\)\s*;/gis;
  while ((m = insertRe.exec(text))) {
    const [, table, colsRaw, valuesRaw] = m;
    if (!tables.has(table)) tables.set(table, { headers: [], rows: [] });
    const entry = tables.get(table);
    if (colsRaw && entry.headers.length === 0) {
      entry.headers = colsRaw.split(",").map((c) => c.trim().replace(/`/g, ""));
    }
    // naive split on top-level commas (values are simple literals in our own export)
    const values =
      valuesRaw.match(/'(?:[^'\\]|\\.)*'|[^,]+/g)?.map((v) => {
        const t = v.trim();
        if (t.toUpperCase() === "NULL") return null;
        if (/^'.*'$/.test(t)) return t.slice(1, -1).replace(/''/g, "'");
        const n = Number(t);
        return Number.isNaN(n) ? t : n;
      }) ?? [];
    entry.rows.push(values);
  }

  return [...tables.entries()].map(([name, { headers, rows }]) => ({
    name,
    headers: headers.length ? headers : rows[0]?.map((_, i) => `col_${i + 1}`) ?? [],
    rows,
  }));
}

async function parseToTables(file, fromExt) {
  if (fromExt === "xlsx") {
    const XLSX = await loadXlsx();
    const buf = await file.arrayBuffer();
    const workbook = XLSX.read(buf, { type: "array" });
    return workbook.SheetNames.map((name) => sheetToTable(XLSX, workbook.Sheets[name], name)).filter(
      (t) => t.rows.length || t.headers.length
    );
  }

  if (fromExt === "csv") {
    const XLSX = await loadXlsx();
    const text = await file.text();
    const workbook = XLSX.read(text, { type: "string" });
    const name = workbook.SheetNames[0];
    return [sheetToTable(XLSX, workbook.Sheets[name], baseName(file.name) || name)];
  }

  if (fromExt === "json") {
    const text = await file.text();
    const data = JSON.parse(text);
    const toTable = (name, arr) => {
      const rowsArr = Array.isArray(arr) ? arr : [arr];
      const headerSet = new Set();
      rowsArr.forEach((obj) => obj && typeof obj === "object" && Object.keys(obj).forEach((k) => headerSet.add(k)));
      const headers = [...headerSet];
      const rows = rowsArr.map((obj) => headers.map((h) => (obj ? obj[h] ?? null : null)));
      return { name, headers, rows };
    };
    if (Array.isArray(data)) return [toTable(baseName(file.name) || "table", data)];
    const values = Object.values(data);
    const isMultiTable = values.length > 0 && values.every((v) => Array.isArray(v));
    if (isMultiTable) return Object.entries(data).map(([name, arr]) => toTable(name, arr));
    return [toTable(baseName(file.name) || "table", data)];
  }

  if (fromExt === "sql") {
    return parseSqlToTables(await file.text());
  }

  throw new Error(`Don't know how to read .${fromExt} files.`);
}

function tablesToXlsxBlob(XLSX, tables) {
  const workbook = XLSX.utils.book_new();
  if (!tables.length) {
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([["No data found"]]), "Sheet1");
  } else {
    tables.forEach(({ name, headers, rows }) => {
      const sheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
      XLSX.utils.book_append_sheet(workbook, sheet, (name || "Sheet1").slice(0, 31));
    });
  }
  const out = XLSX.write(workbook, { type: "array", bookType: "xlsx" });
  return new Blob([out], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}

function tablesToCsvBlob(XLSX, tables) {
  // CSV is inherently single-table — export the first sheet/table found.
  const { headers = [], rows = [] } = tables[0] || {};
  const sheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  return new Blob([XLSX.utils.sheet_to_csv(sheet)], { type: "text/csv" });
}

function tablesToJsonBlob(tables) {
  const toObjects = ({ headers, rows }) => rows.map((row) => Object.fromEntries(headers.map((h, i) => [h, row[i] ?? null])));
  const payload = tables.length === 1 ? toObjects(tables[0]) : Object.fromEntries(tables.map((t) => [t.name, toObjects(t)]));
  return new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
}

function tablesToSqlBlob(tables) {
  const chunks = [];
  tables.forEach(({ name, headers, rows }) => {
    const tableName = (name || "table1").replace(/[^a-zA-Z0-9_]/g, "_").toLowerCase() || "table1";
    const cols = headers.map((h, i) => (h ? String(h).replace(/[^a-zA-Z0-9_]/g, "_") : `col_${i + 1}`));
    chunks.push(`-- Table generated from "${name}"`);
    chunks.push(`CREATE TABLE IF NOT EXISTS \`${tableName}\` (`);
    chunks.push(cols.map((c) => `  \`${c}\` TEXT`).join(",\n"));
    chunks.push(`);\n`);
    rows.forEach((row) => {
      const values = cols.map((_, i) => sqlLiteral(row[i]));
      chunks.push(`INSERT INTO \`${tableName}\` (${cols.map((c) => `\`${c}\``).join(", ")}) VALUES (${values.join(", ")});`);
    });
    chunks.push("");
  });
  return new Blob([chunks.join("\n") || "-- No data to export.\n"], { type: "application/sql" });
}

async function convertSpreadsheet(file, fromExt, toExt, onProgress) {
  onProgress?.(15);
  const tables = await parseToTables(file, fromExt);
  onProgress?.(60);

  let blob;
  if (toExt === "xlsx" || toExt === "csv") {
    const XLSX = await loadXlsx();
    blob = toExt === "xlsx" ? tablesToXlsxBlob(XLSX, tables) : tablesToCsvBlob(XLSX, tables);
  } else if (toExt === "json") {
    blob = tablesToJsonBlob(tables);
  } else if (toExt === "sql") {
    blob = tablesToSqlBlob(tables);
  } else {
    throw new Error(`Don't know how to write .${toExt} files.`);
  }
  onProgress?.(100);
  return blob;
}

/* --------------------- Documents, Video, Audio (cloud) -------------------
   Goes through our FastAPI backend, which converts locally (ffmpeg /
   LibreOffice / Poppler — no third-party API). Uses XMLHttpRequest (not
   fetch) specifically for `xhr.upload.onprogress` — the only way to get a
   real upload progress signal in the browser. There's no equivalent
   signal for the server-side conversion step, so progress eases forward
   there instead of claiming a percentage we don't have. */

function postToBackend(path, extraFields, file, fallbackFilename, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${API_BASE}${path}`);
    xhr.responseType = "blob";

    let reported = 0;
    const report = (pct) => {
      reported = Math.max(reported, pct);
      onProgress?.(reported);
    };

    let creeper;
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) report(Math.round((e.loaded / e.total) * 45));
    };
    xhr.upload.onload = () => {
      report(50);
      creeper = setInterval(() => report(Math.min(reported + 3, 88)), 400);
    };

    xhr.onload = () => {
      clearInterval(creeper);
      if (xhr.status >= 200 && xhr.status < 300) {
        report(100);
        const disposition = xhr.getResponseHeader("Content-Disposition") || "";
        const match = /filename\*?=(?:UTF-8'')?"?([^;"]+)"?/i.exec(disposition);
        const filename = match ? decodeURIComponent(match[1].replace(/"$/, "")) : fallbackFilename;
        resolve({ blob: xhr.response, filename });
        return;
      }
      // Error responses are JSON ({"detail": "..."}), but responseType is
      // "blob" for the success path, so re-read the body as text.
      const reader = new FileReader();
      reader.onload = () => {
        let message = `Server returned ${xhr.status}.`;
        try {
          message = JSON.parse(reader.result)?.detail || message;
        } catch {
          /* body wasn't JSON — keep the generic message */
        }
        reject(new Error(message));
      };
      reader.onerror = () => reject(new Error(`Server returned ${xhr.status}.`));
      reader.readAsText(xhr.response);
    };

    xhr.onerror = () => {
      clearInterval(creeper);
      reject(new Error(`Could not reach the conversion server at ${API_BASE}. Is it running? See server/README.md.`));
    };

    const form = new FormData();
    form.append("file", file, file.name);
    form.append("filename", file.name);
    for (const [key, value] of Object.entries(extraFields)) form.append(key, value);
    report(2);
    xhr.send(form);
  });
}

function convertViaCloud(file, toExt, onProgress) {
  return postToBackend("/api/convert", { to_ext: toExt }, file, `${baseName(file.name)}.${toExt}`, onProgress);
}

function compressViaCloud(file, category, level, onProgress) {
  return postToBackend("/api/compress", { category, level }, file, file.name, onProgress);
}

/* --------------------------------- API ----------------------------------- */

export async function runConversion({ file, category, fromExt, toExt, onProgress }) {
  onProgress?.(2);

  if (category.mode === "cloud") {
    return convertViaCloud(file, toExt, onProgress);
  }

  let blob;
  if (category.id === "images") {
    blob = await convertImage(file, toExt, onProgress);
  } else if (category.id === "spreadsheets") {
    blob = await convertSpreadsheet(file, fromExt, toExt, onProgress);
  } else {
    throw new Error(`No client-side converter registered for "${category.id}".`);
  }

  return { blob, filename: `${baseName(file.name)}.${toExt}` };
}

export async function runCompression({ file, category, toExt, quality, maxDimension, level, onProgress }) {
  onProgress?.(2);

  if (category.id === "images") {
    const blob = await compressImage(file, toExt, quality, maxDimension, onProgress);
    return { blob, filename: `${baseName(file.name)}-compressed.${toExt}` };
  }

  return compressViaCloud(file, category.id, level, onProgress);
}

export function triggerDownload(blob, filename) {
  download(blob, filename);
}

export function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
