import assert from "node:assert/strict";
import test from "node:test";
import { careerShape, probeQuestions, repeatedPhrases, unquantifiedLines } from "../src/lib/probes.js";
import { analyzeSources, sampleSources } from "../src/lib/analyze.js";

const resume = (text, extra = {}) => ({ id: "r", kind: "resume", name: "Resume", text, ...extra });
const isCareer = (s) => ["resume", "current", "goals", "other"].includes(s.kind);

test("quotes the candidate's own unquantified line and skips lines that already have a figure", () => {
  const lines = unquantifiedLines([resume("Led brand positioning and customer education across the business.\nLed six direct reports across brand and content.\nGrew pipeline 40% in a year by launching a partner program.")], isCareer);
  assert.deepEqual(lines, ["Led brand positioning and customer education across the business."]);
});

test("does not ask about its own saved answers, decks, or the target role", () => {
  const sources = [
    { id: "career-bank", kind: "current", text: "Built a program that helped many customers across the whole region." },
    { id: "deck", kind: "current", format: "pptx", text: "Built a program that helped many customers across the whole region." },
    { id: "job", kind: "job", text: "You will build a program that helps many customers across the whole region." },
  ];
  assert.deepEqual(probeQuestions(sources, isCareer), []);
});

test("a phrase repeated across documents becomes a question", () => {
  const sources = [resume("Ran the partner enablement program. Partner enablement grew."), { id: "c", kind: "current", text: "My partner enablement work continues." }];
  const found = repeatedPhrases(sources, isCareer);
  assert.equal(found[0].phrase, "partner enablement");
  assert.equal(found[0].total, 3);
});

test("finds gaps, overlaps and short stints from resume dates without inventing any", () => {
  const shape = careerShape("Acme — Director, 2012–2015\nBeta Corp — VP, 2018–present\nSide Co — Advisor, 2019–2021", 2026);
  assert.deepEqual(shape.gaps, [{ from: 2015, to: 2018 }]);
  assert.equal(shape.overlaps.length, 1);
  assert.equal(careerShape("A — x, 2020–2021\nB — y, 2021–2022\nC — z, 2022–2023", 2026).shortStints, 3);
  assert.deepEqual(careerShape("Rivermark 2021–present\nLume 2018–2021", 2026).gaps, []);
});

test("a gap becomes a gentle question, and ids are stable so a refresh does not duplicate them", () => {
  const sources = [resume("Acme — Director, 2012–2015\nBeta Corp — VP, 2018–present")];
  const first = probeQuestions(sources, isCareer, 2026);
  assert.match(first.find((q) => q.id.startsWith("probe-gap")).prompt, /between 2015 and 2018/);
  assert.deepEqual(probeQuestions(sources, isCareer, 2026).map((q) => q.id), first.map((q) => q.id));
});

test("the sample case now asks about the candidate's own words, after the opening question", () => {
  const result = analyzeSources(sampleSources.map((s) => ({ ...s })), { company: "Nestwell", role: "Senior Director, Content & Community" });
  assert.equal(result.questions[0].id, "ownership");
  const probe = result.questions.find((q) => q.probe);
  assert.ok(probe, "expected a probe question");
  assert.match(probe.prompt, /^You wrote “/);
});

test("rule mode is no longer marketing-only: an engineering post finds engineering themes", () => {
  const result = analyzeSources([
    resume("Jamie Lee\nStaff Engineer\njamie@example.com\nAcme — Staff Engineer, 2019–present\nDesigned the cloud infrastructure and deployed the API platform for 40 services."),
    { id: "j", kind: "job", text: "Senior engineer to own our cloud infrastructure and API architecture, mentor engineers, and own security reviews.", name: "Job" },
  ], { company: "Co", role: "Senior Engineer" });
  const byKey = Object.fromEntries(result.requirements.map((r) => [r.key, r]));
  assert.equal(byKey.engineering.supported, true);
  assert.equal(byKey.compliance.supported, false);
  assert.equal(byKey.hiring.supported, false);
  assert.ok(byKey.engineering.evidence.includes("cloud infrastructure"));
});
