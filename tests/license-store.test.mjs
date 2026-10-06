// Browser-store integration for the Pro license: localStorage persistence,
// the 24h revalidation cache, and the fail-closed contract. localStorage is
// stubbed because these tests run in Node.
import assert from "node:assert/strict";
import test from "node:test";

const backing = new Map();
globalThis.localStorage = {
  getItem: (key) => (backing.has(key) ? backing.get(key) : null),
  setItem: (key, value) => backing.set(key, String(value)),
  removeItem: (key) => backing.delete(key),
};

const {
  activateLicense,
  clearStoredLicense,
  deactivateLicense,
  getInstanceName,
  getStoredLicense,
  maskLicenseKey,
  validateStoredLicense,
} = await import("../src/lib/license.js");

const okFetch = (json) => async () => ({ status: 200, json: async () => json });
const deadFetch = async () => { throw new Error("offline"); };

// Small helper: build a stub client without re-importing the class each time.
import { LicenseClient } from "../shared/lemonsqueezy.mjs";
const stub = (fetchImpl) => new LicenseClient(fetchImpl);

test.beforeEach(() => backing.clear());

// Realistic meta blocks: the License API always returns one, and activation
// now fails closed without it.
const META_30 = {
  store_id: 489627, order_id: 1, order_item_id: 1,
  product_id: 1410663, product_name: "Career Chief Pro",
  variant_id: 11, variant_name: "Career Chief Pro \u2014 30-Day",
  customer_id: 7, customer_name: "Test Buyer", customer_email: "t@example.com",
};
const META_LIFE = { ...META_30, variant_id: 13, variant_name: "Career Chief Pro \u2014 Lifetime" };
const CONFIG = {
  storeId: "489627",
  tiers: [{ name: "30-Day" }, { name: "1-Year" }, { name: "Lifetime" }],
};

test("no stored license means free, with no network call", async () => {
  let calls = 0;
  const result = await validateStoredLicense(stub(async () => { calls += 1; return { status: 200, json: async () => ({}) }; }));
  assert.equal(result.state, "free");
  assert.equal(result.notice, "");
  assert.equal(calls, 0);
});

test("the instance name is stable per browser", () => {
  assert.equal(getInstanceName(), getInstanceName());
  assert.match(getInstanceName(), /^Career Chief · browser-/);
});

test("activation persists key, instance and pro state", async () => {
  const client = stub(okFetch({
    activated: true, error: null,
    license_key: { id: 1, status: "active", created_at: "2026-10-06T00:00:00.000Z" },
    instance: { id: "inst-abc", name: "Career Chief · browser-x" },
    meta: META_LIFE,
  }));
  const result = await activateLicense("  zz11-yy22  ", client, CONFIG);
  assert.equal(result.ok, true);
  const stored = getStoredLicense();
  assert.equal(stored.licenseKey, "ZZ11-YY22");
  assert.equal(stored.instanceId, "inst-abc");
  assert.equal(stored.state, "pro");
  assert.equal(stored.tierName, "Lifetime");
  assert.equal(stored.expiresAt, null);
});

test("activation is rejected when the key belongs to another store", async () => {
  const client = stub(okFetch({
    activated: true, error: null,
    license_key: { id: 9, status: "active", created_at: "2026-10-06T00:00:00.000Z" },
    instance: { id: "inst-x", name: "n" },
    meta: { ...META_30, store_id: 12345 },
  }));
  const result = await activateLicense("FOREIGN-KEY", client, CONFIG);
  assert.equal(result.ok, false);
  assert.match(result.error, /different product/i);
  assert.equal(getStoredLicense(), null);
});

test("activation without a meta block fails closed", async () => {
  const client = stub(okFetch({
    activated: true, error: null,
    license_key: { id: 1, status: "active" },
    instance: { id: "inst-abc", name: "n" },
  }));
  const result = await activateLicense("NO-META", client, CONFIG);
  assert.equal(result.ok, false);
  assert.equal(getStoredLicense(), null);
});

test("a fresh activation is trusted without a revalidation call", async () => {
  const client = stub(okFetch({
    activated: true, error: null,
    license_key: { id: 1, status: "active", created_at: "2026-10-06T00:00:00.000Z" },
    instance: { id: "inst-abc", name: "n" },
    meta: META_LIFE,
  }));
  await activateLicense("KEY-1", client);
  let calls = 0;
  const checking = stub(async () => { calls += 1; return { status: 200, json: async () => ({ valid: true }) }; });
  const result = await validateStoredLicense(checking);
  assert.equal(result.state, "pro");
  assert.equal(calls, 0);
});

test("a stale record revalidates; a rejected key is dropped and stays free", async () => {
  backing.set("career-chief-license-v1", JSON.stringify({
    licenseKey: "OLD-KEY", instanceId: "inst-old", state: "pro",
    validatedAt: Date.now() - 25 * 60 * 60 * 1000, // older than 24h
  }));
  const client = stub(okFetch({ valid: false, error: "License key is disabled." }));
  const result = await validateStoredLicense(client);
  assert.equal(result.state, "free");
  assert.match(result.notice, /no longer valid/i);
  assert.equal(getStoredLicense(), null);
});

test("a network blip during revalidation fails closed but keeps the key", async () => {
  backing.set("career-chief-license-v1", JSON.stringify({
    licenseKey: "MY-KEY", instanceId: "inst-1", state: "pro",
    validatedAt: Date.now() - 25 * 60 * 60 * 1000,
  }));
  const result = await validateStoredLicense(stub(deadFetch));
  assert.equal(result.state, "free");
  assert.match(result.notice, /free tier for now/i);
  // The key is kept so the next load can try again.
  assert.equal(getStoredLicense()?.licenseKey, "MY-KEY");
});

test("deactivation clears local state even when the server call fails", async () => {
  backing.set("career-chief-license-v1", JSON.stringify({ licenseKey: "K", instanceId: "i", state: "pro", validatedAt: Date.now() }));
  const failing = stub(deadFetch);
  const result = await deactivateLicense(failing);
  assert.equal(result.ok, false);
  assert.equal(getStoredLicense(), null);

  backing.set("career-chief-license-v1", JSON.stringify({ licenseKey: "K", instanceId: "i", state: "pro", validatedAt: Date.now() }));
  const good = stub(okFetch({ deactivated: true, error: null }));
  assert.equal((await deactivateLicense(good)).ok, true);
  assert.equal(getStoredLicense(), null);
});

test("deactivation with nothing stored is a quiet no-op", async () => {
  assert.equal((await deactivateLicense(stub(deadFetch))).ok, true);
});

test("clearStoredLicense and maskLicenseKey behave", () => {
  backing.set("career-chief-license-v1", JSON.stringify({ licenseKey: "K" }));
  clearStoredLicense();
  assert.equal(getStoredLicense(), null);
  assert.equal(maskLicenseKey("ABCDEF12-3456"), "••••3456");
  assert.equal(maskLicenseKey("ab"), "••••");
});

// ── Term expiry ─────────────────────────────────────────────────────────────

test("a 30-day activation records its expiry from the key's creation time", async () => {
  const client = stub(okFetch({
    activated: true, error: null,
    license_key: { id: 1, status: "active", created_at: "2026-10-01T12:00:00.000Z" },
    instance: { id: "inst-abc", name: "n" },
    meta: META_30,
  }));
  const result = await activateLicense("KEY-30", client, CONFIG);
  assert.equal(result.ok, true);
  const stored = getStoredLicense();
  assert.equal(stored.tierName, "30-Day");
  // 30 days after the key was issued — not 30 days after activation.
  assert.equal(stored.expiresAt, "2026-10-31T12:00:00.000Z");
});

test("a 1-year activation records a 365-day expiry", async () => {
  const client = stub(okFetch({
    activated: true, error: null,
    license_key: { id: 2, status: "active", created_at: "2026-10-01T12:00:00.000Z" },
    instance: { id: "inst-abc", name: "n" },
    meta: { ...META_30, variant_name: "Career Chief Pro \u2014 1-Year" },
  }));
  const result = await activateLicense("KEY-365", client, CONFIG);
  assert.equal(result.ok, true);
  assert.equal(getStoredLicense().tierName, "1-Year");
  assert.equal(getStoredLicense().expiresAt, "2027-10-01T12:00:00.000Z");
});

test("an expired record drops to free with an expiry notice, no network call", async () => {
  backing.set("career-chief-license-v1", JSON.stringify({
    licenseKey: "OLD", instanceId: "i", state: "pro", validatedAt: Date.now(),
    tierName: "30-Day", expiresAt: new Date(Date.now() - 1000).toISOString(),
  }));
  let calls = 0;
  const result = await validateStoredLicense(stub(async () => { calls += 1; return { status: 200, json: async () => ({}) }; }), CONFIG);
  assert.equal(result.state, "free");
  assert.match(result.notice, /30-Day Pro access ended/i);
  assert.equal(calls, 0);
  assert.equal(getStoredLicense(), null);
});

test("revalidation backfills expiry for keys activated before the fix", async () => {
  backing.set("career-chief-license-v1", JSON.stringify({
    licenseKey: "LEGACY", instanceId: "inst-old", state: "pro",
    validatedAt: Date.now() - 25 * 60 * 60 * 1000, // older than 24h
  }));
  const client = stub(okFetch({
    valid: true, error: null,
    license_key: { id: 1, status: "active", created_at: "2026-10-01T12:00:00.000Z" },
    meta: META_30,
  }));
  const result = await validateStoredLicense(client, CONFIG);
  assert.equal(result.state, "pro");
  const stored = getStoredLicense();
  assert.equal(stored.tierName, "30-Day");
  assert.equal(stored.expiresAt, "2026-10-31T12:00:00.000Z");
});

test("a key from another store is rejected on revalidation", async () => {
  backing.set("career-chief-license-v1", JSON.stringify({
    licenseKey: "FOREIGN", instanceId: "i", state: "pro",
    validatedAt: Date.now() - 25 * 60 * 60 * 1000,
  }));
  const client = stub(okFetch({
    valid: true, error: null,
    license_key: { id: 9, status: "active", created_at: "2026-10-06T00:00:00.000Z" },
    meta: { ...META_30, store_id: 99999 },
  }));
  const result = await validateStoredLicense(client, CONFIG);
  assert.equal(result.state, "free");
  assert.match(result.notice, /different product/i);
  assert.equal(getStoredLicense(), null);
});
