// Round-trip: wrapped LinkedIn-style text -> structured doc -> export ->
// read back, asserting roles, bullets and headings survive and no
// interview-scaffolding section leaks into any paid export.
//
// The wrapped sample below mimics LinkedIn's "Save to PDF": narrow columns
// wrap mid-sentence, headings glue to line starts ("Summary Product…"), and
// role titles wrap across lines ("…toy 1st Assistant" / "Director, …").
import assert from "node:assert/strict";
import test from "node:test";
import mammoth from "mammoth";
import { Packer } from "docx";
import { parseResumeText } from "../src/lib/analyze.js";
import { buildDocx } from "../src/lib/docx-build.js";
import { __test as exportTest } from "../src/lib/exporters.js";

const { toText, toHtml, exportView } = exportTest;

const wrapped = `Jordan Avery Founder & Product Leader
| Principal Product Manager Austin, TX |
jordan@example.com | 555-010-2030 Summary Product
leader with 6 years of shipping developer tools and
platform products. 4 years leading cross-functional teams
at high-growth startups. Experience Principal Product Manager, Northwind (
2021 – Present) Own the roadmap for the developer platform
used by 2,000 teams Ship integrations with GitHub, Linear,
and Slack Founder, Sideproject Labs (2018 – 2021) Built
and sold a Chrome extension for meeting notes 1st
Assistant Director, Freelance (2015 – 2018, selective)
Ran logistics for commercial shoots Education & Training
State University (2010-2014). BS in computer science
Skills Product: roadmapping, user research Management:
hiring, mentorship`;

const doc = parseResumeText(wrapped);

test("wrapped text parses into structured roles, not one blob", () => {
  assert.equal(doc.name, "Jordan Avery");
  assert.match(doc.title, /Principal Product Manager/);
  assert.match(doc.contact, /jordan@example.com/);
  assert.match(doc.contact, /555-010-2030/);
  assert.match(doc.contact, /Austin, TX/);
  assert.match(doc.summary, /Product leader with 6 years/);
  assert.ok(doc.roles.length >= 3, `expected 3+ roles, got ${doc.roles.length}`);
  assert.equal(doc.roles[0].title, "Principal Product Manager");
  assert.equal(doc.roles[0].company, "Northwind");
  assert.equal(doc.roles[0].dates, "2021 – Present");
  assert.ok(doc.roles[0].bullets.length > 0, "newest role has bullets");
  assert.equal(doc.roles[2].title, "Assistant Director");
  assert.doesNotMatch(JSON.stringify(doc.roles), /undefined/);
});

test("the plain-text export reads as a structured resume", () => {
  const text = toText(exportView({ ...doc, highlights: ["Shipped the thing."] }));
  assert.match(text, /^Jordan Avery/m);
  assert.match(text, /EXPERIENCE/);
  assert.match(text, /Principal Product Manager, Northwind/);
  assert.match(text, /2021 – Present/);
  assert.match(text, /^- /m);
  assert.match(text, /EDUCATION/);
  assert.match(text, /SKILLS/);
  assert.doesNotMatch(text, /HIGHLIGHTS FOR THIS ROLE/);
  assert.match(text, /Shipped the thing\./);
});

test("the HTML export has per-role headers and lists", () => {
  const html = toHtml(exportView(doc));
  assert.match(html, /<h1>Jordan Avery<\/h1>/);
  assert.match(html, /<h3>Experience<\/h3>/);
  assert.match(html, /<li>/);
  assert.doesNotMatch(html, /HIGHLIGHTS FOR THIS ROLE/);
});

test("the Word export reads back with roles, bullets and headings intact", async () => {
  const withHighlights = { ...doc, highlights: ["Shipped the thing."] };
  const bytes = new Uint8Array(await Packer.toBuffer(await buildDocx(withHighlights)));
  const flat = (await mammoth.extractRawText({ buffer: Buffer.from(bytes) })).value.replace(/\s+/g, " ");
  assert.match(flat, /Jordan Avery/);
  assert.match(flat, /Experience/);
  assert.match(flat, /Principal Product Manager/);
  assert.match(flat, /2021 – Present/);
  assert.match(flat, /Shipped the thing\./);
  assert.doesNotMatch(flat, /highlights for this role/i);
});
