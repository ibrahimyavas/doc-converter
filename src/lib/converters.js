// xlsx is ~500KB minified — load it lazily so JPEG/PNG and other pairs
// don't pay for it on first paint.
let _xlsxPromise;
function loadXlsx() {
  return (_xlsxPromise ??= import("xlsx"));
}

// Each category holds exactly one format pair; `flip` toggles direction.
// mode: "live"  = real conversion, runs fully in the browser, file never
//                 leaves the machine.
//       "cloud" = real conversion, but goes through our FastAPI backend
//                 (server/) which calls CloudConvert. The file is
//                 uploaded to that server for this pair only.
export const CATEGORIES = [
  {
    id: "documents",
    label: "Documents",
    icon: "FileText",
    pair: ["PDF", "Word"],
    extPair: ["pdf", "docx"],
    acceptPair: [".pdf", ".docx,.doc"],
    mode: "cloud",
    description: "PDF and Word, back and forth.",
  },
  {
    id: "spreadsheets",
    label: "Spreadsheets",
    icon: "Table",
    pair: ["Excel", "SQL"],
    extPair: ["xlsx", "sql"],
    acceptPair: [".xlsx,.xls,.csv", ".sql"],
    mode: "live",
    description: "Excel workbooks into INSERT statements, and back.",
  },
  {
    id: "images",
    label: "Images",
    icon: "Image",
    pair: ["JPEG", "PNG"],
    extPair: ["jpg", "png"],
    acceptPair: [".jpg,.jpeg", ".png"],
    mode: "live",
    description: "Lossless, pixel-accurate re-encoding in your browser.",
  },
  {
    id: "video",
    label: "Video",
    icon: "Video",
    pair: ["MP4", "MOV"],
    extPair: ["mp4", "mov"],
    acceptPair: [".mp4", ".mov"],
    mode: "cloud",
    description: "MP4 and MOV containers, both directions.",
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

function convertImage(file, toExt, onProgress) {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read the image file."));
    reader.onload = () => {
      onProgress?.(35);
      img.onload = () => {
        onProgress?.(65);
        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext("2d");
        if (toExt === "jpg") {
          // JPEG has no alpha channel — flatten onto white first.
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(0, 0, canvas.width, canvas.height);
        }
        ctx.drawImage(img, 0, 0);
        const mime = toExt === "jpg" ? "image/jpeg" : "image/png";
        canvas.toBlob(
          (blob) => {
            onProgress?.(100);
            if (!blob) return reject(new Error("Canvas export failed."));
            resolve(blob);
          },
          mime,
          0.92
        );
      };
      img.onerror = () => reject(new Error("Could not decode the image file."));
      img.src = reader.result;
    };
    onProgress?.(10);
    reader.readAsDataURL(file);
  });
}

/* ------------------------- Excel → SQL (live) --------------------------- */

function sqlLiteral(value) {
  if (value === null || value === undefined || value === "") return "NULL";
  if (typeof value === "number") return String(value);
  if (typeof value === "boolean") return value ? "1" : "0";
  return `'${String(value).replace(/'/g, "''")}'`;
}

async function convertExcelToSql(file, onProgress) {
  onProgress?.(10);
  const XLSX = await loadXlsx();
  const buf = await file.arrayBuffer();
  onProgress?.(30);
  const workbook = XLSX.read(buf, { type: "array" });
  onProgress?.(55);

  const chunks = [];
  workbook.SheetNames.forEach((sheetName) => {
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null, blankrows: false });
    if (!rows.length) return;

    const tableName = sheetName.replace(/[^a-zA-Z0-9_]/g, "_").toLowerCase() || "sheet1";
    const headers = rows[0].map((h, i) => (h ? String(h).replace(/[^a-zA-Z0-9_]/g, "_") : `col_${i + 1}`));
    const dataRows = rows.slice(1);

    chunks.push(`-- Table generated from sheet "${sheetName}"`);
    chunks.push(`CREATE TABLE IF NOT EXISTS \`${tableName}\` (`);
    chunks.push(headers.map((h) => `  \`${h}\` TEXT`).join(",\n"));
    chunks.push(`);\n`);

    dataRows.forEach((row) => {
      const values = headers.map((_, i) => sqlLiteral(row[i]));
      chunks.push(`INSERT INTO \`${tableName}\` (${headers.map((h) => `\`${h}\``).join(", ")}) VALUES (${values.join(", ")});`);
    });
    chunks.push("");
  });

  onProgress?.(90);
  const text = chunks.join("\n") || "-- The workbook had no rows to convert.\n";
  onProgress?.(100);
  return new Blob([text], { type: "application/sql" });
}

/* ------------------------- SQL → Excel (live) ---------------------------- */

async function convertSqlToExcel(file, onProgress) {
  onProgress?.(10);
  const XLSX = await loadXlsx();
  const text = await file.text();
  onProgress?.(30);

  const tables = new Map(); // tableName -> { headers: [], rows: [] }

  const createRe = /CREATE\s+TABLE[^(]*`?(\w+)`?\s*\(([^;]+)\)\s*;/gis;
  let m;
  while ((m = createRe.exec(text))) {
    const [, table, colsBlock] = m;
    const headers = colsBlock
      .split(",")
      .map((c) => c.trim().replace(/`/g, "").split(/\s+/)[0])
      .filter(Boolean);
    if (!tables.has(table)) tables.set(table, { headers, rows: [] });
  }
  onProgress?.(50);

  const insertRe = /INSERT\s+INTO\s+`?(\w+)`?\s*(?:\(([^)]+)\))?\s*VALUES\s*\(([^;]+)\)\s*;/gis;
  while ((m = insertRe.exec(text))) {
    const [, table, colsRaw, valuesRaw] = m;
    if (!tables.has(table)) tables.set(table, { headers: [], rows: [] });
    const entry = tables.get(table);
    if (colsRaw && entry.headers.length === 0) {
      entry.headers = colsRaw.split(",").map((c) => c.trim().replace(/`/g, ""));
    }
    // naive split on top-level commas (values are simple literals in our own export)
    const values = valuesRaw
      .match(/'(?:[^'\\]|\\.)*'|[^,]+/g)
      ?.map((v) => {
        const t = v.trim();
        if (t.toUpperCase() === "NULL") return null;
        if (/^'.*'$/.test(t)) return t.slice(1, -1).replace(/''/g, "'");
        const n = Number(t);
        return Number.isNaN(n) ? t : n;
      }) ?? [];
    entry.rows.push(values);
  }
  onProgress?.(75);

  const workbook = XLSX.utils.book_new();
  if (tables.size === 0) {
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([["No CREATE TABLE / INSERT statements found"]]), "Sheet1");
  } else {
    for (const [table, { headers, rows }] of tables) {
      const aoa = [headers.length ? headers : rows[0]?.map((_, i) => `col_${i + 1}`) ?? [], ...rows];
      const sheet = XLSX.utils.aoa_to_sheet(aoa);
      XLSX.utils.book_append_sheet(workbook, sheet, table.slice(0, 31));
    }
  }
  onProgress?.(92);
  const out = XLSX.write(workbook, { type: "array", bookType: "xlsx" });
  onProgress?.(100);
  return new Blob([out], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}

/* ----------------------- PDF⇄Word, MP4⇄MOV (cloud) ----------------------- */

// Goes through our FastAPI backend, which relays to CloudConvert. Uses
// XMLHttpRequest (not fetch) specifically for `xhr.upload.onprogress` — the
// only way to get a real upload progress signal in the browser. There's no
// equivalent signal for the server-side conversion step, so progress eases
// forward there instead of claiming a percentage we don't have.
function convertViaCloud(file, toExt, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${API_BASE}/api/convert`);
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
        const filename = match ? decodeURIComponent(match[1].replace(/"$/, "")) : `${baseName(file.name)}.${toExt}`;
        resolve({ blob: xhr.response, filename });
        return;
      }
      // Error responses are JSON ({"detail": "..."}), but responseType is
      // "blob" for the success path, so re-read the body as text.
      const reader = new FileReader();
      reader.onload = () => {
        let message = `Conversion server returned ${xhr.status}.`;
        try {
          message = JSON.parse(reader.result)?.detail || message;
        } catch {
          /* body wasn't JSON — keep the generic message */
        }
        reject(new Error(message));
      };
      reader.onerror = () => reject(new Error(`Conversion server returned ${xhr.status}.`));
      reader.readAsText(xhr.response);
    };

    xhr.onerror = () => {
      clearInterval(creeper);
      reject(new Error(`Could not reach the conversion server at ${API_BASE}. Is it running? See server/README.md.`));
    };

    const form = new FormData();
    form.append("file", file, file.name);
    form.append("filename", file.name);
    form.append("to_ext", toExt);
    report(2);
    xhr.send(form);
  });
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
  } else if (category.id === "spreadsheets" && toExt === "sql") {
    blob = await convertExcelToSql(file, onProgress);
  } else {
    blob = await convertSqlToExcel(file, onProgress);
  }

  return { blob, filename: `${baseName(file.name)}.${toExt}` };
}

export function triggerDownload(blob, filename) {
  download(blob, filename);
}

export function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
