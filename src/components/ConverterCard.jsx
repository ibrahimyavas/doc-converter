import { useRef, useState } from "react";
import {
  FileText,
  Table,
  Image,
  Video,
  UploadCloud,
  X,
  Download,
  RefreshCw,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Info,
} from "lucide-react";
import { CATEGORIES, runConversion, triggerDownload, formatBytes } from "../lib/converters.js";

const ICONS = { FileText, Table, Image, Video };

export default function ConverterCard() {
  const [categoryId, setCategoryId] = useState(CATEGORIES[0].id);
  const [flipped, setFlipped] = useState(false);
  const [file, setFile] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [status, setStatus] = useState("idle"); // idle | converting | done | error
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const inputRef = useRef(null);

  const category = CATEGORIES.find((c) => c.id === categoryId);
  const fromIdx = flipped ? 1 : 0;
  const toIdx = flipped ? 0 : 1;
  const fromLabel = category.pair[fromIdx];
  const toLabel = category.pair[toIdx];
  const fromExt = category.extPair[fromIdx];
  const toExt = category.extPair[toIdx];
  const accept = category.acceptPair[fromIdx];

  function resetTool() {
    setFile(null);
    setStatus("idle");
    setProgress(0);
    setResult(null);
    setError("");
  }

  function selectCategory(id) {
    setCategoryId(id);
    setFlipped(false);
    resetTool();
  }

  function flip() {
    setFlipped((f) => !f);
    resetTool();
  }

  function handleFile(f) {
    if (!f) return;
    setFile(f);
    setStatus("idle");
    setResult(null);
    setError("");
  }

  function onDrop(e) {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files?.[0];
    handleFile(f);
  }

  async function convert() {
    setStatus("converting");
    setProgress(0);
    setError("");
    try {
      const out = await runConversion({
        file,
        category,
        fromExt,
        toExt,
        onProgress: setProgress,
      });
      setResult(out);
      setStatus("done");
    } catch (err) {
      setError(err?.message || "Something went wrong during conversion.");
      setStatus("error");
    }
  }

  return (
    <section className="section" id="converter">
      <div className="container" style={{ maxWidth: 720 }}>
        <div className="converter-card">
          <div className="category-tabs">
            {CATEGORIES.map((c) => {
              const Icon = ICONS[c.icon];
              return (
                <button
                  key={c.id}
                  className={`category-tab ${c.id === categoryId ? "active" : ""}`}
                  onClick={() => selectCategory(c.id)}
                >
                  <Icon size={15} />
                  {c.label}
                </button>
              );
            })}
          </div>

          <div className="direction-row">
            <span className="format-pill">{fromLabel}</span>
            <button className="swap-btn" onClick={flip} aria-label="Swap direction" title="Swap direction">
              <RefreshCw size={16} />
            </button>
            <span className="format-pill">{toLabel}</span>
          </div>

          <div className="mode-badge">
            <span className={`mode-dot ${category.mode}`} />
            {category.mode === "live"
              ? "Live conversion — runs entirely in your browser, nothing is uploaded"
              : "Cloud conversion — processed by our conversion server"}
          </div>

          {!file && (
            <label
              className={`dropzone ${dragging ? "dragging" : ""}`}
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
            >
              <UploadCloud size={28} className="dropzone-icon" />
              <div className="title-sm" style={{ marginBottom: 4 }}>
                Drop a {fromLabel} file here, or click to browse
              </div>
              <div className="body-sm" style={{ color: "var(--color-muted)" }}>
                Accepted: {accept.replaceAll(",", ", ")}
              </div>
              <input
                ref={inputRef}
                type="file"
                accept={accept}
                onChange={(e) => handleFile(e.target.files?.[0])}
              />
            </label>
          )}

          {file && status !== "done" && (
            <div className="file-row">
              <div className="file-row-info">
                <FileText size={20} color="var(--color-muted)" />
                <div style={{ minWidth: 0 }}>
                  <div className="file-row-name">{file.name}</div>
                  <div className="file-row-meta">{formatBytes(file.size)}</div>
                </div>
              </div>
              {status !== "converting" && (
                <button className="btn-icon-circular" onClick={resetTool} aria-label="Remove file">
                  <X size={16} />
                </button>
              )}
            </div>
          )}

          {status === "converting" && (
            <div>
              <div className="progress-track">
                <div className="progress-fill" style={{ width: `${progress}%` }} />
              </div>
              <div className="progress-label">
                <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <Loader2 size={14} className="spin" /> Converting…
                </span>
                <span>{progress}%</span>
              </div>
            </div>
          )}

          {status === "error" && (
            <div className="error-banner">
              <AlertTriangle size={14} style={{ marginRight: 6, verticalAlign: -2 }} />
              {error}
            </div>
          )}

          {status === "done" && result && (
            <div className="result-card">
              <div className="result-info">
                <CheckCircle2 size={20} color="var(--color-success)" />
                <div>
                  <div className="file-row-name">{result.filename}</div>
                  <div className="file-row-meta">{formatBytes(result.blob.size)} · ready to download</div>
                </div>
              </div>
              <button className="btn btn-primary" onClick={() => triggerDownload(result.blob, result.filename)}>
                <Download size={16} /> Download
              </button>
            </div>
          )}

          {category.mode === "cloud" && (
            <div className="note-banner">
              <Info size={14} style={{ marginTop: 2, flexShrink: 0 }} />
              <span>
                This pair uploads your file to our conversion server, which calls CloudConvert and streams the result
                straight back — nothing is stored. If it fails with a 501, the server is running but needs a
                CloudConvert API key (see <code style={{ fontFamily: "var(--font-code)" }}>server/README.md</code>).
              </span>
            </div>
          )}

          <div className="actions-row">
            {status === "done" && (
              <button className="btn btn-text-link" onClick={resetTool}>
                Convert another file
              </button>
            )}
            {status !== "done" && file && status !== "converting" && (
              <button className="btn btn-primary" onClick={convert}>
                Convert to {toLabel}
              </button>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
