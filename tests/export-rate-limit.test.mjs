// Export rate limit: 10 finished exports per license key per calendar day,
// counted in localStorage next to the license record. Client-side friction,
// not a wall — see the comment block in src/lib/license.js.
import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";

const backing = new Map();
globalThis.localStorage = {
  getItem: (key) => (backing.has(key) ? backing.get(key) : null),
  setItem: (key, value) => backing.set(key, String(value)),
  removeItem: (key) => backing.delete(key),
};

const {
  DAILY_EXPORT_LIMIT,
  EXPORT_LIMIT_MESSAGE,
  canExport,
  clearStoredLicense,
  getExportCountForToday,
  getExportUsage,
  recordExport,
} = await import("../src/lib/license.js");

const DAY_1 = new Date(2026, 9, 14, 10, 0, 0); // Oct 14, 2026 (local)
const DAY_2 = new Date(2026, 9, 15, 9, 0, 0); // next calendar day

test.beforeEach(() => backing.clear());

test("the daily cap is 10 exports per key", () => {
  assert.equal(DAILY_EXPORT_LIMIT, 10);
});

test("the limit message tells the user plainly, in friendly words", () => {
  assert.match(EXPORT_LIMIT_MESSAGE, /daily export limit reached/i);
  assert.match(EXPORT_LIMIT_MESSAGE, /10 exports/);
  assert.match(EXPORT_LIMIT_MESSAGE, /tomorrow/);
  assert.match(EXPORT_LIMIT_MESSAGE, /draft is safe/i);
});

test("10 exports go through; the 11th is blocked and not counted", () => {
  for (let i = 1; i <= 10; i += 1) {
    assert.equal(canExport("KEY-A", DAY_1), true, `export ${i} should be allowed`);
    const recorded = recordExport("KEY-A", DAY_1);
    assert.equal(recorded.allowed, true);
    assert.equal(recorded.count, i);
    assert.equal(recorded.remaining, 10 - i);
  }
  assert.equal(canExport("KEY-A", DAY_1), false, "11th export must be blocked");
  const blocked = recordExport("KEY-A", DAY_1);
  assert.equal(blocked.allowed, false);
  assert.equal(blocked.count, 10, "a blocked attempt must not push the count past 10");
  assert.equal(blocked.remaining, 0);
  assert.equal(getExportCountForToday("KEY-A", DAY_1), 10);
});

test("the counter resets on the next calendar day", () => {
  for (let i = 0; i < 10; i += 1) recordExport("KEY-A", DAY_1);
  assert.equal(canExport("KEY-A", DAY_1), false);
  assert.equal(canExport("KEY-A", DAY_2), true, "next day starts fresh");
  assert.equal(getExportCountForToday("KEY-A", DAY_2), 0);
  const recorded = recordExport("KEY-A", DAY_2);
  assert.deepEqual(recorded, { allowed: true, count: 1, remaining: 9 });
  // Yesterday's count is gone, not accumulated.
  assert.equal(getExportCountForToday("KEY-A", DAY_1), 0);
});

test("different keys get separate daily counts", () => {
  for (let i = 0; i < 10; i += 1) recordExport("KEY-A", DAY_1);
  assert.equal(canExport("KEY-A", DAY_1), false);
  assert.equal(canExport("KEY-B", DAY_1), true, "a second key starts at zero");
  assert.equal(getExportUsage("KEY-B", DAY_1).count, 0);
});

test("usage reports count and remaining", () => {
  recordExport("KEY-A", DAY_1);
  recordExport("KEY-A", DAY_1);
  recordExport("KEY-A", DAY_1);
  assert.deepEqual(getExportUsage("KEY-A", DAY_1), { count: 3, limit: 10, remaining: 7 });
  assert.deepEqual(getExportUsage("NO-EXPORTS", DAY_1), { count: 0, limit: 10, remaining: 10 });
});

test("clearing the license does not reset the export count", () => {
  // Deactivating + re-activating the same key the same day must not dodge
  // the cap, so the count lives outside the license record.
  backing.set("career-chief-license-v1", JSON.stringify({ licenseKey: "KEY-A", state: "pro" }));
  recordExport("KEY-A", DAY_1);
  recordExport("KEY-A", DAY_1);
  clearStoredLicense();
  assert.equal(getExportCountForToday("KEY-A", DAY_1), 2);
});

test("corrupt count storage fails open instead of locking anyone out", () => {
  backing.set("career-chief-export-count-v1", "not json{");
  assert.equal(canExport("KEY-A", DAY_1), true);
  assert.equal(getExportCountForToday("KEY-A", DAY_1), 0);
});

test("a missing key fails open — the Pro gate already blocks keyless exports", () => {
  assert.equal(canExport("", DAY_1), true);
  assert.equal(canExport(null, DAY_1), true);
  assert.equal(recordExport("", DAY_1).allowed, true);
});

// ── Wiring: App.jsx enforces the cap at the single export choke point ─────

test("App.jsx checks the cap before exporting and records only successes", () => {
  const src = fs.readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8");
  const download = src.slice(src.indexOf("async function downloadResume"));
  assert.ok(download.length > 0, "downloadResume not found");
  assert.match(download, /canExport\(storedKey\)/);
  assert.match(download, /setNotice\(EXPORT_LIMIT_MESSAGE\)/);
  // The count is recorded after exportResume succeeds, so a failed export
  // never burns quota.
  assert.ok(
    download.indexOf("await exportResume(doc, format)") < download.indexOf("recordExport(storedKey)"),
    "recordExport must come after a successful exportResume"
  );
});

// ── Terms: personal-use-only line in MD source and served HTML ─────────────

const termsMd = fs.readFileSync(new URL("../legal/terms-of-service.md", import.meta.url), "utf8");
const termsHtml = fs.readFileSync(new URL("../public/terms-of-service.html", import.meta.url), "utf8");

test("terms bar preparing resumes for others for pay, in MD and HTML", () => {
  for (const [label, text] of [["MD", termsMd], ["HTML", termsHtml]]) {
    assert.match(
      text,
      /personal use only — not for preparing resumes for others for pay/,
      `${label} should carry the personal-use-only line in the license-key paragraph`
    );
    assert.match(text, /Prepare resumes for others for pay/, `${label} should bar it in acceptable use`);
  }
});
