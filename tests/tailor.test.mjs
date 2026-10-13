import assert from "node:assert/strict";
import test from "node:test";
import { roleHeader, splitRole, tailorByRules } from "../src/lib/tailor.js";

const doc = {
  roles: [{
    title: "Senior Marketing Manager",
    company: "Brightwave",
    dates: "2021 - Present",
    bullets: [
      "Built the weekly dashboard in Looker used by sales leadership.",
      "Launched a customer onboarding email series that lifted trial-to-paid conversion from 14% to 17%.",
      "Cut cost per lead 22% by moving budget to intent-based paid search channels.",
    ],
  }],
  skills: ["Demand generation", "lifecycle email", "paid search", "HubSpot", "Looker"],
};
const job = "We need someone to own paid search and paid social acquisition, lower cost per lead, and improve trial-to-paid conversion with lifecycle email. Paid search budget ownership is essential.";

test("splitRole gives the header and bullets for the newest role", () => {
  const { header, bullets } = splitRole(doc.roles[0]);
  assert.match(header, /Senior Marketing Manager, Brightwave/);
  assert.match(header, /2021 - Present/);
  assert.equal(bullets.length, 3);
});

test("the header stays first and the bullets the job talks about move up", () => {
  const result = tailorByRules(doc, job);
  assert.equal(result.roles[0].title, "Senior Marketing Manager");
  assert.match(result.roles[0].bullets[0], /cost per lead|onboarding email/);
  assert.match(result.roles[0].bullets.at(-1), /dashboard/);
  assert.equal(result.changed, true);
});

test("nothing is added, dropped or reworded", () => {
  const result = tailorByRules(doc, job);
  const before = doc.roles[0].bullets.slice().sort();
  const after = result.roles[0].bullets.slice().sort();
  assert.deepEqual(after, before);
  assert.deepEqual(result.skills.slice().sort(), doc.skills.slice().sort());
  assert.equal(result.summary, null);
});

test("skills the post names come first", () => {
  const result = tailorByRules({ ...doc, skills: ["Storytelling", "HubSpot", "Paid search", "Lifecycle email"] }, job);
  assert.match(result.skills[0], /^(Paid search|Lifecycle email)/);
});

test("a job post that matches nothing changes nothing", () => {
  const result = tailorByRules(doc, "Zoologist wanted for penguin habitat research in Antarctica.");
  assert.equal(result.changed, false);
  assert.deepEqual(result.roles[0].bullets, doc.roles[0].bullets);
});

test("a role with no bullets is left alone", () => {
  const result = tailorByRules({ roles: [{ title: "Intern", company: "Co", dates: "2020", bullets: [] }], skills: [] }, "paid search budgets");
  assert.deepEqual(result.roles[0].bullets, []);
});

test("roleHeader composes title, company and dates", () => {
  assert.equal(roleHeader({ title: "Designer", company: "Studio", dates: "2019 - 2021" }), "Designer, Studio — 2019 - 2021");
  assert.equal(roleHeader({ title: "Designer", company: "", dates: "" }), "Designer");
});
