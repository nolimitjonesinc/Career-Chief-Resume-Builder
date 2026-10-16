import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import { aiFollowUpAllowed, aiPlanAllowed } from "../src/lib/ai-consent.js";

// ── AI consent gates (Rule 8: consent is per session, never persisted) ──

test("AI plan needs both AI enabled and consent", () => {
  assert.equal(aiPlanAllowed(true, true), true);
  assert.equal(aiPlanAllowed(true, false), false); // toggle off blocks it
  assert.equal(aiPlanAllowed(false, true), false);
  assert.equal(aiPlanAllowed(false, false), false);
});

test("AI follow-up needs an AI analysis and consent", () => {
  assert.equal(aiFollowUpAllowed("ai", true), true);
  assert.equal(aiFollowUpAllowed("ai", false), false); // toggle off blocks it
  assert.equal(aiFollowUpAllowed("local", true), false);
  assert.equal(aiFollowUpAllowed(undefined, true), false);
});

// The toggle flips aiConsent; the gates read aiConsent. So flipping the
// toggle off must shut every AI path, even mid-session with an AI analysis.
test("flipping the toggle off shuts every AI path", () => {
  const consentBefore = true;
  const consentAfter = false; // what the toggle writes when unchecked
  assert.equal(aiPlanAllowed(true, consentBefore), true);
  assert.equal(aiPlanAllowed(true, consentAfter), false);
  assert.equal(aiFollowUpAllowed("ai", consentBefore), true);
  assert.equal(aiFollowUpAllowed("ai", consentAfter), false);
});

// ── Rule 8 guard: consent must never be saved to the draft ────────────────

test("App.jsx never persists aiConsent to the saved draft (Rule 8)", () => {
  const src = fs.readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8");
  assert.match(src, /Consent is per session \(Rule 8\)/);
  // The draft-save object literal must not contain aiConsent.
  const save = src.match(/localStorage\.setItem\(storageKey, JSON\.stringify\(\{[^}]+\}\)\)/);
  assert.ok(save, "draft save statement not found");
  assert.doesNotMatch(save[0], /aiConsent/);
});

test("workspace carries an AI toggle wired to the same consent state", () => {
  const src = fs.readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8");
  assert.match(src, /className="ai-toggle"/);
  assert.match(src, /checked=\{aiConsent\} onChange=\{\(event\) => setAiConsent\(event\.target\.checked\)\}/);
});

// ── Terms fixes: MD source and served HTML must agree ──────────────────────

const termsMd = fs.readFileSync(new URL("../legal/terms-of-service.md", import.meta.url), "utf8");
const termsHtml = fs.readFileSync(new URL("../public/terms-of-service.html", import.meta.url), "utf8");

test("terms list exactly two Pro plans and no removed tier", () => {
  for (const [label, text] of [["MD", termsMd], ["HTML", termsHtml]]) {
    assert.doesNotMatch(text, /lifetime/i, `${label} must not mention the removed tier`);
    assert.doesNotMatch(text, /\$149/, `${label} must not carry the removed tier's price`);
    assert.match(text, /30-Day Pass — \$29/, `${label} should list the 30-Day plan`);
    assert.match(text, /1-Year Pro — \$79/, `${label} should list the 1-Year plan`);
    assert.match(text, /active license holders reasonable notice/, `${label} should promise notice to active holders`);
  }
});

test("liability cap is the license price, not a 12-month window", () => {
  for (const [label, text] of [["MD", termsMd], ["HTML", termsHtml]]) {
    assert.match(text, /amount you paid for your Pro license/, `${label} should cap at the license price`);
    assert.doesNotMatch(text, /12 months before the claim/, `${label} must not use the 12-month window`);
  }
});
