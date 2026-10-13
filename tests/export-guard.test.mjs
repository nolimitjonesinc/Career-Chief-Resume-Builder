// Guards around the paid export path: draft prompts must never reach an
// export, source-PDF page footers must not leak into resumes, and PDF text
// extraction must preserve line breaks (or header parsing collapses).
import assert from "node:assert/strict";
import test from "node:test";

const { sanitizeDoc } = await import("../src/lib/exporters.js");
const { extractFile, pdfItemsToLines } = await import("../src/lib/ingest.js");

const fullDoc = {
  name: "Danny Jones",
  title: "Founder & AI Product Builder",
  contact: "dannyjones.ai | nolimitjones@gmail.com | 605-484-3913",
  summary: "Product builder with 4 years of shipping apps.",
  current: "Founder & AI Product Builder, NoLimit Labs (2022 – Present)\nShipped Loomiverse.ai.",
  tailored: "Built and launched three AI products used by real customers.",
  earlier: "1st Assistant Director, Freelance (2017 – Present)",
  education: "Black Hills State University (1992-1993)",
  skills: "Product design · Rapid prototyping",
};

test("sanitizeDoc keeps real content untouched", () => {
  assert.deepEqual(sanitizeDoc(fullDoc), fullDoc);
});

test("sanitizeDoc strips every known draft prompt", () => {
  const dirty = {
    ...fullDoc,
    name: "Your name",
    title: "Professional title",
    contact: "Contact details",
    current: "Add your most recent role and accomplishments.",
    tailored: "Add an accomplishment supported by your career history.",
    earlier: "Add earlier roles that strengthen this case.",
    education: "Education",
  };
  const clean = sanitizeDoc(dirty);
  assert.equal(clean.name, "");
  assert.equal(clean.title, "");
  assert.equal(clean.contact, "");
  assert.equal(clean.current, "");
  assert.equal(clean.tailored, "");
  assert.equal(clean.earlier, "");
  assert.equal(clean.education, "");
  // Untouched fields survive.
  assert.equal(clean.summary, fullDoc.summary);
  assert.equal(clean.skills, fullDoc.skills);
});

test("sanitizeDoc keeps the same shape (exporters rely on every key)", () => {
  assert.deepEqual(Object.keys(sanitizeDoc({})).sort(), Object.keys(fullDoc).sort());
});

test("extractFile strips 'Page X of Y' footers from source files", async () => {
  const file = new File(
    ["Danny Jones\nFounder\nDanny Jones Resume Page 1 of 2\nBuilt things.\nPage 2 of 2"],
    "resume.txt",
    { type: "text/plain" }
  );
  const { text } = await extractFile(file);
  assert.match(text, /Danny Jones/);
  assert.match(text, /Built things/);
  assert.doesNotMatch(text, /page \d+ of \d+/i);
});

test("pdfItemsToLines groups items sharing a y-coordinate", () => {
  const items = [
    { str: "Danny Jones", transform: [1, 0, 0, 1, 72, 700] },
    { str: "Founder", transform: [1, 0, 0, 1, 200, 700] },
    { str: "dannyjones.ai", transform: [1, 0, 0, 1, 72, 685] },
    { str: "Built things.", transform: [1, 0, 0, 1, 72, 660] },
  ];
  assert.deepEqual(pdfItemsToLines(items), [
    "Danny Jones Founder",
    "dannyjones.ai",
    "Built things.",
  ]);
});

test("pdfItemsToLines tolerates small y jitter within a line", () => {
  const items = [
    { str: "Hello", transform: [1, 0, 0, 1, 72, 700] },
    // Superscript-style item 2pt off the baseline stays on the same line.
    { str: "2", transform: [1, 0, 0, 0.7, 110, 702] },
    { str: "Next line", transform: [1, 0, 0, 1, 72, 680] },
  ];
  assert.deepEqual(pdfItemsToLines(items), ["Hello 2", "Next line"]);
});

test("pdfItemsToLines ignores empty items", () => {
  const items = [
    { str: "", transform: [1, 0, 0, 1, 72, 700] },
    { str: "Only", transform: [1, 0, 0, 1, 72, 700] },
  ];
  assert.deepEqual(pdfItemsToLines(items), ["Only"]);
});
