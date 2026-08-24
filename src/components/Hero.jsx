import { FileText, Table, Image, Video, ArrowRight } from "lucide-react";

const PAIRS = [
  { Icon: FileText, from: "PDF", to: "DOCX" },
  { Icon: Table, from: "XLSX", to: "SQL" },
  { Icon: Image, from: "JPG", to: "PNG" },
  { Icon: Video, from: "MP4", to: "MOV" },
];

export default function Hero() {
  return (
    <section className="hero" id="top">
      <div className="container hero-grid">
        <div className="hero-copy">
          <h1 className="display-xl">Convert any file. Right in your browser.</h1>
          <p>
            PDF ⇄ Word, Excel ⇄ SQL, JPEG ⇄ PNG, MP4 ⇄ MOV — one clean tool for
            the formats you convert most. No account, no upload to a stranger's
            server for the formats marked <em>live</em>.
          </p>
          <div className="hero-actions">
            <a href="#converter" className="btn btn-primary">
              Convert a file
            </a>
            <a href="#formats" className="btn btn-secondary">
              See supported formats
            </a>
          </div>
        </div>

        <div
          style={{
            background: "var(--color-surface-dark)",
            borderRadius: "var(--radius-xl)",
            padding: "var(--space-xl)",
            color: "var(--color-on-dark)",
          }}
        >
          <p className="caption-uppercase" style={{ color: "var(--color-on-dark-soft)", marginBottom: "var(--space-md)" }}>
            Supported today
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-sm)" }}>
            {PAIRS.map(({ Icon, from, to }) => (
              <div
                key={from}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "var(--space-sm)",
                  background: "var(--color-surface-dark-elevated)",
                  borderRadius: "var(--radius-md)",
                  padding: "10px 14px",
                }}
              >
                <Icon size={18} color="var(--color-accent-lime)" />
                <span style={{ fontFamily: "var(--font-code)", fontSize: 14 }}>{from}</span>
                <ArrowRight size={14} color="var(--color-on-dark-soft)" />
                <span style={{ fontFamily: "var(--font-code)", fontSize: 14 }}>{to}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
