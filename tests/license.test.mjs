import assert from "node:assert/strict";
import test from "node:test";
import {
  LicenseClient,
  activateBody,
  buildCheckoutUrl,
  deactivateBody,
  isProActive,
  licenseConfig,
  normalizeLicenseKey,
  parseActivate,
  parseDeactivate,
  parseTiers,
  parseValidate,
  validateBody,
} from "../shared/lemonsqueezy.mjs";

// ── Config ────────────────────────────────────────────────────────────────

test("unconfigured when no IDs are supplied", () => {
  const config = licenseConfig({});
  assert.equal(config.configured, false);
  assert.equal(config.checkoutUrl, "");
  assert.equal(config.priceLabel, "");
});

test("a variant id produces the hosted buy link", () => {
  const config = licenseConfig({ VITE_LS_VARIANT_ID: "abc-123", VITE_LS_PRICE_LABEL: "$29 one-time" });
  assert.equal(config.configured, true);
  assert.equal(config.checkoutUrl, "https://app.lemonsqueezy.com/checkout/buy/abc-123");
  assert.equal(config.priceLabel, "$29 one-time");
});

test("a checkout override wins over the default buy link", () => {
  assert.equal(
    buildCheckoutUrl("abc-123", "https://store.example.com/checkout/buy/abc-123/"),
    "https://store.example.com/checkout/buy/abc-123"
  );
  assert.equal(buildCheckoutUrl("", ""), "");
  assert.equal(buildCheckoutUrl("  ", ""), "");
});

// ── Tiers ─────────────────────────────────────────────────────────────────

const SAMPLE_TIERS = JSON.stringify([
  { name: "30-Day", price: "$29", variant: "uuid-30", url: "https://career-chief.lemonsqueezy.com/checkout/buy/uuid-30", term: "full Pro for 30 days" },
  { name: "1-Year", price: "$79", variant: "uuid-365", term: "full Pro for 1 year" },
  { name: "Lifetime", price: "$149", variant: "uuid-life", url: "https://career-chief.lemonsqueezy.com/checkout/buy/uuid-life/", term: "full Pro forever" },
]);

test("parseTiers reads a valid tier list", () => {
  const tiers = parseTiers(SAMPLE_TIERS);
  assert.equal(tiers.length, 3);
  assert.equal(tiers[0].name, "30-Day");
  assert.equal(tiers[0].price, "$29");
  assert.equal(tiers[0].url, "https://career-chief.lemonsqueezy.com/checkout/buy/uuid-30");
  assert.equal(tiers[0].term, "full Pro for 30 days");
  // url built from the variant uuid when omitted
  assert.equal(tiers[1].url, "https://app.lemonsqueezy.com/checkout/buy/uuid-365");
  // trailing slash trimmed from an explicit url
  assert.equal(tiers[2].url, "https://career-chief.lemonsqueezy.com/checkout/buy/uuid-life");
});

test("parseTiers fails closed on malformed input", () => {
  assert.deepEqual(parseTiers("not json{"), []);
  assert.deepEqual(parseTiers(""), []);
  assert.deepEqual(parseTiers(null), []);
  assert.deepEqual(parseTiers(JSON.stringify({ name: "nope" })), []);
  assert.deepEqual(parseTiers(JSON.stringify("just a string")), []);
});

test("parseTiers drops entries without a name or checkout", () => {
  const tiers = parseTiers(JSON.stringify([
    { price: "$9" },
    { name: "No link" },
    { name: "", variant: "uuid-x" },
    null,
    "junk",
    { name: "Good", variant: "uuid-ok" },
  ]));
  assert.equal(tiers.length, 1);
  assert.equal(tiers[0].name, "Good");
  assert.equal(tiers[0].url, "https://app.lemonsqueezy.com/checkout/buy/uuid-ok");
});

test("licenseConfig exposes tiers and stays configured", () => {
  const config = licenseConfig({ VITE_LS_TIERS: SAMPLE_TIERS });
  assert.equal(config.configured, true);
  assert.equal(config.tiers.length, 3);
  assert.equal(config.tiers[2].name, "Lifetime");
});

test("licenseConfig falls back to the legacy single variant", () => {
  const config = licenseConfig({ VITE_LS_VARIANT_ID: "abc-123", VITE_LS_PRICE_LABEL: "$29 one-time" });
  assert.equal(config.configured, true);
  assert.equal(config.tiers.length, 1);
  assert.equal(config.tiers[0].name, "Pro");
  assert.equal(config.tiers[0].price, "$29 one-time");
  assert.equal(config.tiers[0].url, "https://app.lemonsqueezy.com/checkout/buy/abc-123");
});

test("licenseConfig prefers tiers over the legacy variant", () => {
  const config = licenseConfig({ VITE_LS_TIERS: SAMPLE_TIERS, VITE_LS_VARIANT_ID: "abc-123" });
  assert.equal(config.tiers.length, 3);
  assert.equal(config.tiers[0].name, "30-Day");
});

// ── Key normalization ─────────────────────────────────────────────────────

test("license keys are trimmed, uppercased and de-spaced", () => {
  assert.equal(normalizeLicenseKey("  ab12cd-ef34  "), "AB12CD-EF34");
  assert.equal(normalizeLicenseKey("aa bb\tcc"), "AABBCC");
  assert.equal(normalizeLicenseKey(null), "");
});

// ── Request bodies are form-encoded ────────────────────────────────────────

test("activate/validate/deactivate bodies carry the right fields", () => {
  const activate = activateBody("KEY-1", "Career Chief · browser-x");
  assert.equal(activate.get("license_key"), "KEY-1");
  assert.equal(activate.get("instance_name"), "Career Chief · browser-x");

  const validate = validateBody("KEY-1", "inst-9");
  assert.equal(validate.get("license_key"), "KEY-1");
  assert.equal(validate.get("instance_id"), "inst-9");

  const validateNoInstance = validateBody("KEY-1", "");
  assert.equal(validateNoInstance.has("instance_id"), false);

  const deactivate = deactivateBody("KEY-1", "inst-9");
  assert.equal(deactivate.get("license_key"), "KEY-1");
  assert.equal(deactivate.get("instance_id"), "inst-9");
});

// ── Response parsers ──────────────────────────────────────────────────────

test("parseActivate reads a successful activation", () => {
  const parsed = parseActivate({
    activated: true,
    error: null,
    license_key: { id: 7, status: "active", key: "AAA" },
    instance: { id: "inst-uuid-1", name: "Career Chief · browser-x" },
  });
  assert.equal(parsed.ok, true);
  assert.equal(parsed.activated, true);
  assert.equal(parsed.instanceId, "inst-uuid-1");
  assert.equal(parsed.instanceName, "Career Chief · browser-x");
  assert.equal(parsed.license.status, "active");
  assert.equal(parsed.error, null);
});

test("parseActivate surfaces the server error on failure", () => {
  const parsed = parseActivate({ activated: false, error: "This license key has reached the activation limit." });
  assert.equal(parsed.ok, false);
  assert.equal(parsed.activated, false);
  assert.equal(parsed.error, "This license key has reached the activation limit.");
});

test("parseActivate falls back to a plain-English message", () => {
  assert.equal(parseActivate({ activated: false }).error, "That license key could not be activated.");
  assert.equal(parseActivate(null).ok, false);
  assert.equal(parseActivate("nope").ok, false);
});

test("parseValidate distinguishes valid from rejected", () => {
  assert.equal(parseValidate({ valid: true, error: null }).valid, true);
  const rejected = parseValidate({ valid: false, error: "License key is disabled." });
  assert.equal(rejected.ok, false);
  assert.equal(rejected.valid, false);
  assert.equal(rejected.error, "License key is disabled.");
  assert.equal(parseValidate({}).error, "That license key is not valid.");
});

test("parseDeactivate reads success and failure", () => {
  assert.equal(parseDeactivate({ deactivated: true, error: null }).deactivated, true);
  const failed = parseDeactivate({ deactivated: false, error: "Instance not found." });
  assert.equal(failed.ok, false);
  assert.equal(failed.error, "Instance not found.");
});

// ── Client with a stubbed fetch ────────────────────────────────────────────

const stubFetch = (json, status = 200, capture = null) => async (url, options) => {
  if (capture) capture.calls.push({ url, options });
  return { status, json: async () => json };
};

test("activate posts form-encoded to the activate endpoint", async () => {
  const capture = { calls: [] };
  const client = new LicenseClient(stubFetch({
    activated: true, error: null,
    license_key: { id: 1, status: "active" },
    instance: { id: "inst-1", name: "Career Chief · browser-x" },
  }, 200, capture));
  const result = await client.activate("  aa11bb-cc22  ", "Career Chief · browser-x");
  assert.equal(result.ok, true);
  assert.equal(result.activated, true);
  assert.equal(result.instanceId, "inst-1");
  assert.equal(result.licenseKey, "AA11BB-CC22");
  assert.equal(capture.calls.length, 1);
  assert.equal(capture.calls[0].url, "https://api.lemonsqueezy.com/v1/licenses/activate");
  const body = capture.calls[0].options.body;
  assert.equal(body.get("license_key"), "AA11BB-CC22");
  assert.equal(body.get("instance_name"), "Career Chief · browser-x");
});

test("a rejected key resolves, never throws", async () => {
  const client = new LicenseClient(stubFetch({ activated: false, error: "Invalid license key." }, 400));
  const result = await client.activate("BAD-KEY", "instance");
  assert.equal(result.ok, false);
  assert.equal(result.error, "Invalid license key.");
});

test("a dead network fails closed with a plain message", async () => {
  const client = new LicenseClient(async () => { throw new Error("boom"); });
  const result = await client.validate("SOME-KEY", "inst-1");
  assert.equal(result.ok, false);
  assert.equal(result.valid, false);
  assert.match(result.error, /could not reach/i);
});

test("an unreadable response fails closed", async () => {
  const client = new LicenseClient(async () => ({ status: 502, json: async () => { throw new Error("bad json"); } }));
  const result = await client.deactivate("KEY", "inst-1");
  assert.equal(result.ok, false);
  assert.match(result.error, /unreadable/i);
});

test("empty keys are rejected before any network call", async () => {
  let calls = 0;
  const client = new LicenseClient(async () => { calls += 1; return { status: 200, json: async () => ({}) }; });
  assert.equal((await client.activate("   ", "i")).ok, false);
  assert.equal((await client.validate("", "")).ok, false);
  assert.equal((await client.deactivate("KEY", "")).ok, false);
  assert.equal(calls, 0);
});

test("validate and deactivate hit their endpoints", async () => {
  const capture = { calls: [] };
  const client = new LicenseClient(stubFetch({ valid: true, error: null }, 200, capture));
  const validated = await client.validate("KEY-1", "inst-9");
  assert.equal(validated.valid, true);
  assert.match(capture.calls[0].url, /\/validate$/);

  const client2 = new LicenseClient(stubFetch({ deactivated: true, error: null }, 200, capture));
  const deactivated = await client2.deactivate("KEY-1", "inst-9");
  assert.equal(deactivated.deactivated, true);
  assert.match(capture.calls[1].url, /\/deactivate$/);
});

// ── Gating ────────────────────────────────────────────────────────────────

test("only a positively validated license opens the paid gate", () => {
  assert.equal(isProActive("pro"), true);
  assert.equal(isProActive("free"), false);
  assert.equal(isProActive("checking"), false);
  assert.equal(isProActive(undefined), false);
  assert.equal(isProActive(null), false);
});
