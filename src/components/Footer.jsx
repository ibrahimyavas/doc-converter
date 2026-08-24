import SpikeMark from "./SpikeMark.jsx";

export default function Footer() {
  return (
    <footer className="footer">
      <div className="container">
        <div className="footer-top">
          <SpikeMark color="var(--color-on-dark)" />
          Convert
        </div>
        <div className="footer-grid">
          <div className="footer-col">
            <h4>Product</h4>
            <a href="#converter">Converter</a>
            <a href="#formats">Formats</a>
            <a href="#faq">FAQ</a>
          </div>
          <div className="footer-col">
            <h4>Formats</h4>
            <a href="#converter">Documents</a>
            <a href="#converter">Spreadsheets</a>
            <a href="#converter">Images</a>
            <a href="#converter">Video</a>
            <a href="#converter">Audio</a>
          </div>
          <div className="footer-col">
            <h4>Status</h4>
            <span className="body-sm" style={{ color: "var(--color-on-dark-soft)" }}>
              2 categories live in-browser, 3 via cloud
            </span>
          </div>
          <div className="footer-col">
            <h4>Legal</h4>
            <a href="#top">Privacy</a>
            <a href="#top">Terms</a>
          </div>
        </div>
        <div className="footer-bottom">© {new Date().getFullYear()} Convert. Built for a single afternoon of file wrangling.</div>
      </div>
    </footer>
  );
}
