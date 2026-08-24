const ITEMS = [
  {
    q: "Do my files leave my computer?",
    a: "For the categories marked \"Live\" (Spreadsheets, Images) — no, everything runs in this browser tab. For \"Cloud\" categories (Documents, Video, Audio) your file is uploaded to our conversion server, converted via CloudConvert, and the result is streamed straight back — nothing is stored afterward.",
  },
  {
    q: "How does the cloud conversion work?",
    a: "Documents, video, and audio need heavier tooling than a browser can run — a document engine and ffmpeg respectively. Those categories route through a small FastAPI server we run, which calls the CloudConvert API and streams the converted file back to you.",
  },
  {
    q: "What happens to my Excel formulas when converting to SQL, CSV, or JSON?",
    a: "Each sheet becomes a table: the first row becomes column names, and every following row becomes a record. Computed values are exported, not formulas.",
  },
  {
    q: "Why can I only pick two formats at a time instead of converting between all four in a category?",
    a: "You're not limited to two — every format in a category converts to every other one. The From/To dropdowns just show the two currently selected; change either one to pick a different pair, or tap swap to flip direction.",
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
