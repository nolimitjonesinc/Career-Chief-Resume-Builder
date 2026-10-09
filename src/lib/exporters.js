const safeName = (value) => (value || "").trim().replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "") || "resume";

// Prompts shown in the on-screen working draft that must never reach a paid
// export. A buyer exporting before finishing the interview would otherwise
// pay for a file that says "Add your most recent role and accomplishments."
const PLACEHOLDERS = new Set([
  "Add your most recent role and accomplishments.",
  "Add earlier roles that strengthen this case.",
  "Add an accomplishment supported by your career history.",
  "Contact details",
  "Your name",
  "Professional title",
  "Education",
]);

// Returns the doc with placeholder prompts removed (same shape, "" for the
// gaps). The on-screen draft keeps its prompts; only exports are cleaned.
export function sanitizeDoc(doc) {
  const cleanField = (value) => {
    const text = (value ?? "").trim();
    return PLACEHOLDERS.has(text) ? "" : text;
  };
  return {
    name: cleanField(doc.name),
    title: cleanField(doc.title),
    contact: cleanField(doc.contact),
    summary: cleanField(doc.summary),
    current: cleanField(doc.current),
    tailored: cleanField(doc.tailored),
    earlier: cleanField(doc.earlier),
    education: cleanField(doc.education),
    skills: cleanField(doc.skills),
  };
}

const sections = (doc) => [["", doc.name], ["", doc.title], ["", doc.contact], ["", ""], ["", doc.summary], ["EXPERIENCE", doc.current], ["HIGHLIGHTS FOR THIS ROLE", doc.tailored], ["EARLIER EXPERIENCE", doc.earlier], ["EDUCATION", doc.education], ["CAPABILITIES", doc.skills]];
const escapeHtml = (value) => value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);

function save(blob, filename) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  window.setTimeout(() => { anchor.remove(); URL.revokeObjectURL(url); }, 400);
}

export async function exportResume(rawDoc, format) {
  const doc = sanitizeDoc(rawDoc);
  const filename = `${safeName(doc.name)}-resume`;
  if (format === "txt") {
    const text = sections(doc).filter(([, value]) => value).map(([heading, value]) => `${heading ? `${heading}\n` : ""}${value}`).join("\n\n");
    save(new Blob([text], { type: "text/plain;charset=utf-8" }), `${filename}.txt`);
    return;
  }
  if (format === "html") {
    const head = [
      doc.name ? `<h1>${escapeHtml(doc.name)}</h1>` : "",
      doc.title ? `<h2>${escapeHtml(doc.title)}</h2>` : "",
      doc.contact ? `<p class="contact">${escapeHtml(doc.contact)}</p>` : "",
      doc.summary ? `<p class="summary">${escapeHtml(doc.summary)}</p>` : "",
    ].join("");
    const sectionHtml = (heading, value, cls) => value ? `<h3>${heading}</h3><p${cls ? ` class="${cls}"` : ""}>${escapeHtml(value)}</p>` : "";
    const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${escapeHtml(doc.name || "Resume")}</title><style>body{max-width:760px;margin:48px auto;padding:0 28px;color:#17212b;font:15px/1.55 Arial,sans-serif}h1{font:42px/1.05 Georgia,serif;margin:0}h2{font:20px Georgia,serif;margin:5px 0}.contact{color:#65716c;font-size:12px}.summary{font-size:16px;margin:28px 0}h3{font:700 13px Georgia,serif;letter-spacing:.06em;border-top:1px solid #ccd4cf;padding-top:14px;margin-top:25px}p{white-space:pre-wrap}.tailored{border-left:3px solid #00624d;padding-left:12px}</style></head><body>${head}${sectionHtml("EXPERIENCE", doc.current)}${sectionHtml("HIGHLIGHTS FOR THIS ROLE", doc.tailored, "tailored")}${sectionHtml("EARLIER EXPERIENCE", doc.earlier)}${sectionHtml("EDUCATION", doc.education)}${sectionHtml("CAPABILITIES", doc.skills)}</body></html>`;
    save(new Blob([html], { type: "text/html;charset=utf-8" }), `${filename}.html`);
    return;
  }
  if (format === "docx") {
    const [{ Packer }, { buildDocx }] = await Promise.all([import("docx"), import("./docx-build.js")]);
    save(await Packer.toBlob(await buildDocx(doc)), `${filename}.docx`);
    return;
  }
  if (format === "pdf") {
    const { jsPDF } = await import("jspdf");
    const pdf = new jsPDF({ unit: "pt", format: "letter" });
    const margin = 56;
    const width = 612 - margin * 2;
    let y = 58;
    const write = (value, size = 11, bold = false, gap = 18) => {
      pdf.setFont("helvetica", bold ? "bold" : "normal");
      pdf.setFontSize(size);
      const lines = pdf.splitTextToSize(value, width);
      const lineHeight = size * 1.35;
      for (const line of lines) {
        if (y + lineHeight > 752) { pdf.addPage(); y = 58; }
        pdf.text(line, margin, y);
        y += lineHeight;
      }
      y += gap;
    };
    if (doc.name) write(doc.name, 24, true, 3);
    if (doc.title) write(doc.title, 13, true, 2);
    if (doc.contact) write(doc.contact, 9, false, 18);
    if (doc.summary) write(doc.summary, 11, false, 10);
    for (const [heading, value] of [["EXPERIENCE", doc.current], ["HIGHLIGHTS FOR THIS ROLE", doc.tailored], ["EARLIER EXPERIENCE", doc.earlier], ["EDUCATION", doc.education], ["CAPABILITIES", doc.skills]]) {
      if (!value) continue;
      write(heading, 10, true, 5); write(value, 10, false, 8);
    }
    save(pdf.output("blob"), `${filename}.pdf`);
  }
}
