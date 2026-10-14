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
  assert.deepEqual(d.skills, ["Demand generation", "lifecycle email", "HubSpot", "Looker"]);
  assert.deepEqual(d.education, ["B.A. Communications, University of Texas at Austin, 2015"]);
});

test("experience splits into structured roles; no heading text leaks into any role", () => {
  const d = doc(resumeText);
  assert.equal(d.roles.length, 3);
  assert.equal(d.roles[0].title, "Senior Marketing Manager");
  assert.equal(d.roles[0].company, "Brightwave Software");
  assert.equal(d.roles[0].dates, "2021 - Present");
  assert.deepEqual(d.roles[0].bullets, ["Lead a team of four marketers.", "Cut cost per lead 22% by moving budget to intent-based channels."]);
  assert.equal(d.roles[1].company, "Cobalt Analytics");
  assert.equal(d.roles[2].company, "Lone Star Outfitters");
  const flat = JSON.stringify(d.roles);
  assert.doesNotMatch(flat, /SUMMARY|EXPERIENCE|EDUCATION|SKILLS/);
});

test("a resume with no headings still parses, and the sample is unchanged", () => {
  const sample = doc(sampleSources.find((s) => s.kind === "resume").text);
  assert.equal(sample.roles[0].company, "Rivermark Health");
  assert.equal(sample.roles[0].title, "Senior Brand Marketing Manager");
  assert.equal(sample.roles[1].company, "Lume Collective");
  assert.match(sample.education.join(" "), /Communications/);
  assert.match(sample.summary, /Brings cross-functional leadership/);
});

test("other sections such as certifications are kept, not dropped", () => {
  const d = doc(`${resumeText}\nCERTIFICATIONS\nHubSpot Inbound Certified`);
  assert.match(d.education.join(" "), /HubSpot Inbound Certified/);
});

test("headings glued to line starts are detected", () => {
  const d = doc(`Ava Chen\nDesigner\nava@example.com\nSummary Product designer with six years in SaaS.\nExperience\nDesigner, Northwind (2019 - Present)\nShipped the billing revamp.`);
  assert.equal(d.summary, "Product designer with six years in SaaS.");
  assert.equal(d.roles[0].title, "Designer");
  assert.equal(d.roles[0].company, "Northwind");
});

test("a wrapped LinkedIn-style line still splits roles on date ranges", () => {
  const d = doc(`Sam Park\nFounder\nsam@example.com\nFounder, NoLimit Labs (2022 -\nPresent) Shipped three apps.\nDesigner, Studio K (2019 - 2021)\nRan the rebrand.`);
  assert.equal(d.roles.length, 2);
  assert.equal(d.roles[0].dates, "2022 - Present");
  assert.match(d.roles[0].bullets.join(" "), /Shipped three apps/);
});

import { proposeResumeUpdate } from "../src/lib/analyze.js";
test("a contraction at the start of an answer does not leak first person into the resume line", () => {
  const line = proposeResumeUpdate({}, { id: "x" }, "I've directly managed 4 marketers at Brightwave, and I've coached two of them. More text.");
  assert.match(line, /^Directly managed 4 marketers/);
  assert.doesNotMatch(line, /^I/);
});

test("repeated per-page headers never become bullets", () => {
  // LinkedIn stamps "Danny Jones Resume" + "Page X of Y" on every page.
  // When the footer splits across extraction lines, the name half survives
  // the footer strip — it must not parse as a bullet, nor may a name
  // fragment stranded after a date range ("(2009 - 2017) Danny").
  const d = doc(`Danny Jones
Founder & AI Product Builder | 1st Assistant Director
Los Angeles, CA | dannyjones.ai | nolimitjones@gmail.com | 605-484-3913
Summary Product builder with 4 years of shipping apps.
Experience Founder & AI Product Builder, NoLimit Labs (2022 - Present)
Design, direct, and ship products end to end.
Key 2nd Assistant Director, Freelance (2009 - 2017) Danny
Danny Jones Resume
Supervised 2nd ADs and PAs.
Photographer, Danny Jones Photography (2000 - Present)
Photographed actors, weddings, film sets, and landscapes. Teamed with Danny Jones on the launch.`);
  const flat = JSON.stringify(d.roles);
  assert.doesNotMatch(flat, /"Danny"/);
  assert.doesNotMatch(flat, /Danny Jones Resume/);
  const second = d.roles.find((r) => r.title === "Key 2nd Assistant Director");
  assert.deepEqual(second.bullets, ["Supervised 2nd ADs and PAs."]);
  const photo = d.roles.find((r) => r.title === "Photographer");
  assert.ok(photo.bullets.some((b) => /Teamed with Danny Jones on the launch/.test(b)), "a bullet that merely mentions the name survives");
});
