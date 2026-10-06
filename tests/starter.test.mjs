import assert from "node:assert/strict";
import test from "node:test";
import { analyzeSources } from "../src/lib/analyze.js";
import { starterReady, starterResumeText } from "../src/lib/starter.js";

const form = {
  name: "Sam Rivera",
  headline: "Operations Manager",
  contact: "sam@example.com | (555) 010-2000",
  summary: "",
  jobs: [
    { title: "Operations Manager", company: "Harbor Foods", start: "2021", end: "", did: "- Ran a team of nine\n- Cut delivery delays in half" },
    { title: "Shift Lead", company: "Harbor Foods", start: "2018", end: "2021", did: "Scheduled 30 staff each week" },
    { title: "", company: "", start: "", end: "", did: "" },
  ],
  education: "B.S. Business, State University, 2017",
  skills: "Scheduling, vendor management",
};
const job = { id: "j", kind: "job", name: "Job", text: "Lead operations for a growing food distributor." };

test("the form becomes plain resume text using only the person's words", () => {
  const text = starterResumeText(form);
  assert.match(text, /^Sam Rivera\nOperations Manager\nsam@example.com/);
  assert.match(text, /Operations Manager, Harbor Foods \(2021 – Present\)/);
  assert.match(text, /Ran a team of nine\nCut delivery delays in half/);
  assert.doesNotMatch(text, /^SUMMARY$/m);
  assert.doesNotMatch(text, /- Ran/);
});

test("the parser reads the generated text as a real resume, newest role first", () => {
  const d = analyzeSources([{ id: "r", kind: "resume", name: "Resume", text: starterResumeText(form) }, job], { company: "Co", role: "Ops Lead" }).doc;
  assert.equal(d.name, "Sam Rivera");
  assert.match(d.current, /Ran a team of nine/);
  assert.match(d.earlier, /Shift Lead/);
  assert.equal(d.education, "B.S. Business, State University, 2017");
  assert.equal(d.skills, "Scheduling, vendor management");
});

test("needs a name and at least one job with something done in it", () => {
  assert.equal(starterReady(form), true);
  assert.equal(starterReady({ ...form, name: "" }), false);
  assert.equal(starterReady({ ...form, jobs: [{ title: "Cook", company: "", start: "", end: "", did: "" }] }), false);
});
