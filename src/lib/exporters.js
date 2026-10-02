const safeName = (value) => value.trim().replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "") || "resume";
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

export async function exportResume(doc, format) {
  const filename = `${safeName(doc.name)}-resume`;
  if (format === "txt") {
    const text = sections(doc).map(([heading, value]) => `${heading ? `${heading}\n` : ""}${value}`).join("\n\n");
    save(new Blob([text], { type: "text/plain;charset=utf-8" }), `${filename}.txt`);
    return;
  }
  if (format === "html") {
    const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${escapeHtml(doc.name)} Resume</title><style>body{max-width:760px;margin:48px auto;padding:0 28px;color:#17212b;font:15px/1.55 Arial,sans-serif}h1{font:42px/1.05 Georgia,serif;margin:0}h2{font:20px Georgia,serif;margin:5px 0}.contact{color:#65716c;font-size:12px}.summary{font-size:16px;margin:28px 0}h3{font:700 13px Georgia,serif;letter-spacing:.06em;border-top:1px solid #ccd4cf;padding-top:14px;margin-top:25px}p{white-space:pre-wrap}.tailored{border-left:3px solid #00624d;padding-left:12px}</style></head><body><h1>${escapeHtml(doc.name)}</h1><h2>${escapeHtml(doc.title)}</h2><p class="contact">${escapeHtml(doc.contact)}</p><p class="summary">${escapeHtml(doc.summary)}</p><h3>EXPERIENCE</h3><p>${escapeHtml(doc.current)}</p><h3>HIGHLIGHTS FOR THIS ROLE</h3><p class="tailored">${escapeHtml(doc.tailored)}</p><h3>EARLIER EXPERIENCE</h3><p>${escapeHtml(doc.earlier)}</p><h3>EDUCATION</h3><p>${escapeHtml(doc.education)}</p><h3>CAPABILITIES</h3><p>${escapeHtml(doc.skills)}</p></body></html>`;
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
    write(doc.name, 24, true, 3); write(doc.title, 13, true, 2); write(doc.contact, 9, false, 18); write(doc.summary, 11, false, 10);
    for (const [heading, value] of [["EXPERIENCE", doc.current], ["HIGHLIGHTS FOR THIS ROLE", doc.tailored], ["EARLIER EXPERIENCE", doc.earlier], ["EDUCATION", doc.education], ["CAPABILITIES", doc.skills]]) { write(heading, 10, true, 5); write(value, 10, false, 8); }
    save(pdf.output("blob"), `${filename}.pdf`);
  }
}
