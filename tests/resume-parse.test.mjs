import assert from "node:assert/strict";
import test from "node:test";
import { analyzeSources, sampleSources } from "../src/lib/analyze.js";

const resumeText = `Morgan Ellis
Senior Marketing Manager
Austin, TX | morgan.ellis@example.com | (512) 555-0142
SUMMARY
Marketing manager with nine years in B2B SaaS, leading demand generation and a team of four.
EXPERIENCE
Senior Marketing Manager, Brightwave Software, Austin TX (2021 - Present)
Lead a team of four marketers.
Cut cost per lead 22% by moving budget to intent-based channels.
Marketing Manager, Cobalt Analytics, Austin TX (2018 - 2021)
Coordinated with sales and product on six feature launches.
Marketing Associate, Lone Star Outfitters, Dallas TX (2015 - 2018)
Wrote email campaigns for a regional retailer.
EDUCATION
B.A. Communications, University of Texas at Austin, 2015
SKILLS
Demand generation, lifecycle email, HubSpot, Looker`;
const doc = (text) => analyzeSources([{ id: "r", kind: "resume", name: "Resume", text }, { id: "j", kind: "job", name: "Job", text: "Lead growth marketing and lifecycle email for a SaaS company." }], { company: "Co", role: "Growth Lead" }).doc;

test("a resume with real headings keeps its own summary, skills and education", () => {
  const d = doc(resumeText);
  assert.equal(d.summary, "Marketing manager with nine years in B2B SaaS, leading demand generation and a team of four.");
  assert.equal(d.skills, "Demand generation, lifecycle email, HubSpot, Looker");
  assert.equal(d.education, "B.A. Communications, University of Texas at Austin, 2015");
});

test("the newest role is the current role; the rest are earlier, and no heading text leaks into either", () => {
  const d = doc(resumeText);
  assert.match(d.current, /Brightwave/);
  assert.doesNotMatch(d.current, /Cobalt|SUMMARY|EXPERIENCE|EDUCATION|SKILLS/);
  assert.match(d.earlier, /Cobalt/);
  assert.match(d.earlier, /Lone Star/);
  assert.doesNotMatch(d.earlier, /SUMMARY|EDUCATION|SKILLS|B\.A\./);
});

test("a resume with no headings still uses the old guess, and the sample is unchanged", () => {
  const sample = doc(sampleSources.find((s) => s.kind === "resume").text);
  assert.match(sample.current, /Rivermark/);
  assert.match(sample.earlier, /Lume/);
  assert.match(sample.education, /Communications/);
  assert.match(sample.summary, /Brings cross-functional leadership/);
});

test("other sections such as certifications are kept, not dropped", () => {
  const d = doc(`${resumeText}\nCERTIFICATIONS\nHubSpot Inbound Certified`);
  assert.match(d.earlier, /CERTIFICATIONS/);
  assert.match(d.earlier, /HubSpot Inbound Certified/);
});

import { proposeResumeUpdate } from "../src/lib/analyze.js";
test("a contraction at the start of an answer does not leak first person into the resume line", () => {
  const line = proposeResumeUpdate({}, { id: "x" }, "I've directly managed 4 marketers at Brightwave, and I've coached two of them. More text.");
  assert.match(line, /^Directly managed 4 marketers/);
  assert.doesNotMatch(line, /^I/);
});
