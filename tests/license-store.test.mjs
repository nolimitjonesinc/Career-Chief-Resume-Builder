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
    license_key: { id: 1, status: "active" },
    instance: { id: "inst-abc", name: "Career Chief · browser-x" },
  }));
  const result = await activateLicense("  zz11-yy22  ", client);
  assert.equal(result.ok, true);
  const stored = getStoredLicense();
  assert.equal(stored.licenseKey, "ZZ11-YY22");
  assert.equal(stored.instanceId, "inst-abc");
  assert.equal(stored.state, "pro");
});

test("a fresh activation is trusted without a revalidation call", async () => {
  const client = stub(okFetch({
    activated: true, error: null,
    license_key: { id: 1, status: "active" },
    instance: { id: "inst-abc", name: "n" },
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
