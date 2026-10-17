import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { decodeImportFragment, stripImportFragment } from "../src/lib/extension-import.js";

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

test("App wires the import: decode on load, strip the fragment, same auto-fill path", () => {
  const app = readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8");
  assert.match(app, /decodeImportFragment\(window\.location\.hash\)/);
  assert.match(app, /stripImportFragment\(window\.location\.href\)/);
  assert.match(app, /applyJobHints\(meta, jobText, payload\.job\)/);
  assert.match(app, /Saved from browser/);
});

test("a #import= fragment that fails to decode speaks through the dock, never silently", () => {
  const app = readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8");
  // The old silent path (`if (!payload) return;`) is gone: a present-but-bad
  // fragment must surface a dock message instead of doing nothing.
  assert.doesNotMatch(app, /if \(!payload\) return;/);
  assert.match(app, /window\.location\.hash\.startsWith\("#import="\)/);
  assert.match(app, /say\("That saved page couldn't be read\. Try saving it again from the job page, or paste the job text instead\."\)/);
});
