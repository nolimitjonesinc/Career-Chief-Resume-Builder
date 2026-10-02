// One place that turns the working resume into a Word document, shared by the
// download button and the parser check so they can never disagree.
export const docxSections = (doc) => [["Experience", doc.current], ["Highlights for this role", doc.tailored], ["Earlier experience", doc.earlier], ["Education", doc.education], ["Capabilities", doc.skills]];

export async function buildDocx(doc) {
  const { Document, HeadingLevel, Paragraph, TextRun } = await import("docx");
  const paragraphs = [
    new Paragraph({ children: [new TextRun({ text: doc.name, bold: true, size: 34, font: "Georgia" })], spacing: { after: 80 } }),
    new Paragraph({ children: [new TextRun({ text: doc.title, bold: true, size: 23, font: "Georgia" })] }),
    new Paragraph({ children: [new TextRun({ text: doc.contact, color: "617079", size: 19 })], spacing: { after: 280 } }),
    new Paragraph({ children: [new TextRun({ text: doc.summary, size: 22 })], spacing: { after: 240 } }),
  ];
  for (const [heading, value] of docxSections(doc)) {
    paragraphs.push(new Paragraph({ text: heading, heading: HeadingLevel.HEADING_2, spacing: { before: 220, after: 90 } }));
    value.split("\n").filter(Boolean).forEach((line) => paragraphs.push(new Paragraph({ text: line, spacing: { after: 80 } })));
  }
  return new Document({ sections: [{ properties: { page: { margin: { top: 720, right: 850, bottom: 720, left: 850 } } }, children: paragraphs }] });
}
