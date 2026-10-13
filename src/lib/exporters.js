const safeName = (value) => (value || "").trim().replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "") || "resume";

// Prompts shown in the on-screen working draft that must never reach a paid
// export. A buyer exporting before finishing the interview would otherwise
// pay for a file that says "Add your most recent role and accomplishments."
export const PLACEHOLDERS = new Set([
  "Add your most recent role and accomplishments.",
  "Add earlier roles that strengthen this case.",
  "Add an accomplishment supported by your career history.",
  "Contact details",
  "Your name",
  "Professional title",
  "Education",
]);

const JUNK = /^(undefined|null|nan)$/i;
const cleanText = (value) => {
  const text = String(value ?? "").trim();
  return PLACEHOLDERS.has(text) || JUNK.test(text) ? "" : text;
};
const cleanList = (values) => (Array.isArray(values) ? values : String(values ?? "").split("\n"))
  .map((item) => cleanText(item)).filter(Boolean);

// Returns the doc with placeholder prompts and junk removed (same shape).
// The on-screen draft keeps its prompts; only exports are cleaned.
export function sanitizeDoc(rawDoc) {
  const doc = rawDoc || {};
  return {
    name: cleanText(doc.name),
    title: cleanText(doc.title),
    contact: cleanText(doc.contact),
    summary: cleanText(doc.summary),
    roles: (Array.isArray(doc.roles) ? doc.roles : []).map((role) => ({
      title: cleanText(role.title),
      company: cleanText(role.company),
      dates: cleanText(role.dates),
      bullets: cleanList(role.bullets),
    })).filter((role) => role.title || role.company || role.bullets.length),
    // Approved interview lines never get a section of their own in a paid
    // export; they ride along as bullets under the newest role instead.
    highlights: cleanList(doc.highlights),
    education: cleanList(doc.education),
    skills: cleanList(doc.skills),
    interests: cleanText(doc.interests),
  };
}

// The export view of a doc: highlights folded into the newest role's bullets,
// so approved interview lines reach the paid file without their own section.
export function exportView(rawDoc) {
  const doc = sanitizeDoc(rawDoc);
  const roles = doc.roles.map((role) => ({ ...role }));
  if (doc.highlights.length && roles.length) {
    roles[0] = { ...roles[0], bullets: [...doc.highlights, ...roles[0].bullets] };
  } else if (doc.highlights.length) {
    roles.push({ title: "", company: "", dates: "", bullets: [...doc.highlights] });
  }
  return { ...doc, roles };
}

const roleHeadline = (role) => [role.title, role.company].filter(Boolean).join(", ");
const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);

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
  const head = [
    doc.name ? `<h1>${escapeHtml(doc.name)}</h1>` : "",
    doc.title ? `<h2>${escapeHtml(doc.title)}</h2>` : "",
    doc.contact ? `<p class="contact">${escapeHtml(doc.contact)}</p>` : "",
    doc.summary ? `<h3>Summary</h3><p class="summary">${escapeHtml(doc.summary)}</p>` : "",
  ].join("");
  const roleHtml = (role) => {
    const headLine = `<div class="role-head"><strong>${escapeHtml(roleHeadline(role))}</strong>${role.dates ? `<span class="dates">${escapeHtml(role.dates)}</span>` : ""}</div>`;
    const bullets = role.bullets.length ? `<ul>${role.bullets.map((bullet) => `<li>${escapeHtml(bullet)}</li>`).join("")}</ul>` : "";
    return headLine + bullets;
  };
  const sections = [
    doc.roles.length ? `<h3>Experience</h3>${doc.roles.map(roleHtml).join("")}` : "",
    doc.education.length ? `<h3>Education</h3><ul>${doc.education.map((line) => `<li>${escapeHtml(line)}</li>`).join("")}</ul>` : "",
    doc.skills.length ? `<h3>Skills</h3><p>${escapeHtml(doc.skills.join(" · "))}</p>` : "",
    doc.interests ? `<h3>Interests</h3><p>${escapeHtml(doc.interests)}</p>` : "",
  ].join("");
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${escapeHtml(doc.name || "Resume")}</title><style>body{max-width:760px;margin:48px auto;padding:0 28px;color:#17212b;font:15px/1.55 Arial,sans-serif}h1{font:42px/1.05 Georgia,serif;margin:0}h2{font:20px Georgia,serif;margin:5px 0}.contact{color:#65716c;font-size:12px}.summary{font-size:16px}h3{font:700 13px Georgia,serif;letter-spacing:.06em;text-transform:uppercase;border-top:1px solid #ccd4cf;padding-top:14px;margin-top:25px}.role-head{display:flex;justify-content:space-between;gap:16px;margin:14px 0 4px}.dates{color:#65716c;white-space:nowrap}ul{margin:4px 0 10px;padding-left:20px}li{margin-bottom:4px}</style></head><body>${head}${sections}</body></html>`;
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
      need(16);
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(11);
      const headWidth = Math.min(pdf.getTextWidth(head), width - (role.dates ? 140 : 0));
      pdf.text(head, margin, y, { maxWidth: headWidth });
      if (role.dates) {
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(10);
        pdf.text(role.dates, right, y, { align: "right" });
      }
      y += 15;
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
