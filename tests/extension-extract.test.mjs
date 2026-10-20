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

// ── Description: line breaks kept, Glassdoor metadata block stripped ──
// The CACI pane Danny saved: the JobDetails_jobDescription element holds
// a metadata block (Job Title, Job Category, Time Type, clearance, ...)
// AHEAD of the real description. The description hint must hold the
// description, not the block — while the evidence text keeps it all.
const CACI_PANE_DESC = [
  "Job Title: Staff AI/ML Engineer",
  "Job Category: Science",
  "Time Type: Full time",
  "Minimum Clearance Required to Start: TS/SCI with Polygraph",
  "Employee Type: Regular",
  "Percentage of Travel Required: Up to 10%",
  "Type of Travel: Local",
  "Anticipated Posting End: 11/07/2026",
  "",
  "About the Role:",
  "You will build AI agent systems for mission customers.",
  "",
  "What You'll Do:",
  "Design, build, and deploy agentic workflows.",
].join("\n");

const CACI_META_LABELS = [
  "Job Title:",
  "Job Category:",
  "Time Type:",
  "Minimum Clearance Required to Start:",
  "Employee Type:",
  "Percentage of Travel Required:",
  "Type of Travel:",
  "Anticipated Posting End:",
];

test("pane description: metadata block stripped, paragraphs and line breaks kept", () => {
  const out = extractPageContent({
    title: GD_SEARCH_TITLE,
    innerText: "whole search page text",
    jsonLdTexts: [],
    url: GD_SEARCH_URL,
    doc: glassdoorDoc({ description: CACI_PANE_DESC }),
  });
  assert.equal(out.job.role, "Staff AI/ML Engineer");
  assert.equal(out.job.company, "CACI International");
  for (const label of CACI_META_LABELS) {
    assert.doesNotMatch(out.job.description, new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
  assert.match(out.job.description, /About the Role:/);
  assert.match(out.job.description, /You will build AI agent systems/);
  assert.match(out.job.description, /What You'll Do:/);
  assert.match(out.job.description, /\n/); // structure survived — not one run-on line
  assert.doesNotMatch(out.job.description, /TS\/SCI with Polygraph/);
});

test("pane evidence text keeps the metadata (Analyze still sees clearance, travel)", () => {
  const out = extractPageContent({
    title: GD_SEARCH_TITLE,
    innerText: "whole search page text",
    jsonLdTexts: [],
    url: GD_SEARCH_URL,
    doc: glassdoorDoc({ description: CACI_PANE_DESC }),
  });
  assert.match(out.text, /TS\/SCI with Polygraph/);
  assert.match(out.text, /Percentage of Travel Required: Up to 10%/);
  assert.match(out.text, /About the Role:/);
  assert.match(out.text, /\n/);
});

test("pane description, run-together form: metadata stripped up to the body", () => {
  const runTogether =
    "Job Title: Staff AI/ML Engineer Job Category: Science Time Type: Full time " +
    "Minimum Clearance Required to Start: TS/SCI with Polygraph Employee Type: Regular " +
    "Percentage of Travel Required: Up to 10% Type of Travel: Local Anticipated Posting End: 11/07/2026 " +
    "You will build AI agent systems for mission customers. Design, build, and deploy agentic workflows.";
  const out = extractPageContent({
    title: GD_SEARCH_TITLE,
    innerText: "whole search page text",
    jsonLdTexts: [],
    url: GD_SEARCH_URL,
    doc: glassdoorDoc({ description: runTogether }),
  });
  // Every label except the last one is delimited by the next label and
  // strips cleanly. The last run has no delimiter between its value and
  // the body, so its line is kept rather than risk eating the body.
  for (const label of CACI_META_LABELS.slice(0, -1)) {
    assert.doesNotMatch(out.job.description, new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
  assert.match(out.job.description, /You will build AI agent systems/);
  assert.match(out.job.description, /Design, build, and deploy agentic workflows/);
});

test("pane description that is ONLY metadata falls back to the full text, never blank", () => {
  const onlyMeta = "Job Title: Staff AI/ML Engineer\nJob Category: Science\nTime Type: Full time";
  const out = extractPageContent({
    title: GD_SEARCH_TITLE,
    innerText: "whole search page text",
    jsonLdTexts: [],
    url: GD_SEARCH_URL,
    doc: glassdoorDoc({ description: onlyMeta }),
  });
  assert.match(out.job.description, /Job Title: Staff AI\/ML Engineer/);
});

test("body text that merely starts with a label word is kept, not eaten", () => {
  const body =
    "Salary: competitive pay for a senior engineer in this market, with annual " +
    "bonus, equity, and a full benefits package that grows with tenure and performance. " +
    "You will build AI agent systems for mission customers.";
  const out = extractPageContent({
    title: GD_SEARCH_TITLE,
    innerText: "whole search page text",
    jsonLdTexts: [],
    url: GD_SEARCH_URL,
    doc: glassdoorDoc({ description: body }),
  });
  assert.match(out.job.description, /Salary: competitive pay/);
  assert.match(out.job.description, /You will build AI agent systems/);
});

test("JSON-LD HTML description keeps paragraph breaks, not one run-on line", () => {
  const ld = JSON.stringify({
    "@type": "JobPosting",
    title: "Senior Product Manager",
    hiringOrganization: { name: "Nestwell" },
    description:
      "<p>Lead the roadmap for our home products.</p><p>You will own pricing and launches.</p><ul><li>Own the roadmap</li><li>Talk to customers</li></ul>",
  });
  const out = extractPageContent({
    title: "Senior Product Manager",
    innerText: "x",
    jsonLdTexts: [ld],
    url: "https://example.com/jobs/1",
  });
  assert.match(out.job.description, /Lead the roadmap for our home products\.\nYou will own pricing/);
  assert.match(out.job.description, /Own the roadmap\nTalk to customers/);
  assert.doesNotMatch(out.job.description, /<p>|<li>/);
});

test("fallback page text keeps line breaks", () => {
  const out = extractPageContent({
    title: "T",
    innerText: "line one\n\nline two\nline three",
    jsonLdTexts: [],
    url: "https://example.com/1",
  });
  assert.equal(out.text, "line one\n\nline two\nline three");
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

// ── Payload flags the search-page case for the app ────────────────────────

test("payload flags searchPage only for search/listing pages with no pane", () => {
  const searchNoPane = extractPageContent({
    title: GD_SEARCH_TITLE,
    innerText: "search page text",
    jsonLdTexts: [],
    url: GD_SEARCH_URL,
    doc: { querySelector: () => null },
  });
  assert.equal(searchNoPane.searchPage, true);
  const searchWithPane = extractPageContent({
    title: GD_SEARCH_TITLE,
    innerText: "search page text",
    jsonLdTexts: [],
    url: GD_SEARCH_URL,
    doc: glassdoorDoc(),
  });
  assert.equal(searchWithPane.searchPage, false);
  const single = extractPageContent({
    title: "Staff AI/ML Engineer",
    innerText: "x",
    jsonLdTexts: [],
    url: "https://www.glassdoor.com/job-listing/staff-ai-ml-engineer-caci-international-JV_IC123.htm",
  });
  assert.equal(single.searchPage, false);
});

// ── Multiple pane headers: the VISIBLE one wins ───────────────────────────
// The real Glassdoor search page carries TWO pane headers for the same job
// (pane + sticky header); a stale hidden pane for a previously viewed job
// is possible. Elements report visibility via getClientRects; elements
// without layout info (older fakes) count as visible.
function visEl(innerText, children = {}, visible = true) {
  return {
    innerText,
    querySelector: (sel) => children[sel] || null,
    getClientRects: () => (visible ? [{}] : []),
  };
}

function multiHeaderDoc(headers, descs = []) {
  const bySelector = {
    'header[data-test="job-details-header"]': headers,
    '[class*="JobDetails_jobDetailsHeaderWrapper"]': [],
    '[class*="JobDetails_jobDescription"]': descs,
  };
  return {
    querySelector: (sel) => (bySelector[sel] || [])[0] || null,
    querySelectorAll: (sel) => [...(bySelector[sel] || [])],
  };
}

function paneHeader(role, company, visible = true) {
  return visEl(
    `${company}\n${role}`,
    {
      'h1[id^="jd-job-title-"]': visEl(role, {}, visible),
      h1: visEl(role, {}, visible),
      '[class*="EmployerProfile_employerNameHeading"] h4': visEl(company, {}, visible),
      h4: visEl(company, {}, visible),
    },
    visible,
  );
}

test("hidden stale header + visible current header: the visible job wins", () => {
  const out = extractPageContent({
    title: GD_SEARCH_TITLE,
    innerText: "search page text",
    jsonLdTexts: [],
    url: GD_SEARCH_URL,
    doc: multiHeaderDoc([
      paneHeader("Stale Old Job", "Stale Co", false),
      paneHeader("Staff AI/ML Engineer", "CACI International", true),
    ]),
  });
  assert.equal(out.job.role, "Staff AI/ML Engineer");
  assert.equal(out.job.company, "CACI International");
});

test("all headers hidden: first header with a role wins (fallback, never nothing)", () => {
  const out = extractPageContent({
    title: GD_SEARCH_TITLE,
    innerText: "search page text",
    jsonLdTexts: [],
    url: GD_SEARCH_URL,
    doc: multiHeaderDoc([
      paneHeader("Stale Old Job", "Stale Co", false),
      paneHeader("Staff AI/ML Engineer", "CACI International", false),
    ]),
  });
  assert.equal(out.job.role, "Stale Old Job");
});

test("hidden description + visible description: the visible description wins", () => {
  const desc = (text, visible) => visEl(text, {}, visible);
  const out = extractPageContent({
    title: GD_SEARCH_TITLE,
    innerText: "search page text",
    jsonLdTexts: [],
    url: GD_SEARCH_URL,
    doc: multiHeaderDoc(
      [paneHeader("Staff AI/ML Engineer", "CACI International", true)],
      [
        desc("Hidden stale description text that is long enough to pass every length gate in the pipeline.", false),
        desc("Visible current description text that is long enough to pass every length gate in the pipeline.", true),
      ],
    ),
  });
  assert.match(out.job.description, /Visible current description/);
  assert.doesNotMatch(out.job.description, /Hidden stale/);
});

// LinkedIn's open job (split-view search). Selector prefixes were checked
// against a live, logged-in LinkedIn job page on 2026-10-20.
test("LinkedIn split-view search page: the open job is read from its detail pane", () => {
  const els = {
    '[class*="job-details-jobs-unified-top-card__job-title"]': fakeEl("AI Agent Engineer - US Remote "),
    '[class*="job-details-jobs-unified-top-card__company-name"]': fakeEl("TRM Labs"),
    "#job-details": fakeEl("About the job\n\nBuild a Safer World.\n\nTRM Labs provides AI-powered blockchain intelligence for teams that investigate financial crime."),
  };
  const out = extractPageContent({
    title: "(21) AI Agent Engineer TRM Labs Jobs in United States | LinkedIn",
    innerText: "search page noise",
    jsonLdTexts: [],
    url: "https://www.linkedin.com/jobs/search/?currentJobId=4389951823&keywords=AI%20Agent%20Engineer",
    doc: { querySelector: (sel) => els[sel] || null },
  });
  assert.equal(out.searchPage, false);
  assert.equal(out.job.role, "AI Agent Engineer - US Remote");
  assert.equal(out.job.company, "TRM Labs");
  assert.match(out.job.description, /^Build a Safer World/);
  assert.match(out.text, /TRM Labs/);
  assert.doesNotMatch(out.text, /search page noise/);
});

test("LinkedIn search page with no open job pane is still treated as a search page", () => {
  const out = extractPageContent({
    title: "20,791 Ai agent engineer jobs in United States | LinkedIn",
    innerText: "a list of many jobs",
    jsonLdTexts: [],
    url: "https://www.linkedin.com/jobs/search/?keywords=ai%20agent",
    doc: { querySelector: () => null },
  });
  assert.equal(out.searchPage, true);
  assert.equal(out.job.role, "");
});

// LinkedIn's single-job page (/jobs/view/…) has scrambled class names.
// Shape checked live 2026-10-20: tab title "Role | Company | LinkedIn", the
// description in a data-testid="expandable-text-box" under an "About the
// job" heading, and a second such box ("About the company") further down.
test("LinkedIn single-job page: role and company from the tab title, description under 'About the job'", () => {
  const descBox = fakeEl("Product Manager – Automotive Aftermarket\n\nPensacola, FL | Full-Time | On-Site\n\nHolstein Parts is a fast-growing automotive aftermarket supplier.");
  const section = { querySelector: (sel) => (sel === '[data-testid="expandable-text-box"]' ? descBox : null), parentElement: null };
  const headingWrap = { querySelector: () => null, parentElement: section };
  const heading = { innerText: "About the job", querySelector: () => null, parentElement: headingWrap };
  const other = { innerText: "About the company", querySelector: () => null, parentElement: null };
  const doc = {
    title: "(1) Product Manager – Automotive Aftermarket | Holstein Parts | LinkedIn",
    querySelector: () => null,
    querySelectorAll: (sel) => (sel === "h2" ? [other, heading] : []),
  };
  const out = extractPageContent({
    title: doc.title,
    innerText: "whole page noise",
    jsonLdTexts: [],
    url: "https://www.linkedin.com/jobs/view/4416907073/",
    doc,
  });
  assert.equal(out.searchPage, false);
  assert.equal(out.job.role, "Product Manager – Automotive Aftermarket");
  assert.equal(out.job.company, "Holstein Parts");
  assert.match(out.job.description, /fast-growing automotive aftermarket supplier/);
  assert.doesNotMatch(out.text, /whole page noise/);
});
