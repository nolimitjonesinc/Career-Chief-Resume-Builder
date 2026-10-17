import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

// extension/extract.js is a classic script (content scripts cannot import
// ESM), so load it through vm and read the API off the sandbox — the same
// code the content script runs.
function loadExtract() {
  const code = readFileSync(new URL("../extension/extract.js", import.meta.url), "utf8");
  // Seed the globals the extractor relies on in both real runtimes
  // (browser content script / service worker): URL, TextEncoder,
  // TextDecoder, atob, btoa.
  const sandbox = { URL, TextEncoder, TextDecoder, atob, btoa };
  vm.createContext(sandbox);
  vm.runInContext(code, sandbox);
  return sandbox.CareerChiefExtract;
}

const { extractPageContent, encodeImportPayload, decodeImportPayload } = loadExtract();

const JOB_LD = JSON.stringify({
  "@context": "https://schema.org",
  "@type": "JobPosting",
  title: "Senior Product Manager",
  hiringOrganization: { "@type": "Organization", name: "Nestwell" },
  description: "<p>Lead the roadmap for our home products.</p><p>You will own pricing and launches.</p>",
});

test("JSON-LD JobPosting wins: role, company, and HTML-stripped description", () => {
  const out = extractPageContent({
    title: "Something Else | LinkedIn",
    innerText: "page text here",
    jsonLdTexts: [JOB_LD],
    url: "https://example.com/jobs/1",
  });
  assert.equal(out.job.role, "Senior Product Manager");
  assert.equal(out.job.company, "Nestwell");
  assert.match(out.job.description, /Lead the roadmap/);
  assert.doesNotMatch(out.job.description, /<p>/);
  assert.equal(out.text, "page text here");
});

test("title fallback: 'Role at Company' and 'Role | Company'", () => {
  const at = extractPageContent({ title: "Staff Engineer at Acme", innerText: "x", jsonLdTexts: [], url: "https://example.com/1" });
  assert.equal(at.job.role, "Staff Engineer");
  assert.equal(at.job.company, "Acme");
  const pipe = extractPageContent({ title: "Designer | Acme", innerText: "x", jsonLdTexts: [], url: "https://example.com/1" });
  assert.equal(pipe.job.role, "Designer");
  assert.equal(pipe.job.company, "Acme");
});

test("a job board's own name is never taken as the company", () => {
  const out = extractPageContent({ title: "Staff Engineer | LinkedIn", innerText: "x", jsonLdTexts: [], url: "https://www.linkedin.com/jobs/view/1" });
  assert.equal(out.job.role, "Staff Engineer");
  assert.equal(out.job.company, "");
});

test("company comes from a job-board address when the title has none", () => {
  const out = extractPageContent({ title: "Open roles", innerText: "x", jsonLdTexts: [], url: "https://boards.greenhouse.io/nest-well/jobs/123" });
  assert.equal(out.job.company, "Nest Well");
});

test("malformed JSON-LD is ignored and the title fallback still applies", () => {
  const out = extractPageContent({ title: "Designer at Acme", innerText: "x", jsonLdTexts: ["{not json"], url: "https://example.com/1" });
  assert.equal(out.job.role, "Designer");
  assert.equal(out.job.company, "Acme");
});

test("visible text is capped at 50,000 chars", () => {
  const out = extractPageContent({ title: "T", innerText: "a".repeat(60_000), jsonLdTexts: [], url: "https://example.com/1" });
  assert.equal(out.text.length, 50_000);
});

test("encode/decode round-trips a payload with unicode", () => {
  const payload = { title: "Rôle — ünïcode ✓", text: "café text", url: "https://example.com/1", job: { role: "R", company: "C", description: "D" } };
  // Compare via JSON: decode runs inside the vm sandbox, so its objects
  // carry a different prototype and deepStrictEqual would fail on that
  // alone despite identical content.
  assert.equal(JSON.stringify(decodeImportPayload(encodeImportPayload(payload))), JSON.stringify(payload));
});

// ── Split-view pages: the VIEWED job's detail pane wins ──────────────────
// Fake DOM: elements are { innerText, querySelector } keyed by the exact
// selectors the extractor queries. The selectors themselves are grounded
// in the real Glassdoor search page inspected 2026-10-17; these tests
// verify the combination logic (which selectors are queried, how the
// results combine, what is never trusted).
function fakeEl(innerText, children = {}) {
  return {
    innerText,
    querySelector: (sel) => children[sel] || null,
  };
}

function glassdoorDoc({
  title = "Staff AI/ML Engineer",
  company = "CACI International",
  description = "A".repeat(100),
  header = true,
  desc = true,
} = {}) {
  const headerEl = header
    ? fakeEl(
        // Real DOM innerText includes descendants' text; the fake must
        // compose it the same way or pane-text assertions test the fake.
        `${company} ${title} header text`,
        {
          'h1[id^="jd-job-title-"]': fakeEl(title),
          h1: fakeEl(title),
          '[class*="EmployerProfile_employerNameHeading"] h4': fakeEl(company),
          h4: fakeEl(company),
        },
      )
    : null;
  const descEl = desc ? fakeEl(description) : null;
  return {
    querySelector: (sel) => {
      if (sel === 'header[data-test="job-details-header"]') return headerEl;
      if (sel === '[class*="JobDetails_jobDetailsHeaderWrapper"]') return null;
      if (sel === '[class*="JobDetails_jobDescription"]') return descEl;
      return null;
    },
  };
}

const GD_SEARCH_URL = "https://www.glassdoor.com/Job/ai-agent-engineer-jobs-SRCH_KO0,17.htm";
const GD_SEARCH_TITLE = "20,630 Ai agent engineer jobs in United States";

test("split-view Glassdoor: the viewed job's pane wins, not the search title", () => {
  const out = extractPageContent({
    title: GD_SEARCH_TITLE,
    innerText: "whole search page text with many listings",
    jsonLdTexts: [],
    url: GD_SEARCH_URL,
    doc: glassdoorDoc(),
  });
  assert.equal(out.job.role, "Staff AI/ML Engineer");
  assert.equal(out.job.company, "CACI International");
  assert.equal(out.job.description, "A".repeat(100));
  assert.equal(out.title, "Staff AI/ML Engineer at CACI International");
  assert.match(out.text, /Staff AI\/ML Engineer/);
  assert.doesNotMatch(out.text, /whole search page text/);
});

test("search page with no detail pane: role stays blank, no junk", () => {
  const out = extractPageContent({
    title: GD_SEARCH_TITLE,
    innerText: "search page text",
    jsonLdTexts: [],
    url: GD_SEARCH_URL,
    doc: { querySelector: () => null },
  });
  assert.equal(out.job.role, "");
  assert.equal(out.job.company, "");
  assert.equal(out.job.description, "");
  assert.equal(out.text, "search page text");
});

test("search page with multiple JobPosting blocks and no pane: JSON-LD is skipped, role stays blank", () => {
  const ld = (title, company) =>
    JSON.stringify({ "@type": "JobPosting", title, hiringOrganization: { name: company }, description: "x".repeat(100) });
  const out = extractPageContent({
    title: GD_SEARCH_TITLE,
    innerText: "search page text",
    jsonLdTexts: [ld("Wrong Job One", "Wrong Co"), ld("Wrong Job Two", "Wrong Co 2")],
    url: GD_SEARCH_URL,
    doc: { querySelector: () => null },
  });
  assert.equal(out.job.role, "");
  assert.equal(out.job.company, "");
  assert.equal(out.job.description, "");
});

test("pane beats decoy JSON-LD on a search page", () => {
  const ld = JSON.stringify({ "@type": "JobPosting", title: "Decoy Job", hiringOrganization: { name: "Decoy Co" }, description: "z".repeat(100) });
  const out = extractPageContent({
    title: GD_SEARCH_TITLE,
    innerText: "search page text",
    jsonLdTexts: [ld],
    url: GD_SEARCH_URL,
    doc: glassdoorDoc(),
  });
  assert.equal(out.job.role, "Staff AI/ML Engineer");
  assert.equal(out.job.company, "CACI International");
});

test("pane header without a title is ignored: search page stays blank", () => {
  const doc = {
    querySelector: (sel) =>
      sel === 'header[data-test="job-details-header"]' ? fakeEl("header text", {}) : null,
  };
  const out = extractPageContent({
    title: GD_SEARCH_TITLE,
    innerText: "search page text",
    jsonLdTexts: [],
    url: GD_SEARCH_URL,
    doc,
  });
  assert.equal(out.job.role, "");
  assert.equal(out.job.company, "");
});

test("no guessed selectors for other sites: LinkedIn search stays blank even with a pane-like DOM", () => {
  const out = extractPageContent({
    title: "AI Jobs | LinkedIn",
    innerText: "search page text",
    jsonLdTexts: [],
    url: "https://www.linkedin.com/jobs/search/?keywords=ai",
    doc: glassdoorDoc(),
  });
  assert.equal(out.job.role, "");
  assert.equal(out.job.company, "");
});

test("title-count guard: a search-count title never becomes a role, even on a plain URL", () => {
  const out = extractPageContent({
    title: "20,630 Ai agent engineer jobs in United States",
    innerText: "x",
    jsonLdTexts: [],
    url: "https://example.com/some-page",
  });
  assert.equal(out.job.role, "");
});

test("single-job page: when several JobPosting blocks exist, the one matching the page title wins", () => {
  const ld = (title, company) =>
    JSON.stringify({ "@type": "JobPosting", title, hiringOrganization: { name: company }, description: "p".repeat(100) });
  const out = extractPageContent({
    title: "Staff AI/ML Engineer",
    innerText: "x",
    jsonLdTexts: [ld("Other Job", "Other Co"), ld("Staff AI/ML Engineer", "CACI International")],
    url: "https://www.glassdoor.com/job-listing/staff-ai-ml-engineer-caci-international-JV_IC123.htm",
  });
  assert.equal(out.job.role, "Staff AI/ML Engineer");
  assert.equal(out.job.company, "CACI International");
});
