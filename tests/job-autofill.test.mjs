import test from "node:test";
import assert from "node:assert/strict";
import { applyJobHints } from "../src/lib/job-autofill.js";

const EMPTY = { company: "", role: "" };
const HINTS = {
  role: "Senior Product Manager",
  company: "Nestwell",
  description: "Lead the roadmap for our home products. You will own pricing and launches across teams, and you will be accountable for outcomes.",
};

test("fills every empty field from the hints", () => {
  const applied = applyJobHints(EMPTY, "", HINTS);
  assert.equal(applied.meta.role, "Senior Product Manager");
  assert.equal(applied.meta.company, "Nestwell");
  assert.equal(applied.jobText, HINTS.description);
  assert.deepEqual(applied.filled, ["role", "company", "job description"]);
});

test("never overwrites anything the user already typed", () => {
  const applied = applyJobHints(
    { company: "Acme", role: "Designer" },
    "My pasted description.",
    HINTS,
  );
  assert.equal(applied.meta.role, "Designer");
  assert.equal(applied.meta.company, "Acme");
  assert.equal(applied.jobText, "My pasted description.");
  assert.deepEqual(applied.filled, []);
});

test("fills only the empty fields when some are already typed", () => {
  const applied = applyJobHints({ company: "", role: "Designer" }, "", HINTS);
  assert.equal(applied.meta.role, "Designer");
  assert.equal(applied.meta.company, "Nestwell");
  assert.deepEqual(applied.filled, ["company", "job description"]);
});

test("a short description is not used — leave the field blank rather than guess", () => {
  const applied = applyJobHints(EMPTY, "", { ...HINTS, description: "Too short." });
  assert.equal(applied.jobText, "");
  assert.deepEqual(applied.filled, ["role", "company"]);
});

test("empty or missing hints change nothing", () => {
  for (const job of [undefined, null, {}, { role: "", company: "", description: "" }]) {
    const applied = applyJobHints(EMPTY, "", job);
    assert.deepEqual(applied.meta, EMPTY);
    assert.equal(applied.jobText, "");
    assert.deepEqual(applied.filled, []);
  }
});

test("whitespace-only fields count as empty", () => {
  const applied = applyJobHints({ company: "   ", role: "\n" }, "   ", HINTS);
  assert.equal(applied.meta.role, "Senior Product Manager");
  assert.equal(applied.meta.company, "Nestwell");
  assert.equal(applied.jobText, HINTS.description);
});

test("non-string hints are ignored, never coerced into a field", () => {
  const applied = applyJobHints(EMPTY, "", { role: 42, company: null, description: 99 });
  assert.deepEqual(applied.meta, EMPTY);
  assert.equal(applied.jobText, "");
  assert.deepEqual(applied.filled, []);
});
