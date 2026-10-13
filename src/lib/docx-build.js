// One place that turns the working resume into a Word document, shared by
// the download button and the parser check so they can never disagree.
// Draft prompts (e.g. "Add your most recent role...") are stripped here too,
// so an unfinished draft can never reach a paid export through any path.
// Approved interview lines ("highlights") ride as bullets under the newest
// role — they never get a section of their own in a paid export.
import { exportView } from "./exporters.js";

const roleHeadline = (role) => [role.title, role.company].filter(Boolean).join(", ");

export async function buildDocx(rawDoc) {
  const doc = exportView(rawDoc);
  const { Document, HeadingLevel, Paragraph, TextRun, TabStopType } = await import("docx");
  const paragraphs = [];
  if (doc.name) paragraphs.push(new Paragraph({ children: [new TextRun({ text: doc.name, bold: true, size: 34, font: "Georgia" })], spacing: { after: 80 } }));
  if (doc.title) paragraphs.push(new Paragraph({ children: [new TextRun({ text: doc.title, bold: true, size: 23, font: "Georgia" })] }));
  if (doc.contact) paragraphs.push(new Paragraph({ children: [new TextRun({ text: doc.contact, color: "617079", size: 19 })], spacing: { after: 280 } }));
  if (doc.summary) {
    paragraphs.push(new Paragraph({ text: "Summary", heading: HeadingLevel.HEADING_2, spacing: { before: 220, after: 90 } }));
    paragraphs.push(new Paragraph({ children: [new TextRun({ text: doc.summary, size: 22 })], spacing: { after: 240 } }));
  }
  if (doc.roles.length) {
    paragraphs.push(new Paragraph({ text: "Experience", heading: HeadingLevel.HEADING_2, spacing: { before: 220, after: 90 } }));
    for (const role of doc.roles) {
      const head = roleHeadline(role);
      if (head || role.dates) {
        paragraphs.push(new Paragraph({
          tabStops: [{ type: TabStopType.RIGHT, position: 9360 }],
          spacing: { before: 140, after: 60 },
          children: [
            ...(head ? [new TextRun({ text: head, bold: true, size: 22 })] : []),
            ...(role.dates ? [new TextRun({ text: `\t${role.dates}`, size: 20, color: "617079" })] : []),
          ],
        }));
      }
      for (const bullet of role.bullets) {
        paragraphs.push(new Paragraph({ text: bullet, bullet: { level: 0 }, spacing: { after: 60 } }));
      }
    }
  }
  if (doc.education.length) {
    paragraphs.push(new Paragraph({ text: "Education", heading: HeadingLevel.HEADING_2, spacing: { before: 220, after: 90 } }));
    for (const line of doc.education) paragraphs.push(new Paragraph({ text: line, bullet: { level: 0 }, spacing: { after: 60 } }));
  }
  if (doc.skills.length) {
    paragraphs.push(new Paragraph({ text: "Skills", heading: HeadingLevel.HEADING_2, spacing: { before: 220, after: 90 } }));
    paragraphs.push(new Paragraph({ children: [new TextRun({ text: doc.skills.join(" · "), size: 21 })], spacing: { after: 120 } }));
  }
  if (doc.interests) {
    paragraphs.push(new Paragraph({ text: "Interests", heading: HeadingLevel.HEADING_2, spacing: { before: 220, after: 90 } }));
    paragraphs.push(new Paragraph({ children: [new TextRun({ text: doc.interests, size: 21 })], spacing: { after: 120 } }));
  }
  return new Document({ sections: [{ properties: { page: { margin: { top: 720, right: 850, bottom: 720, left: 850 } } }, children: paragraphs }] });
}
