import { FileText, Table, Image, Video, Music } from "lucide-react";
import { CATEGORIES } from "../lib/converters.js";

const ICONS = { FileText, Table, Image, Video, Music };

export default function FeatureGrid() {
  return (
    <section className="section" id="formats" style={{ paddingTop: 0 }}>
      <div className="container">
        <div className="section-heading">
          <h2 className="display-lg">Five categories, any direction</h2>
          <p>Pick a category, choose From and To, tap the swap icon whenever you'd rather go the other way.</p>
        </div>
        <div className="feature-grid">
          {CATEGORIES.map((c) => {
            const Icon = ICONS[c.icon];
            return (
              <div className="feature-card" key={c.id}>
                <div className="feature-card-icon">
                  <Icon size={20} />
                </div>
                <h3>{c.label}</h3>
                <p>{c.description}</p>
                <p className="caption" style={{ marginTop: "var(--space-xs)" }}>
                  {c.formats
                    .slice(0, 4)
                    .map((f) => f.label)
                    .join(" ⇄ ")}
                  {c.formats.length > 4 ? ` +${c.formats.length - 4} more` : ""}
                </p>
                <span className="badge-pill">
                  <span className={`mode-dot ${c.mode}`} style={{ marginRight: 2 }} />
                  {c.mode === "live" ? "Live" : "Cloud"}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
