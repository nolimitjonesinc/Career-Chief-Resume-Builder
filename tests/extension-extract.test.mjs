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
