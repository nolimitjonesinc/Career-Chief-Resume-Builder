import assert from "node:assert/strict";
import test from "node:test";
import { buildLedger, traceLine } from "../src/lib/evidence.js";
import { explainProposal } from "../src/lib/explain.js";
import { DRAFT_VERSION, migrateDraft } from "../src/lib/draft.js";

const sources = [{ id: "r", kind: "resume", name: "Resume.pdf", text: "Rivermark Health — Senior Manager, 2021–present\nLed brand positioning and customer education across three service lines.\nManaged agency and content partnerships." }];
const answers = [{ topic: "Program ownership", text: "I built a customer content program with Sales and 4 experts.", resumeLine: "Built a customer content program with Sales and 4 experts." }];

test("a line from an approved answer traces to that answer", () => {
  const t = traceLine("Built a customer content program with Sales and 4 experts.", { answers, sources });
  assert.equal(t.status, "answer");
  assert.match(t.support.name, /Program ownership/);
  assert.deepEqual(t.unsupportedNumbers, []);
});

test("a line copied from a document traces to it, with the sentence as proof", () => {
  const t = traceLine("Led brand positioning and customer education across three service lines.", { answers, sources });
  assert.equal(t.status, "document");
  assert.equal(t.support.name, "Resume.pdf");
  assert.match(t.support.excerpt, /brand positioning/);
});

test("a line with an invented figure is marked for a check even if the rest traces", () => {
  const t = traceLine("Led brand positioning and customer education across 12 service lines.", { answers, sources });
  assert.equal(t.tone, "check");
  assert.deepEqual(t.unsupportedNumbers, ["12"]);
});

test("generic summary and skills the app wrote are labelled as such; edited ones are not", () => {
  const baseline = { summary: "Marketing lead with cross-functional leadership.", skills: "Leadership · Strategy" };
  assert.equal(traceLine(baseline.summary, { answers, sources, baseline, field: "summary" }).status, "template");
  assert.equal(traceLine("Brand leader who builds trust.", { answers, sources, baseline, field: "summary" }).status, "unsourced");
});

test("placeholders are flagged and an unsupported line is neutral, never an accusation", () => {
  assert.equal(traceLine("Add earlier roles that strengthen this case.", { answers, sources }).status, "placeholder");
  const t = traceLine("Mentored an intern into a full-time role.", { answers, sources });
  assert.equal(t.status, "unsourced");
  assert.equal(t.tone, "note");
});

test("the ledger counts every line and lists only the ones needing a check as attention", () => {
  const doc = { summary: "Generic.", current: "Led brand positioning and customer education across three service lines.\nGrew revenue 90%.", tailored: "Built a customer content program with Sales and 4 experts.", earlier: "", education: "BA", skills: "Leadership" };
  const ledger = buildLedger(doc, { answers, sources, baseline: { summary: "Generic.", skills: "Leadership" } });
  assert.equal(ledger.items.length, 6);
  assert.equal(ledger.counts.answer, 1);
  assert.equal(ledger.counts.template, 2);
  assert.deepEqual(ledger.attention.map((item) => item.line), ["Grew revenue 90%."]);
});

test("the explainer states what changed and whether any figure was added", () => {
  const first = explainProposal({ answer: "I led six direct reports across brand.", proposal: "Led 6 direct reports across brand.", requirements: [{ key: "team" }] });
  assert.ok(first.points.some((p) => /Dropped the first person/.test(p)));
  assert.ok(first.points.some((p) => /Team leadership/.test(p)));
  assert.ok(first.points.some((p) => /Nothing was added/.test(p)));
  const bad = explainProposal({ answer: "I led the team.", proposal: "Led a team of 14.", requirements: [] });
  assert.deepEqual(bad.figures, ["14"]);
});

test("old saved drafts are walked forward; newer ones are not guessed at", () => {
  const old = migrateDraft({ screen: "workspace", meta: { role: "x" } });
  assert.equal(old.draftVersion, DRAFT_VERSION);
  assert.deepEqual(old.compareJobs, []);
  assert.equal(old.meta.role, "x");
  assert.equal(migrateDraft({ draftVersion: DRAFT_VERSION + 1 }), null);
  assert.equal(migrateDraft(null), null);
});

test("a resume line that joins several sentences of a document still traces to it", () => {
  const joined = [{ id: "r", kind: "resume", name: "Resume.pdf", text: "Rivermark Health — Senior Manager, 2021–present\nLed brand positioning and customer education. Managed agency and content partnerships. Led six direct reports across brand and content.\nBA 2015" }];
  const t = traceLine("Led brand positioning and customer education. Managed agency and content partnerships. Led six direct reports across brand and content.", { answers: [], sources: joined });
  assert.equal(t.status, "document");
  assert.deepEqual(t.unsupportedNumbers, []);
});

test("evidence excerpts never run across two documents or end mid-word", async () => {
  const { evaluateRequirements } = await import("../src/lib/analyze.js");
  const career = ["BA Communications, 2015", "Jordan created a customer and expert content program, set up participant sourcing with Sales and Operations, selected the production partner, approved stories and final edits, and coaches a six-person team."].join("\n");
  const [item] = evaluateRequirements("build a creator program", career);
  assert.ok(!item.evidence.includes("2015 Jordan"));
  assert.ok(item.evidence.startsWith("Jordan created"));
  const cut = item.evidence.replace(/…$/, "");
  const sentence = career.split("\n")[1];
  assert.ok(sentence.startsWith(cut), "excerpt is a real prefix of the sentence");
  assert.ok(cut === sentence || /\s/.test(sentence[cut.length]), "cut falls on a word boundary");
});

test("a figure that appears only in the job post is NOT supported by the user's own material", () => {
  const own = [{ id: "r", kind: "resume", name: "Resume", text: "Managed engineers across two sites." }];
  const t = traceLine("Managed 40 engineers across two sites.", { answers: [], sources: own });
  assert.deepEqual(t.unsupportedNumbers, ["40"]);
});

test("a broken or hostile saved draft never blanks the app", async () => {
  const { migrateDraft, isNewerDraft, DRAFT_VERSION: V } = await import("../src/lib/draft.js");
  for (const version of [0, -3, 1.5, "2", NaN]) assert.equal(migrateDraft({ draftVersion: version, meta: { role: "x" } }).meta.role, "x");
  assert.equal(isNewerDraft({ draftVersion: V + 1 }), true);
  assert.equal(migrateDraft({ draftVersion: V + 1 }), null);
});

test("the staff pattern does not blow up on hostile input", async () => {
  const { evaluateRequirements } = await import("../src/lib/analyze.js");
  const started = Date.now();
  evaluateRequirements("lead the team", "managed ".repeat(30_000));
  assert.ok(Date.now() - started < 1500, "took too long");
});
