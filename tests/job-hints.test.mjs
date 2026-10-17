import test from "node:test";
import assert from "node:assert/strict";
import { jobHints, extractPublicUrl } from "../shared/url-extract.mjs";

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

test("a bare title with no separator yields no guesses", () => {
  const hints = jobHints("<html></html>", "Careers", "https://example.com/jobs/1");
  assert.equal(hints.role, "");
  assert.equal(hints.company, "");
  assert.equal(hints.description, "");
});

test("extractPublicUrl returns job hints alongside the page text", async () => {
  const html = `<html><head><title>Senior Product Manager at Nestwell</title><script type="application/ld+json">${JSON.stringify({ "@type": "JobPosting", title: "Senior Product Manager", hiringOrganization: { name: "Nestwell" }, description: "<p>Lead the roadmap for our home products. You will own pricing and launches across teams, and you will be accountable for outcomes.</p>" })}</script></head><body>${"We are hiring for a great role on a great team. ".repeat(5)}</body></html>`;
  const result = await extractPublicUrl(
    "https://nestwell.com/jobs/1",
    async () => new Response(html, { headers: { "content-type": "text/html" } }),
    { resolve: async () => ["93.184.216.34"] },
  );
  assert.equal(result.job.role, "Senior Product Manager");
  assert.equal(result.job.company, "Nestwell");
  assert.match(result.job.description, /^Lead the roadmap/);
  assert.ok(result.text.length >= 80);
});
