import { FileText, Table, Image, Video } from "lucide-react";
import { CATEGORIES } from "../lib/converters.js";

const ICONS = { FileText, Table, Image, Video };

export default function FeatureGrid() {
  return (
    <section className="section" id="formats" style={{ paddingTop: 0 }}>
      <div className="container">
        <div className="section-heading">
          <h2 className="display-lg">Four format pairs, one workflow</h2>
          <p>Every category converts both directions from the same card — just tap the swap icon.</p>
        </div>
        <div className="feature-grid">
          {CATEGORIES.map((c) => {
            const Icon = ICONS[c.icon];
            return (
              <div className="feature-card" key={c.id}>
                <div className="feature-card-icon">
                  <Icon size={20} />
                </div>
                <h3>
                  {c.pair[0]} ⇄ {c.pair[1]}
                </h3>
                <p>{c.description}</p>
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
