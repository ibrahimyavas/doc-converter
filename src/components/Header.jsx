import SpikeMark from "./SpikeMark.jsx";
import ThemeToggle from "./ThemeToggle.jsx";

export default function Header() {
  return (
    <header className="top-nav">
      <div className="container" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%" }}>
        <a href="#top" className="brand" style={{ textDecoration: "none" }}>
          <SpikeMark />
          Convert
        </a>
        <nav className="nav-links">
          <a href="#converter">Converter</a>
          <a href="#compress">Compress</a>
          <a href="#study">Study</a>
          <a href="#formats">Formats</a>
          <a href="#faq">FAQ</a>
        </nav>
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-sm)" }}>
          <ThemeToggle />
          <a href="#converter" className="btn btn-primary">
            Start converting
          </a>
        </div>
      </div>
    </header>
  );
}
