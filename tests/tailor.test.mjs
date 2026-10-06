import assert from "node:assert/strict";
import test from "node:test";
import { splitCurrent, tailorByRules } from "../src/lib/tailor.js";

const doc = {
  current: "Senior Marketing Manager, Brightwave, Austin TX (2021 - Present)\nBuilt the weekly dashboard in Looker used by sales leadership.\nLaunched a customer onboarding email series that lifted trial-to-paid conversion from 14% to 17%.\nCut cost per lead 22% by moving budget to intent-based paid search channels.",
  skills: "Demand generation, lifecycle email, paid search, HubSpot, Looker",
};
const job = "We need someone to own paid search and paid social acquisition, lower cost per lead, and improve trial-to-paid conversion with lifecycle email. Paid search budget ownership is essential.";

test("the header stays first and the bullets the job talks about move up", () => {
  const result = tailorByRules(doc, job);
  assert.equal(result.currentLines[0], "Senior Marketing Manager, Brightwave, Austin TX (2021 - Present)");
  assert.match(result.currentLines[1], /cost per lead|onboarding email/);
  assert.match(result.currentLines.at(-1), /dashboard/);
  assert.equal(result.changed, true);
});

test("nothing is added, dropped or reworded", () => {
  const result = tailorByRules(doc, job);
  const before = splitCurrent(doc.current).bullets.slice().sort();
  const after = result.currentLines.slice(1).sort();
  assert.deepEqual(after, before);
  assert.deepEqual(result.skills.split(", ").sort(), doc.skills.split(", ").sort());
  assert.equal(result.summary, null);
});

test("skills the post names come first and the separator is kept", () => {
  const result = tailorByRules({ ...doc, skills: "Storytelling · HubSpot · Paid search · Lifecycle email" }, job);
  assert.match(result.skills, /^(Paid search|Lifecycle email)/);
  assert.match(result.skills, / · /);
});

test("a job post that matches nothing changes nothing", () => {
  const result = tailorByRules(doc, "Zoologist wanted for penguin habitat research in Antarctica.");
  assert.equal(result.changed, false);
  assert.deepEqual(result.currentLines, doc.current.split("\n"));
});

test("a current section with no role header is treated as all bullets", () => {
  const result = tailorByRules({ current: "Wrote copy.\nRan paid search budgets.", skills: "" }, "paid search budgets");
  assert.deepEqual(result.currentLines, ["Ran paid search budgets.", "Wrote copy."]);
});
