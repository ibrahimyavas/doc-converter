import { useRef, useState } from "react";
import { FileText, UploadCloud, X, Loader2, AlertTriangle, Sparkles, Copy, Check } from "lucide-react";
import { extractPdfText, generateStudyContent } from "../lib/study.js";
import { formatBytes } from "../lib/converters.js";

const MODES = [
  { id: "summary", label: "Summary" },
  { id: "study_guide", label: "Study guide" },
  { id: "flashcards", label: "Flashcards" },
];

// Tiny markdown-lite renderer for the summary/study-guide prose the model
// returns (headings, bullets, **bold**) — not pulling in a markdown
// dependency for a handful of tag types.
function renderMarkdownLite(text) {
  const lines = text.split("\n");
  const blocks = [];
  let list = null;

  const flushList = () => {
    if (list) {
      blocks.push(
        <ul key={`list-${blocks.length}`} style={{ margin: "0 0 12px", paddingLeft: 20 }}>
          {list.map((item, i) => (
            <li key={i} style={{ marginBottom: 4 }}>
              {renderInline(item)}
            </li>
          ))}
        </ul>
      );
      list = null;
    }
  };

  lines.forEach((raw, i) => {
    const line = raw.trim();
    if (!line) {
      flushList();
      return;
    }
    // Matches any markdown heading depth (#, ##, ###, ...) — the model
    // isn't shy about going to ### for subsections, and anything past ##
    // was previously falling through to plain-paragraph rendering with
    // the literal "###" left in the text.
    const heading = /^(#{1,6})\s+(.*)$/.exec(line);
    if (heading) {
      flushList();
      const depth = heading[1].length;
      blocks.push(
        <h4
          key={i}
          className={depth >= 3 ? "title-md" : undefined}
          style={{ marginBottom: 6, marginTop: blocks.length ? 16 : 0 }}
        >
          {renderInline(heading[2])}
        </h4>
      );
    } else if (line.startsWith("- ") || line.startsWith("* ")) {
      list = list || [];
      list.push(line.slice(2));
    } else {
      flushList();
      blocks.push(
        <p key={i} style={{ marginBottom: 10 }}>
          {renderInline(line)}
        </p>
      );
    }
  });
  flushList();
  return blocks;
}

function renderInline(text) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) =>
    part.startsWith("**") && part.endsWith("**") ? <strong key={i}>{part.slice(2, -2)}</strong> : part
  );
}

function parseFlashcards(text) {
  const cards = [];
  const re = /Q:\s*([\s\S]*?)\nA:\s*([\s\S]*?)(?=\nQ:|$)/g;
  let m;
  while ((m = re.exec(text))) {
    cards.push({ q: m[1].trim(), a: m[2].trim() });
  }
  return cards.length ? cards : null;
}

function StudyResult({ mode, text }) {
  const [copied, setCopied] = useState(false);
  const cards = mode === "flashcards" ? parseFlashcards(text) : null;

  function copy() {
    navigator.clipboard?.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="result-card" style={{ flexDirection: "column", alignItems: "stretch", gap: "var(--space-md)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span className="title-sm">{MODES.find((m) => m.id === mode)?.label}</span>
        <button className="btn-icon-circular" onClick={copy} aria-label="Copy to clipboard" title="Copy to clipboard">
          {copied ? <Check size={16} /> : <Copy size={16} />}
        </button>
      </div>
      {cards ? (
        <div style={{ display: "grid", gap: "var(--space-sm)" }}>
          {cards.map((c, i) => (
            <div key={i} style={{ background: "var(--color-canvas)", borderRadius: "var(--radius-md)", padding: "var(--space-md)" }}>
              <div style={{ fontWeight: 600, marginBottom: 6 }}>{c.q}</div>
              <div className="body-sm">{c.a}</div>
            </div>
          ))}
        </div>
      ) : (
        <div className="body-sm">{renderMarkdownLite(text)}</div>
      )}
    </div>
  );
}

export default function StudyCard() {
  const [mode, setMode] = useState("summary");
  const [file, setFile] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [status, setStatus] = useState("idle"); // idle | working | done | error
  const [progress, setProgress] = useState(0);
  const [stage, setStage] = useState("");
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const inputRef = useRef(null);

  function resetTool() {
    setFile(null);
    setStatus("idle");
    setProgress(0);
    setStage("");
    setResult(null);
    setError("");
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

  async function generate() {
    setStatus("working");
    setProgress(0);
    setError("");
    try {
      setStage("Reading PDF…");
      const text = await extractPdfText(file, setProgress);
      if (!text.trim()) {
        throw new Error("Couldn't find any text in that PDF — it may be a scanned image without a text layer.");
      }
      setStage("Asking the AI…");
      const content = await generateStudyContent(text, mode, setProgress);
      setResult(content);
      setStatus("done");
    } catch (err) {
      setError(err?.message || "Something went wrong.");
      setStatus("error");
    }
  }

  return (
    <section className="section" id="study" style={{ paddingTop: 0 }}>
      <div className="container" style={{ maxWidth: 720 }}>
        <div className="section-heading">
          <h2 className="display-lg">Study a PDF</h2>
          <p>Extract the text in your browser, then ask an AI for a summary, study guide, or flashcards.</p>
        </div>

        <div className="converter-card">
          <div className="level-row">
            {MODES.map((m) => (
              <button key={m.id} className={`category-tab ${mode === m.id ? "active" : ""}`} onClick={() => setMode(m.id)}>
                {m.label}
              </button>
            ))}
          </div>

          <div className="mode-badge">
            <span className="mode-dot ai" />
            AI — extracted text (not the PDF file) is sent to our server, which asks a model via OmniRoute
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
                Drop a PDF here, or click to browse
              </div>
              <div className="body-sm" style={{ color: "var(--color-muted)" }}>
                Accepted: .pdf
              </div>
              <input ref={inputRef} type="file" accept=".pdf" onChange={(e) => handleFile(e.target.files?.[0])} />
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
              {status !== "working" && (
                <button className="btn-icon-circular" onClick={resetTool} aria-label="Remove file">
                  <X size={16} />
                </button>
              )}
            </div>
          )}

          {status === "working" && (
            <div>
              <div className="progress-track">
                <div className="progress-fill" style={{ width: `${progress}%` }} />
              </div>
              <div className="progress-label">
                <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <Loader2 size={14} className="spin" /> {stage}
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

          {status === "done" && result && <StudyResult mode={mode} text={result} />}

          <div className="note-banner">
            <Sparkles size={14} style={{ marginTop: 2, flexShrink: 0 }} />
            <span>
              Runs through OmniRoute, a self-hosted AI gateway — if it fails with a 501, the backend needs an
              OMNIROUTE_API_KEY (see <code style={{ fontFamily: "var(--font-code)" }}>server/README.md</code>).
            </span>
          </div>

          <div className="actions-row">
            {status === "done" && (
              <button className="btn btn-text-link" onClick={resetTool}>
                Study another file
              </button>
            )}
            {status !== "done" && file && status !== "working" && (
              <button className="btn btn-primary" onClick={generate}>
                Generate {MODES.find((m) => m.id === mode)?.label.toLowerCase()}
              </button>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
