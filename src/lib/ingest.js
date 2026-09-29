import { extractPptx } from "./pptx";

const clean = (value) => value.replace(/\u0000/g, "").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();

export async function extractFile(file) {
  const ext = file.name.split(".").pop()?.toLowerCase();
  let text = "";
  let summary = "";
  if (["txt", "md", "rtf"].includes(ext)) {
    text = await file.text();
  } else if (["html", "htm"].includes(ext)) {
    const html = await file.text();
    text = new DOMParser().parseFromString(html, "text/html").body?.innerText || "";
  } else if (ext === "docx") {
    const mammoth = await import("mammoth/mammoth.browser");
    const result = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
    text = result.value;
  } else if (ext === "pdf") {
    const [pdfjs, worker] = await Promise.all([import("pdfjs-dist"), import("pdfjs-dist/build/pdf.worker.min.mjs?url")]);
    pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
    const pdf = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
    const pages = [];
    for (let pageNumber = 1; pageNumber <= Math.min(pdf.numPages, 60); pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const content = await page.getTextContent();
      pages.push(content.items.map((item) => item.str).join(" "));
    }
    text = pages.join("\n");
  } else if (ext === "pptx") {
    const deck = await extractPptx(await file.arrayBuffer());
    text = deck.text;
    summary = `${deck.slideCount} slides${deck.notesCount ? ` · speaker notes on ${deck.notesCount}` : ""}`;
  } else if (["ppt", "key", "odp"].includes(ext)) {
    throw new Error(ext === "key"
      ? "Keynote files can't be read directly. In Keynote, choose File › Export To › PowerPoint, then upload the .pptx."
      : "That's an older presentation format. Open it and choose Save As › PowerPoint Presentation (.pptx), then upload that copy.");
  } else {
    throw new Error("Use PowerPoint, PDF, Word, HTML, TXT, Markdown, or RTF.");
  }
  text = clean(text);
  if (text.length < 20) throw new Error("I could not find enough readable text in that file.");
  return { name: file.name, text: text.slice(0, 80_000), characters: text.length, summary };
}

export async function extractUrl(url) {
  const response = await fetch("/api/extract-url", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ url }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || "I could not read that link.");
  return body;
}

// Older formats are accepted by the picker only so the reader can explain how
// to convert them, instead of the file silently greying out.
// Extensions alone leave valid files greyed out in some file pickers, so the
// matching media types are listed too.
export const acceptedFiles = [
  ".pptx", "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  ".pdf", "application/pdf",
  ".docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".html", ".htm", "text/html",
  ".txt", "text/plain",
  ".md", "text/markdown",
  ".rtf", "application/rtf", "text/rtf",
  ".ppt", ".key", ".odp",
].join(",");
