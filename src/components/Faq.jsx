const ITEMS = [
  {
    q: "Do my files leave my computer?",
    a: "For the formats marked \"Live\" (Excel ⇄ SQL, JPEG ⇄ PNG) — no, everything runs in this browser tab. For \"Cloud\" pairs (PDF ⇄ Word, MP4 ⇄ MOV) your file is uploaded to our conversion server, converted via CloudConvert, and the result is streamed straight back — nothing is stored afterward.",
  },
  {
    q: "How does the cloud conversion work?",
    a: "PDF/Word and MP4/MOV need heavier tooling than a browser can run — a document engine and ffmpeg respectively. Those two pairs route through a small FastAPI server we run, which calls the CloudConvert API and streams the converted file back to you.",
  },
  {
    q: "What happens to my Excel formulas when converting to SQL?",
    a: "Each sheet becomes a table: the first row becomes column names, and every following row becomes an INSERT statement. Computed values are exported, not formulas.",
  },
  {
    q: "Is there a file size limit?",
    a: "Live conversions are limited by your browser's available memory rather than a fixed cap — very large spreadsheets or images may take longer to process.",
  },
];

export default function Faq() {
  return (
    <section className="section" id="faq" style={{ paddingTop: 0 }}>
      <div className="container" style={{ maxWidth: 760 }}>
        <div className="section-heading">
          <h2 className="display-lg">Questions</h2>
        </div>
        {ITEMS.map((item) => (
          <div className="faq-item" key={item.q}>
            <h3>{item.q}</h3>
            <p>{item.a}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
