import assert from "node:assert/strict";
import test from "node:test";
import {
  LicenseClient,
  DAY_MS,
  activateBody,
  assertLicenseMeta,
  buildCheckoutUrl,
  computeExpiresAt,
  deactivateBody,
  isProActive,
  licenseConfig,
  licenseTermMs,
  matchTier,
  normalizeLicenseKey,
  parseActivate,
  parseDeactivate,
  parseLicenseMeta,
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

// ── Meta parsing ──────────────────────────────────────────────────────────

test("parseLicenseMeta reads the store/product/variant identity", () => {
  const meta = parseLicenseMeta({
    store_id: 489627, product_id: 1410663, product_name: "Career Chief Pro",
    variant_id: 11, variant_name: "Career Chief Pro \u2014 30-Day",
    customer_email: "t@example.com",
  });
  assert.equal(meta.storeId, 489627);
  assert.equal(meta.productId, 1410663);
  assert.equal(meta.variantName, "Career Chief Pro \u2014 30-Day");
  assert.equal(meta.customerEmail, "t@example.com");
  assert.equal(meta.orderId, null);
});

test("parseLicenseMeta is null-safe", () => {
  const meta = parseLicenseMeta(null);
  assert.equal(meta.storeId, null);
  assert.equal(meta.variantName, null);
});

test("parsers carry the meta block through", () => {
  const meta = { store_id: 1, variant_name: "V" };
  assert.equal(parseActivate({ activated: true, meta }).meta.storeId, 1);
  assert.equal(parseValidate({ valid: true, meta }).meta.variantName, "V");
  assert.equal(parseDeactivate({ deactivated: true, meta }).meta.storeId, 1);
  // Missing meta degrades to nulls, never throws.
  assert.equal(parseValidate({ valid: true }).meta.storeId, null);
});

test("license key summary carries created_at and expires_at", () => {
  const parsed = parseValidate({
    valid: true,
    license_key: { id: 1, status: "active", created_at: "2026-10-01T00:00:00.000Z", expires_at: null },
  });
  assert.equal(parsed.license.createdAt, "2026-10-01T00:00:00.000Z");
  assert.equal(parsed.license.expiresAt, null);
});

// ── Key-to-product assertion ──────────────────────────────────────────────

test("assertLicenseMeta accepts this store's keys", () => {
  assert.equal(assertLicenseMeta({ storeId: 489627 }, { storeId: "489627" }).ok, true);
});

test("assertLicenseMeta rejects foreign stores and missing meta", () => {
  assert.equal(assertLicenseMeta({ storeId: 999 }, { storeId: "489627" }).ok, false);
  assert.equal(assertLicenseMeta(null, { storeId: "489627" }).ok, false);
  assert.equal(assertLicenseMeta({}, { storeId: "489627" }).ok, false);
});

test("assertLicenseMeta skips the store check when unconfigured", () => {
  assert.equal(assertLicenseMeta({ storeId: 1 }, {}).ok, true);
});

test("assertLicenseMeta accepts this store and product's keys", () => {
  assert.equal(assertLicenseMeta({ storeId: 489627, productId: 1410663 }, { storeId: "489627", productId: "1410663" }).ok, true);
});

test("assertLicenseMeta rejects keys for other products in the same store", () => {
  assert.equal(assertLicenseMeta({ storeId: 489627, productId: 999 }, { storeId: "489627", productId: "1410663" }).ok, false);
  assert.equal(assertLicenseMeta({ storeId: 489627 }, { storeId: "489627", productId: "1410663" }).ok, false);
});

test("assertLicenseMeta skips the product check when unconfigured", () => {
  assert.equal(assertLicenseMeta({ storeId: 489627, productId: 999 }, { storeId: "489627" }).ok, true);
});

// ── Term mapping ──────────────────────────────────────────────────────────

const TIERS = [{ name: "30-Day" }, { name: "1-Year" }, { name: "Lifetime" }];

test("matchTier finds the tier inside the variant name", () => {
  assert.equal(matchTier("Career Chief Pro \u2014 30-Day", TIERS).name, "30-Day");
  assert.equal(matchTier("career chief pro 1-year", TIERS).name, "1-Year");
  assert.equal(matchTier("Lifetime Deal", TIERS).name, "Lifetime");
  assert.equal(matchTier("Something Else", TIERS), null);
  assert.equal(matchTier(null, TIERS), null);
});

test("licenseTermMs maps tiers to durations, lifetime to never", () => {
  assert.equal(licenseTermMs("Career Chief Pro \u2014 30-Day", TIERS), 30 * DAY_MS);
  assert.equal(licenseTermMs("Career Chief Pro \u2014 1-Year", TIERS), 365 * DAY_MS);
  assert.equal(licenseTermMs("Career Chief Pro \u2014 Lifetime", TIERS), null);
  assert.equal(licenseTermMs("Mystery Tier", TIERS), null);
});

test("licenseTermMs falls back to keywords when tiers are unknown", () => {
  assert.equal(licenseTermMs("Pro Monthly", []), 30 * DAY_MS);
  assert.equal(licenseTermMs("Annual Plan", []), 365 * DAY_MS);
  assert.equal(licenseTermMs("Forever Access", []), null);
  assert.equal(licenseTermMs("", []), null);
});

// ── Expiry computation ────────────────────────────────────────────────────

test("computeExpiresAt anchors on the key's creation time", () => {
  assert.equal(
    computeExpiresAt({
      createdAt: "2026-10-01T12:00:00.000Z",
      lsExpiresAt: null,
      variantName: "Career Chief Pro \u2014 30-Day",
      tiers: TIERS,
    }),
    "2026-10-31T12:00:00.000Z"
  );
});

test("computeExpiresAt returns null when nothing bounds the term", () => {
  assert.equal(
    computeExpiresAt({
      createdAt: "2026-10-01T12:00:00.000Z",
      lsExpiresAt: null,
      variantName: "Career Chief Pro \u2014 Lifetime",
      tiers: TIERS,
    }),
    null
  );
  // No creation time either: fail open, never lock out a buyer on bad data.
  assert.equal(computeExpiresAt({ variantName: "30-Day", tiers: TIERS }), null);
});

test("computeExpiresAt prefers Lemon Squeezy's own expiry when earlier", () => {
  assert.equal(
    computeExpiresAt({
      createdAt: "2026-10-01T12:00:00.000Z",
      lsExpiresAt: "2026-10-15T00:00:00.000Z",
      variantName: "Career Chief Pro \u2014 1-Year",
      tiers: TIERS,
    }),
    "2026-10-15T00:00:00.000Z"
  );
});
