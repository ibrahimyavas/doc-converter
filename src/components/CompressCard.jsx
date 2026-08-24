import { useRef, useState } from "react";
import {
  FileText,
  Image,
  Video,
  UploadCloud,
  X,
  Download,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Info,
} from "lucide-react";
import { COMPRESS_CATEGORIES, runCompression, triggerDownload, formatBytes } from "../lib/converters.js";

const ICONS = { FileText, Image, Video };
const MAX_DIMENSIONS = [
  { value: 0, label: "Original size" },
  { value: 1920, label: "Max 1920px" },
  { value: 1280, label: "Max 1280px" },
  { value: 800, label: "Max 800px" },
];

export default function CompressCard() {
  const [categoryId, setCategoryId] = useState(COMPRESS_CATEGORIES[0].id);
  const category = COMPRESS_CATEGORIES.find((c) => c.id === categoryId);

  const [toExt, setToExt] = useState(category.outputFormats?.[0]?.ext);
  const [quality, setQuality] = useState(70);
  const [maxDimension, setMaxDimension] = useState(0);
  const [level, setLevel] = useState("light");

  const [file, setFile] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [status, setStatus] = useState("idle"); // idle | compressing | done | error
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const inputRef = useRef(null);

  function resetTool() {
    setFile(null);
    setStatus("idle");
    setProgress(0);
    setResult(null);
    setError("");
  }

  function selectCategory(id) {
    const next = COMPRESS_CATEGORIES.find((c) => c.id === id);
    setCategoryId(id);
    setToExt(next.outputFormats?.[0]?.ext);
    setLevel("light");
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
    handleFile(e.dataTransfer.files?.[0]);
  }

  async function compress() {
    setStatus("compressing");
    setProgress(0);
    setError("");
    try {
      const out = await runCompression({
        file,
        category,
        toExt,
        quality: quality / 100,
        maxDimension: maxDimension || undefined,
        level,
        onProgress: setProgress,
      });
      setResult(out);
      setStatus("done");
    } catch (err) {
      setError(err?.message || "Something went wrong during compression.");
      setStatus("error");
    }
  }

  const savings = result && file ? Math.round((1 - result.blob.size / file.size) * 100) : null;

  return (
    <section className="section" id="compress" style={{ paddingTop: 0 }}>
      <div className="container" style={{ maxWidth: 720 }}>
        <div className="section-heading">
          <h2 className="display-lg">Shrink a file</h2>
          <p>Same format, smaller size — for images it never leaves your browser.</p>
        </div>

        <div className="converter-card">
          <div className="category-tabs">
            {COMPRESS_CATEGORIES.map((c) => {
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

          {category.id === "images" ? (
            <div className="compress-controls">
              <div className="compress-control">
                <label className="caption" htmlFor="compress-format">
                  Output format
                </label>
                <div className="format-select-wrap">
                  <select id="compress-format" className="format-select" value={toExt} onChange={(e) => setToExt(e.target.value)}>
                    {category.outputFormats.map((f) => (
                      <option key={f.ext} value={f.ext}>
                        {f.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="compress-control">
                <label className="caption" htmlFor="compress-quality">
                  Quality — {quality}%
                </label>
                <input
                  id="compress-quality"
                  type="range"
                  min="10"
                  max="95"
                  step="5"
                  value={quality}
                  onChange={(e) => setQuality(Number(e.target.value))}
                  className="quality-slider"
                />
              </div>
              <div className="compress-control">
                <label className="caption" htmlFor="compress-dimension">
                  Max dimension
                </label>
                <div className="format-select-wrap">
                  <select
                    id="compress-dimension"
                    className="format-select"
                    value={maxDimension}
                    onChange={(e) => setMaxDimension(Number(e.target.value))}
                  >
                    {MAX_DIMENSIONS.map((d) => (
                      <option key={d.value} value={d.value}>
                        {d.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          ) : (
            <div className="level-row">
              {["light", "strong"].map((l) => (
                <button key={l} className={`category-tab ${level === l ? "active" : ""}`} onClick={() => setLevel(l)}>
                  {l === "light" ? "Light compression" : "Strong compression"}
                </button>
              ))}
            </div>
          )}

          <div className="mode-badge">
            <span className={`mode-dot ${category.mode}`} />
            {category.mode === "live"
              ? "Live — runs entirely in your browser, nothing is uploaded"
              : "Cloud — processed by our conversion server"}
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
                Drop a {category.label} file here, or click to browse
              </div>
              <div className="body-sm" style={{ color: "var(--color-muted)" }}>
                Accepted: {category.accept.replaceAll(",", ", ")}
              </div>
              <input ref={inputRef} type="file" accept={category.accept} onChange={(e) => handleFile(e.target.files?.[0])} />
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
              {status !== "compressing" && (
                <button className="btn-icon-circular" onClick={resetTool} aria-label="Remove file">
                  <X size={16} />
                </button>
              )}
            </div>
          )}

          {status === "compressing" && (
            <div>
              <div className="progress-track">
                <div className="progress-fill" style={{ width: `${progress}%` }} />
              </div>
              <div className="progress-label">
                <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <Loader2 size={14} className="spin" /> Compressing…
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
                  <div className="file-row-meta">
                    {formatBytes(result.blob.size)}
                    {savings !== null && savings > 0 ? ` · ${savings}% smaller` : ""}
                  </div>
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
                This uploads your file to our conversion server, which calls CloudConvert and streams the result
                straight back — nothing is stored. Needs a CloudConvert API key on the backend (see{" "}
                <code style={{ fontFamily: "var(--font-code)" }}>server/README.md</code>).
              </span>
            </div>
          )}

          <div className="actions-row">
            {status === "done" && (
              <button className="btn btn-text-link" onClick={resetTool}>
                Compress another file
              </button>
            )}
            {status !== "done" && file && status !== "compressing" && (
              <button className="btn btn-primary" onClick={compress}>
                Compress
              </button>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
