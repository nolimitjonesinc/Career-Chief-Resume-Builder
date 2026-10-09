import test from "node:test";
import assert from "node:assert/strict";
import { jobHints } from "../shared/url-extract.mjs";

test("reads structured job data when the page has it", () => {
  const raw = `<script type="application/ld+json">${JSON.stringify({ "@type": "JobPosting", title: "Senior Product Manager", hiringOrganization: { name: "Nestwell" }, description: "&lt;p&gt;Lead the roadmap for our home products. You will own pricing &amp;amp; launches across teams.&lt;/p&gt;" })}</script>`;
  const hints = jobHints(raw, "Careers", "https://nestwell.com/jobs/1");
  assert.equal(hints.role, "Senior Product Manager");
  assert.equal(hints.company, "Nestwell");
  assert.match(hints.description, /^Lead the roadmap/);
  assert.ok(!hints.description.includes("<p>"));
});

test("finds the job inside a graph", () => {
  const raw = `<script type="application/ld+json">${JSON.stringify({ "@graph": [{ "@type": "WebSite" }, { "@type": "JobPosting", title: "Designer", hiringOrganization: "Acme" }] })}</script>`;
  const hints = jobHints(raw, "x", "https://acme.com/j");
  assert.equal(hints.role, "Designer");
  assert.equal(hints.company, "Acme");
});

test("falls back to the page title: role at company", () => {
  const hints = jobHints("<html></html>", "Head of Growth at Nestwell - Jobs", "https://nestwell.com/j");
  assert.equal(hints.role, "Head of Growth");
  assert.equal(hints.company, "Nestwell");
});

test("never takes a job board's name as the company", () => {
  const hints = jobHints("<html></html>", "Data Analyst | LinkedIn", "https://www.linkedin.com/jobs/view/1");
  assert.equal(hints.role, "Data Analyst");
  assert.equal(hints.company, "");
});

test("reads the company from a job-board address", () => {
  const hints = jobHints("<html></html>", "Careers", "https://boards.greenhouse.io/nest-well/jobs/123");
  assert.equal(hints.company, "Nest Well");
});

test("bad structured data does not crash and returns blanks", () => {
  const hints = jobHints('<script type="application/ld+json">{oops</script>', "Home", "https://example.com/");
  assert.equal(hints.role, "");
  assert.equal(hints.description, "");
});
