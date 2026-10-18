import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { decodeImportFragment, isDuplicateSource, stripImportFragment, summarizeExtensionImport } from "../src/lib/extension-import.js";

function makeFragment(payload) {
  const encoded = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  return `#import=${encoded}`;
}

const PAYLOAD = {
  title: "Staff Engineer at Acme",
  text: "Job description text from the page.",
  url: "https://example.com/jobs/1",
  job: { role: "Staff Engineer", company: "Acme", description: "" },
};

test("a valid fragment decodes to the payload", () => {
  const out = decodeImportFragment(makeFragment(PAYLOAD));
  assert.equal(out.title, PAYLOAD.title);
  assert.equal(out.text, PAYLOAD.text);
  assert.equal(out.url, PAYLOAD.url);
  assert.deepEqual(out.job, PAYLOAD.job);
});

test("malformed fragments are ignored, never throw", () => {
  assert.equal(decodeImportFragment(""), null);
  assert.equal(decodeImportFragment("#other=abc"), null);
  assert.equal(decodeImportFragment("#import="), null);
  assert.equal(decodeImportFragment("#import=!!!not-base64!!!"), null);
  assert.equal(decodeImportFragment(`#import=${Buffer.from("not json", "utf8").toString("base64url")}`), null);
  assert.equal(decodeImportFragment("#import=" + Buffer.from("[1,2,3]", "utf8").toString("base64url")), null);
});

test("wrong shapes are rejected: missing fields, non-string fields, bad URLs", () => {
  assert.equal(decodeImportFragment(makeFragment({ ...PAYLOAD, text: undefined })), null);
  assert.equal(decodeImportFragment(makeFragment({ ...PAYLOAD, url: 42 })), null);
  assert.equal(decodeImportFragment(makeFragment({ ...PAYLOAD, url: "javascript:alert(1)" })), null);
  assert.equal(decodeImportFragment(makeFragment({ ...PAYLOAD, url: "ftp://example.com/x" })), null);
});

test("a missing job object degrades to empty hints, not a rejection", () => {
  const { job, ...rest } = PAYLOAD;
  assert.deepEqual(decodeImportFragment(makeFragment(rest)).job, {});
});

test("oversized text is truncated to the 50k cap, not rejected", () => {
  const out = decodeImportFragment(makeFragment({ ...PAYLOAD, text: "a".repeat(60_000) }));
  assert.equal(out.text.length, 50_000);
});

test("stripImportFragment removes only the #import= fragment", () => {
  assert.equal(
    stripImportFragment("https://careerchief.ai/#import=abc123"),
    "https://careerchief.ai/",
  );
  assert.equal(
    stripImportFragment("https://careerchief.ai/?x=1#import=abc"),
    "https://careerchief.ai/?x=1",
  );
  assert.equal(
    stripImportFragment("https://careerchief.ai/#other=abc"),
    "https://careerchief.ai/#other=abc",
  );
});

test("decode carries the searchPage flag; old payloads without it default to false", () => {
  assert.equal(decodeImportFragment(makeFragment({ ...PAYLOAD, searchPage: true })).searchPage, true);
  assert.equal(decodeImportFragment(makeFragment({ ...PAYLOAD, searchPage: false })).searchPage, false);
  assert.equal(decodeImportFragment(makeFragment(PAYLOAD)).searchPage, false);
});

test("App wires the import: decode on load, strip the fragment, decision via summarizeExtensionImport", () => {
  const app = readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8");
  assert.match(app, /decodeImportFragment\(window\.location\.hash\)/);
  assert.match(app, /stripImportFragment\(window\.location\.href\)/);
  assert.match(app, /summarizeExtensionImport\(payload,/);
  assert.match(app, /say\(result\.message\)/);
  // The decision lives in the helper, not inline in the effect.
  assert.doesNotMatch(app, /if \(!payload\) return;/);
});

test("summarizeExtensionImport lives in extension-import.js and runs the same auto-fill path", () => {
  const lib = readFileSync(new URL("../src/lib/extension-import.js", import.meta.url), "utf8");
  assert.match(lib, /applyJobHints\(/);
});

test("a #import= fragment that fails to decode speaks through the dock, never silently", () => {
  const app = readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8");
  // The old silent path (`if (!payload) return;`) is gone: a present-but-bad
  // fragment must surface a dock message instead of doing nothing.
  assert.doesNotMatch(app, /if \(!payload\) return;/);
  assert.match(app, /window\.location\.hash\.startsWith\("#import="\)/);
  assert.match(app, /say\("That saved page couldn't be read\. Try saving it again from the job page, or paste the job text instead\."\)/);
});

test("dock never claims a fill that did not happen: the decision function owns every message", () => {
  // Search save with non-blank hints still fills nothing and adds nothing.
  const out = summarizeExtensionImport(
    {
      title: "20,630 Ai agent engineer jobs in United States",
      text: "search page text",
      url: "https://www.glassdoor.com/Job/ai-agent-engineer-jobs-SRCH_KO0,17.htm",
      job: { role: "Bogus", company: "Bogus Co", description: "x".repeat(200) },
      searchPage: true,
    },
    { meta: { role: "", company: "" }, jobText: "", sources: [] },
  );
  assert.equal(out.skipped, true);
  assert.equal(out.source, null);
  assert.deepEqual(out.applied.filled, []);
  assert.match(out.message, /That was a search page, not a single job/);
  assert.match(out.message, /Click the job you want, then Save/);
  assert.doesNotMatch(out.message, /filled in the/);
});

// ── summarizeExtensionImport: the whole import decision ────────────────

const CACI_PAYLOAD = {
  title: "Staff AI/ML Engineer at CACI International",
  text: "pane text",
  url: "https://www.glassdoor.com/Job/ai-agent-engineer-jobs-SRCH_KO0,17.htm",
  job: { role: "Staff AI/ML Engineer", company: "CACI International", description: "d".repeat(200) },
  searchPage: false,
};
const EMPTY_STATE = { meta: { role: "", company: "" }, jobText: "", sources: [] };

test("search-page save adds NO source and fills nothing", () => {
  const out = summarizeExtensionImport(
    {
      title: "20,630 Ai agent engineer jobs in United States",
      text: "search page text with many listings",
      url: "https://www.glassdoor.com/Job/ai-agent-engineer-jobs-SRCH_KO0,17.htm",
      job: { role: "", company: "", description: "" },
      searchPage: true,
    },
    EMPTY_STATE,
  );
  assert.equal(out.skipped, true);
  assert.equal(out.source, null);
  assert.deepEqual(out.applied.filled, []);
  assert.match(out.message, /I didn't add it, because it would mix other jobs into your sources/);
});

test("normal save: source added, fills claimed exactly", () => {
  const out = summarizeExtensionImport(CACI_PAYLOAD, EMPTY_STATE);
  assert.equal(out.skipped, false);
  assert.equal(out.duplicate, false);
  assert.deepEqual(out.applied.filled, ["role", "company", "job description"]);
  assert.equal(out.source.name, CACI_PAYLOAD.title);
  assert.equal(out.source.url, CACI_PAYLOAD.url);
  assert.match(out.source.origin, /Saved from browser/);
  assert.match(out.message, /filled in the role, company, job description/);
  assert.doesNotMatch(out.message, /didn't come through/);
});

test("normal save with a missing description names the gap", () => {
  const out = summarizeExtensionImport(
    { ...CACI_PAYLOAD, job: { role: "Staff AI/ML Engineer", company: "CACI International", description: "" } },
    EMPTY_STATE,
  );
  assert.deepEqual(out.applied.filled, ["role", "company"]);
  assert.notEqual(out.source, null);
  assert.match(out.message, /filled in the role, company/);
  assert.match(out.message, /The job description didn't come through — you can paste it in/);
});

test("duplicate save adds NO second source and says so", () => {
  const state = {
    ...EMPTY_STATE,
    meta: { role: "Staff AI/ML Engineer", company: "CACI International" },
    jobText: "d".repeat(200),
    sources: [{ name: CACI_PAYLOAD.title, url: CACI_PAYLOAD.url }],
  };
  const out = summarizeExtensionImport(CACI_PAYLOAD, state);
  assert.equal(out.duplicate, true);
  assert.equal(out.source, null);
  assert.deepEqual(out.applied.filled, []);
  assert.match(out.message, /already in your sources — nothing new to add/);
});

test("duplicate save still fills a field the user cleared since", () => {
  const state = {
    meta: { role: "", company: "CACI International" },
    jobText: "d".repeat(200),
    sources: [{ name: CACI_PAYLOAD.title, url: CACI_PAYLOAD.url }],
  };
  const out = summarizeExtensionImport(CACI_PAYLOAD, state);
  assert.equal(out.duplicate, true);
  assert.equal(out.source, null);
  assert.deepEqual(out.applied.filled, ["role"]);
  assert.match(out.message, /already in your sources\. Filled in the role/);
});

test("two DIFFERENT jobs from the same search page are NOT duplicates", () => {
  const first = summarizeExtensionImport(CACI_PAYLOAD, EMPTY_STATE);
  assert.notEqual(first.source, null);
  const other = {
    title: "Distinguished Engineer, Frontier Agentic AI at CrowdStrike",
    text: "other pane text",
    url: CACI_PAYLOAD.url, // same SRCH tab URL — the name is what differs
    job: { role: "Distinguished Engineer, Frontier Agentic AI", company: "CrowdStrike", description: "e".repeat(200) },
    searchPage: false,
  };
  const second = summarizeExtensionImport(other, {
    ...EMPTY_STATE,
    sources: [first.source],
  });
  assert.equal(second.duplicate, false);
  assert.notEqual(second.source, null);
});

test("blank hints on a non-search page: source added, honest 'couldn't pull' message", () => {
  const out = summarizeExtensionImport(
    {
      title: "Some Job Page",
      text: "page text",
      url: "https://example.com/jobs/1",
      job: { role: "", company: "", description: "" },
      searchPage: false,
    },
    EMPTY_STATE,
  );
  assert.notEqual(out.source, null);
  assert.match(out.message, /I couldn't pull the role, company, or description from that page/);
  assert.doesNotMatch(out.message, /search or listing page/);
});

test("fields already typed: source added, plain 'as job evidence' message, nothing claimed", () => {
  const out = summarizeExtensionImport(CACI_PAYLOAD, {
    meta: { role: "My typed role", company: "My typed company" },
    jobText: "My typed description",
    sources: [],
  });
  assert.notEqual(out.source, null);
  assert.deepEqual(out.applied.filled, []);
  assert.match(out.message, /as job evidence\.$/);
  assert.doesNotMatch(out.message, /filled in the/);
});

test("isDuplicateSource normalizes a trailing-slash URL difference", () => {
  assert.equal(
    isDuplicateSource(
      [{ name: "Job at Co", url: "https://example.com/jobs/1" }],
      { name: "Job at Co", url: "https://example.com/jobs/1/" },
    ),
    true,
  );
  assert.equal(
    isDuplicateSource(
      [{ name: "Job at Co", url: "https://example.com/jobs/1" }],
      { name: "Other Job at Co", url: "https://example.com/jobs/1" },
    ),
    false,
  );
});
