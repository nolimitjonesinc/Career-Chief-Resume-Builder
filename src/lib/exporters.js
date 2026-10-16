import { exportView, escapeHtml, resumeBodyHtml, roleHeadline, sanitizeDoc } from "./resume-view.js";
export { PLACEHOLDERS, exportView, sanitizeDoc } from "./resume-view.js";

const safeName = (value) => (value || "").trim().replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "") || "resume";

function save(blob, filename) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  window.setTimeout(() => { anchor.remove(); URL.revokeObjectURL(url); }, 400);
}

function toText(doc) {
  const parts = [];
  if (doc.name) parts.push(doc.name);
  if (doc.title) parts.push(doc.title);
  if (doc.contact) parts.push(doc.contact);
  if (doc.summary) parts.push(`\nSUMMARY\n${doc.summary}`);
  if (doc.roles.length) {
    parts.push("\nEXPERIENCE");
    for (const role of doc.roles) {
      const head = [roleHeadline(role), role.dates].filter(Boolean).join(" — ");
      if (head) parts.push(`\n${head}`);
      for (const bullet of role.bullets) parts.push(`- ${bullet}`);
    }
  }
  if (doc.education.length) parts.push(`\nEDUCATION\n${doc.education.map((line) => `- ${line}`).join("\n")}`);
  if (doc.skills.length) parts.push(`\nSKILLS\n${doc.skills.join(" · ")}`);
  if (doc.interests) parts.push(`\nINTERESTS\n${doc.interests}`);
  return parts.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

function toHtml(doc) {
  // `doc` is already an export view (exportResume applies exportView first).
  // The body is the canonical resume markup shared with the on-screen
  // preview; the styles below are the export's long-standing ones and are
  // pinned byte-for-byte by tests.
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${escapeHtml(doc.name || "Resume")}</title><style>body{max-width:760px;margin:48px auto;padding:0 28px;color:#17212b;font:15px/1.55 Arial,sans-serif}h1{font:42px/1.05 Georgia,serif;margin:0}h2{font:20px Georgia,serif;margin:5px 0}.contact{color:#65716c;font-size:12px}.summary{font-size:16px}h3{font:700 13px Georgia,serif;letter-spacing:.06em;text-transform:uppercase;border-top:1px solid #ccd4cf;padding-top:14px;margin-top:25px}.role-head{display:flex;justify-content:space-between;gap:16px;margin:14px 0 4px}.dates{color:#65716c;white-space:nowrap}ul{margin:4px 0 10px;padding-left:20px}li{margin-bottom:4px}</style></head><body>${resumeBodyHtml(doc)}</body></html>`;
}

export async function exportResume(rawDoc, format) {
  const doc = exportView(rawDoc);
  const filename = `${safeName(doc.name)}-resume`;
  if (format === "txt") {
    save(new Blob([toText(doc)], { type: "text/plain;charset=utf-8" }), `${filename}.txt`);
    return;
  }
  if (format === "html") {
    save(new Blob([toHtml(doc)], { type: "text/html;charset=utf-8" }), `${filename}.html`);
    return;
  }
  if (format === "docx") {
    const [{ Packer }, { buildDocx }] = await Promise.all([import("docx"), import("./docx-build.js")]);
    save(await Packer.toBlob(await buildDocx(rawDoc)), `${filename}.docx`);
    return;
  }
  if (format === "pdf") {
    const { jsPDF } = await import("jspdf");
    const pdf = new jsPDF({ unit: "pt", format: "letter" });
    const margin = 56;
    const width = 612 - margin * 2;
    const right = 612 - margin;
    let y = 58;
    const need = (height) => { if (y + height > 752) { pdf.addPage(); y = 58; } };
    const write = (value, size = 11, bold = false, gap = 18) => {
      pdf.setFont("helvetica", bold ? "bold" : "normal");
      pdf.setFontSize(size);
      const lines = pdf.splitTextToSize(value, width);
      const lineHeight = size * 1.35;
      for (const line of lines) {
        need(lineHeight);
        pdf.text(line, margin, y);
        y += lineHeight;
      }
      y += gap;
    };
    const writeHeading = (value) => {
      need(30);
      y += 8;
      write(value.toUpperCase(), 10, true, 6);
    };
    const writeRole = (role) => {
      const head = roleHeadline(role);
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(11);
      const headWidth = width - (role.dates ? 140 : 0);
      // A long headline wraps to 2 lines; draw it line by line and advance
      // past the LAST line, or the first bullet lands on top of the header
      // (the old code drew with maxWidth but advanced a fixed 15pt).
      const headLines = pdf.splitTextToSize(head, headWidth);
      const headLineHeight = 11 * 1.35;
      need(headLines.length * headLineHeight + 2);
      headLines.forEach((line, index) => {
        pdf.text(line, margin, y);
        if (index === 0 && role.dates) {
          pdf.setFont("helvetica", "normal");
          pdf.setFontSize(10);
          pdf.text(role.dates, right, y, { align: "right" });
          pdf.setFont("helvetica", "bold");
          pdf.setFontSize(11);
        }
        y += headLineHeight;
      });
      y += 2;
      for (const bullet of role.bullets) {
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(10.5);
        const lines = pdf.splitTextToSize(bullet, width - 18);
        const lineHeight = 10.5 * 1.35;
        lines.forEach((line, index) => {
          need(lineHeight);
          pdf.text(index === 0 ? "•" : "", margin + 2, y);
          pdf.text(line, margin + 16, y);
          y += lineHeight;
        });
        y += 3;
      }
      y += 6;
    };
    if (doc.name) write(doc.name, 24, true, 3);
    if (doc.title) write(doc.title, 13, true, 2);
    if (doc.contact) write(doc.contact, 9, false, 16);
    if (doc.summary) { writeHeading("Summary"); write(doc.summary, 11, false, 8); }
    if (doc.roles.length) {
      writeHeading("Experience");
      for (const role of doc.roles) writeRole(role);
    }
    if (doc.education.length) {
      writeHeading("Education");
      for (const line of doc.education) {
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(10.5);
        const lines = pdf.splitTextToSize(line, width - 18);
        const lineHeight = 10.5 * 1.35;
        lines.forEach((textLine, index) => {
          need(lineHeight);
          pdf.text(index === 0 ? "•" : "", margin + 2, y);
          pdf.text(textLine, margin + 16, y);
          y += lineHeight;
        });
        y += 3;
      }
      y += 6;
    }
    if (doc.skills.length) { writeHeading("Skills"); write(doc.skills.join(" · "), 10.5, false, 8); }
    if (doc.interests) { writeHeading("Interests"); write(doc.interests, 10.5, false, 8); }
    save(pdf.output("blob"), `${filename}.pdf`);
  }
}

// Exported for tests: the pure renderers behind the download buttons.
export const __test = { toText, toHtml, sanitizeDoc, exportView };
