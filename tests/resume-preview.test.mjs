// Edit-in-place preview: one canonical markup path for the preview and the
// HTML export, plus the pure edit helpers behind click-to-edit.
import assert from "node:assert/strict";
import test from "node:test";
import { __test as exportTest } from "../src/lib/exporters.js";
import {
  applyPreviewEdit,
  exportView,
  foldedHighlightCount,
  parseRoleHeaderLine,
  previewFieldValue,
  resumeBodyHtml,
} from "../src/lib/resume-view.js";

const { toHtml } = exportTest;

const fixture = {
  name: "Jordan Avery",
  title: "Principal Product Manager",
  contact: "Austin, TX | jordan@example.com",
  summary: "Product leader with 6 years of shipping tools.",
  roles: [
    { title: "Principal Product Manager", company: "Northwind", dates: "2021 – Present", bullets: ["Own the roadmap.", "Ship integrations."] },
    { title: "Founder", company: "Sideproject Labs", dates: "2018 – 2021", bullets: [] },
  ],
  highlights: ["Won the launch award."],
  education: ["State University (2010-2014). BS in CS"],
  skills: ["Roadmapping", "Hiring"],
  interests: "Hiking.",
};

// Pinned: the HTML export's bytes for the fixture must not change when the
// preview shares its markup path.
const PINNED_HTML = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Jordan Avery</title><style>body{max-width:760px;margin:48px auto;padding:0 28px;color:#17212b;font:15px/1.55 Arial,sans-serif}h1{font:42px/1.05 Georgia,serif;margin:0}h2{font:20px Georgia,serif;margin:5px 0}.contact{color:#65716c;font-size:12px}.summary{font-size:16px}h3{font:700 13px Georgia,serif;letter-spacing:.06em;text-transform:uppercase;border-top:1px solid #ccd4cf;padding-top:14px;margin-top:25px}.role-head{display:flex;justify-content:space-between;gap:16px;margin:14px 0 4px}.dates{color:#65716c;white-space:nowrap}ul{margin:4px 0 10px;padding-left:20px}li{margin-bottom:4px}</style></head><body><h1>Jordan Avery</h1><h2>Principal Product Manager</h2><p class="contact">Austin, TX | jordan@example.com</p><h3>Summary</h3><p class="summary">Product leader with 6 years of shipping tools.</p><h3>Experience</h3><div class="role-head"><strong>Principal Product Manager, Northwind</strong><span class="dates">2021 – Present</span></div><ul><li>Won the launch award.</li><li>Own the roadmap.</li><li>Ship integrations.</li></ul><div class="role-head"><strong>Founder, Sideproject Labs</strong><span class="dates">2018 – 2021</span></div><h3>Education</h3><ul><li>State University (2010-2014). BS in CS</li></ul><h3>Skills</h3><p>Roadmapping · Hiring</p><h3>Interests</h3><p>Hiking.</p></body></html>`;

test("HTML export bytes are unchanged by the shared preview markup path", () => {
  assert.equal(toHtml(exportView(fixture)), PINNED_HTML);
});

test("preview markup agrees with the HTML export (same content, order, structure)", () => {
  const view = exportView(fixture);
  const preview = resumeBodyHtml(view, { editMode: true, highlightCount: foldedHighlightCount(fixture) });
  // The edit hooks are invisible: strip data-* attributes and the two
  // outputs must be identical.
  const stripped = preview.replace(/\sdata-[a-z-]+="[^"]*"/g, "");
  assert.equal(stripped, resumeBodyHtml(view));
  // And the preview carries an edit hook on every editable line.
  for (const field of ["name", "title", "contact", "summary", "skills", "interests"]) {
    assert.match(preview, new RegExp(`data-edit="${field}"`));
  }
  assert.match(preview, /data-edit="bullet" data-role="0" data-bullet="0" data-source="highlight" data-index="0"/);
  assert.match(preview, /data-edit="bullet" data-role="0" data-bullet="1" data-source="role" data-index="0"/);
  assert.match(preview, /data-edit="roleHead" data-role="0"/);
  assert.match(preview, /data-edit="education" data-index="0"/);
});

test("preview shows the export view: highlights folded, no scaffolding section", () => {
  const view = exportView(fixture);
  const preview = resumeBodyHtml(view, { editMode: true, highlightCount: foldedHighlightCount(fixture) });
  assert.match(preview, /<li[^>]*>Won the launch award\.<\/li>/);
  assert.doesNotMatch(preview, /New lines from your answers/);
});

test("preview strips placeholder prompts and junk", () => {
  const draft = {
    ...fixture,
    roles: [{ title: "Manager", company: "Acme", dates: "", bullets: ["Add your most recent role and accomplishments.", "Real bullet."] }],
    highlights: [],
  };
  const preview = resumeBodyHtml(exportView(draft), { editMode: true, highlightCount: 0 });
  assert.doesNotMatch(preview, /Add your most recent role/);
  assert.match(preview, /Real bullet\./);
});

test("editing render swaps one line for a field, keeping the rest static", () => {
  const view = exportView(fixture);
  const html = resumeBodyHtml(view, { editMode: true, editing: { key: "bullet:0:1" }, highlightCount: 1 });
  assert.match(html, /<li><textarea class="edit-field" data-edit-input rows="3">Own the roadmap\.<\/textarea><\/li>/);
  assert.match(html, /<li data-edit="bullet"[^>]*>Won the launch award\.<\/li>/);
  assert.match(html, /<h1 data-edit="name">Jordan Avery<\/h1>/);
});

test("applyPreviewEdit: a bullet edit updates that bullet only", () => {
  const next = applyPreviewEdit(fixture, { field: "bullet", roleIndex: 0, bulletIndex: 1, source: "role", index: 0, value: "Own the platform roadmap." });
  assert.equal(next.roles[0].bullets[1], "Own the platform roadmap.");
  assert.equal(next.roles[0].bullets[0], "Own the roadmap.");
  assert.deepEqual(next.highlights, ["Won the launch award."]);
  // The input doc is not mutated.
  assert.equal(fixture.roles[0].bullets[0], "Own the roadmap.");
  assert.equal(fixture.roles[0].bullets[1], "Ship integrations.");
});

test("applyPreviewEdit: editing a folded highlight edits highlights, not role bullets", () => {
  const next = applyPreviewEdit(fixture, { field: "bullet", roleIndex: 0, bulletIndex: 0, source: "highlight", index: 0, value: "Won the big launch award." });
  assert.deepEqual(next.highlights, ["Won the big launch award."]);
  assert.deepEqual(next.roles[0].bullets, ["Own the roadmap.", "Ship integrations."]);
});

test("applyPreviewEdit: clearing a bullet removes that line", () => {
  const next = applyPreviewEdit(fixture, { field: "bullet", roleIndex: 0, bulletIndex: 0, source: "role", index: 0, value: "   " });
  assert.deepEqual(next.roles[0].bullets, ["Ship integrations."]);
});

test("applyPreviewEdit: single fields, skills, education", () => {
  const next = applyPreviewEdit(fixture, { field: "summary", value: "New summary." });
  assert.equal(next.summary, "New summary.");
  const skilled = applyPreviewEdit(fixture, { field: "skills", value: "Roadmapping · Hiring · Mentorship" });
  assert.deepEqual(skilled.skills, ["Roadmapping", "Hiring", "Mentorship"]);
  const educated = applyPreviewEdit(fixture, { field: "education", index: 0, value: "" });
  assert.deepEqual(educated.education, []);
  const named = applyPreviewEdit(fixture, { field: "name", value: "Jordan B. Avery" });
  assert.equal(named.name, "Jordan B. Avery");
});

test("applyPreviewEdit: role header edit splits title, company, dates", () => {
  const next = applyPreviewEdit(fixture, { field: "roleHead", roleIndex: 1, value: "Senior Founder, New Labs — 2019 – 2022" });
  assert.deepEqual(
    [next.roles[1].title, next.roles[1].company, next.roles[1].dates],
    ["Senior Founder", "New Labs", "2019 – 2022"],
  );
});

test("applyPreviewEdit: blank role header and unknown fields are ignored", () => {
  const blank = applyPreviewEdit(fixture, { field: "roleHead", roleIndex: 0, value: "   " });
  assert.deepEqual(blank.roles[0], fixture.roles[0]);
  const unknown = applyPreviewEdit(fixture, { field: "nope", value: "x" });
  assert.deepEqual(unknown, fixture);
});

test("parseRoleHeaderLine: canonical, dateless, company-first, and hyphen forms", () => {
  assert.deepEqual(
    parseRoleHeaderLine("Founder & AI Product Builder, NoLimit Labs — 2022 – Present"),
    { title: "Founder & AI Product Builder", company: "NoLimit Labs", dates: "2022 – Present" },
  );
  assert.deepEqual(
    parseRoleHeaderLine("Manager, Acme"),
    { title: "Manager", company: "Acme", dates: "" },
  );
  assert.deepEqual(
    parseRoleHeaderLine("Rivermark Health — Senior Brand Marketing Manager"),
    { title: "Senior Brand Marketing Manager", company: "Rivermark Health", dates: "" },
  );
  assert.deepEqual(
    parseRoleHeaderLine("Designer, Studio X 2020 - 2022"),
    { title: "Designer", company: "Studio X", dates: "2020 - 2022" },
  );
  assert.equal(parseRoleHeaderLine(""), null);
  assert.equal(parseRoleHeaderLine("   "), null);
});

test("previewFieldValue returns the display line for heads and bullets", () => {
  assert.equal(
    previewFieldValue(fixture, { field: "roleHead", roleIndex: 0 }),
    "Principal Product Manager, Northwind — 2021 – Present",
  );
  assert.equal(
    previewFieldValue(fixture, { field: "bullet", roleIndex: 0, bulletIndex: 1 }),
    "Own the roadmap.",
  );
  assert.equal(previewFieldValue(fixture, { field: "skills" }), "Roadmapping · Hiring");
});
