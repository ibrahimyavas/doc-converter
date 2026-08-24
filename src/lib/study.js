// Client-side PDF text extraction (pdf.js) + a call to our backend, which
// forwards the extracted text (never the PDF itself) to OmniRoute for a
// summary, study guide, or flashcard set.

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8787";

let _pdfjsPromise;
function loadPdfjs() {
  // pdfjs-dist is a few hundred KB — lazy-load it like xlsx, only when
  // someone actually opens the Study section.
  return (_pdfjsPromise ??= (async () => {
    const pdfjs = await import("pdfjs-dist");
    const workerUrl = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
    pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
    return pdfjs;
  })());
}

export async function extractPdfText(file, onProgress) {
  const pdfjs = await loadPdfjs();
  onProgress?.(10);

  const buf = await file.arrayBuffer();
  const doc = await pdfjs.getDocument({ data: buf }).promise;

  const pages = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    pages.push(content.items.map((item) => item.str).join(" "));
    onProgress?.(10 + Math.round((i / doc.numPages) * 60));
  }

  onProgress?.(75);
  return pages.join("\n\n").trim();
}

export async function generateStudyContent(text, mode, onProgress) {
  onProgress?.(80);
  const res = await fetch(`${API_BASE}/api/study`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, mode }),
  });

  onProgress?.(95);
  if (!res.ok) {
    let message = `Server returned ${res.status}.`;
    try {
      message = (await res.json())?.detail || message;
    } catch {
      /* body wasn't JSON — keep the generic message */
    }
    throw new Error(message);
  }

  const data = await res.json();
  onProgress?.(100);
  return data.result;
}
