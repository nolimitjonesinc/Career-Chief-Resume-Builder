import assert from "node:assert/strict";
import test from "node:test";
import { compareJobs } from "../src/lib/compare.js";
import { sampleTransformation } from "../src/lib/analyze.js";

const sources = [{ id: "r", kind: "resume", text: "Designed the cloud infrastructure and shipped the API platform. Built the analytics dashboard and tracked metrics weekly. Managed budget and forecast for the group. Led product roadmap planning." }];

test("each job gets its own emphasis, with proof, from the same evidence", () => {
  const result = compareJobs(sources, [], [
    { id: "a", title: "Platform Engineer", text: "We need cloud infrastructure and API architecture experience for our platform." },
    { id: "b", title: "Product Analyst", text: "Own our analytics, metrics and dashboards and shape the product roadmap." },
  ]);
  assert.equal(result.jobs.length, 2);
  assert.equal(result.jobs[0].leadWith[0].key, "engineering");
  assert.ok(result.jobs[1].leadWith.some((item) => item.key === "analytics"));
  assert.ok(result.jobs[0].leadWith[0].evidence.length > 10);
  assert.ok(result.jobs[0].distinct.some((item) => item.key === "engineering"));
});

test("answers the user approved count as evidence for every job", () => {
  const none = compareJobs([{ id: "r", kind: "resume", text: "Worked at a company." }], [], [{ id: "a", title: "A", text: "Own compliance, audit and governance for our security program." }]);
  assert.equal(none.jobs[0].gaps.length > 0, true);
  const withAnswer = compareJobs([{ id: "r", kind: "resume", text: "Worked at a company." }], ["I ran our SOC 2 audit and set up governance controls for security."], [{ id: "a", title: "A", text: "Own compliance, audit and governance for our security program." }]);
  assert.equal(withAnswer.jobs[0].gaps.length, 0);
});

test("a stronger match is named, a tie is not, and short posts are ignored", () => {
  const strong = { id: "a", title: "A", text: "cloud infrastructure and API architecture and software engineering" };
  const weak = { id: "b", title: "B", text: "Own our compliance, audit and regulatory program for the whole company" };
  assert.equal(compareJobs(sources, [], [strong, weak]).bestId, "a");
  assert.equal(compareJobs(sources, [], [strong, { ...strong, id: "c" }]).bestId, null);
  assert.equal(compareJobs(sources, [], [{ id: "x", title: "x", text: "short" }]).jobs.length, 0);
});

test("never more than three jobs", () => {
  const job = (id) => ({ id, title: id, text: "cloud infrastructure and API architecture roles" });
  assert.equal(compareJobs(sources, [], ["1", "2", "3", "4"].map(job)).jobs.length, 3);
});

test("homepage before/after is generated from the real sample and real proposal logic", () => {
  const t = sampleTransformation();
  assert.match(t.said, /partnerships/);
  assert.match(t.asked, /personally build/);
  assert.match(t.became, /^Built a customer and expert content program/);
  assert.ok(!/\bI\b/.test(t.became));
});
