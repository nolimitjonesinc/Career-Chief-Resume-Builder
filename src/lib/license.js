// Browser-side Pro license state. Everything lives in localStorage next to the
// draft: no accounts, no server. A license activated here works only in this
// browser — the same tradeoff the draft itself already makes.
//
// Fail-closed contract: any validation failure, network error, or missing key
// resolves to the free tier. The free tier is never locked out.

import { LicenseClient } from "../../shared/lemonsqueezy.mjs";

const LICENSE_KEY = "career-chief-license-v1";
const INSTANCE_KEY = "career-chief-instance-v1";
// Revalidate at most once a day; the result is cached in the stored record.
const REVALIDATE_MS = 24 * 60 * 60 * 1000;

function readJson(key) {
  try {
    return JSON.parse(localStorage.getItem(key) || "null");
  } catch {
    return null;
  }
}

function writeJson(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* Storage may be blocked; the session simply won't persist the license. */
  }
}

export function getStoredLicense() {
  const stored = readJson(LICENSE_KEY);
  if (!stored || typeof stored !== "object") return null;
  if (!stored.licenseKey) return null;
  return stored;
}

export function clearStoredLicense() {
  try {
    localStorage.removeItem(LICENSE_KEY);
  } catch {
    /* ignore */
  }
}

// One stable, anonymous instance name per browser so re-activating the same key
// reuses the seat instead of burning a new one.
export function getInstanceName() {
  let id = null;
  try {
    id = localStorage.getItem(INSTANCE_KEY);
  } catch {
    /* ignore */
  }
  if (!id) {
    id = `browser-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    try {
      localStorage.setItem(INSTANCE_KEY, id);
    } catch {
      /* ignore */
    }
  }
  return `Career Chief · ${id}`;
}

export function licenseClient() {
  return new LicenseClient();
}

// Validate on app load. Returns { state: "pro" | "free", notice } — notice is a
// plain-English message for the UI when the user should be told something.
export async function validateStoredLicense(client = licenseClient()) {
  const stored = getStoredLicense();
  if (!stored) return { state: "free", notice: "" };

  const freshEnough =
    stored.state === "pro" &&
    typeof stored.validatedAt === "number" &&
    Date.now() - stored.validatedAt < REVALIDATE_MS;
  if (freshEnough) return { state: "pro", notice: "" };

  const result = await client.validate(stored.licenseKey, stored.instanceId);
  if (result.ok && result.valid) {
    writeJson(LICENSE_KEY, { ...stored, state: "pro", validatedAt: Date.now() });
    return { state: "pro", notice: "" };
  }
  if (result.error && /could not reach|unreadable/i.test(result.error)) {
    // Network problem: stay free for now, but keep the stored key so the next
    // load can try again. Never lock the free tier over a blip.
    return {
      state: "free",
      notice: "Could not verify the Pro license (network issue). You are on the free tier for now — your work is safe.",
    };
  }
  // The key itself is rejected (revoked, refunded, deactivated elsewhere):
  // drop it so we stop claiming Pro.
  clearStoredLicense();
  return {
    state: "free",
    notice: "This browser's Pro license is no longer valid, so you are on the free tier. Your draft is untouched.",
  };
}

export async function activateLicense(rawKey, client = licenseClient()) {
  const result = await client.activate(rawKey, getInstanceName());
  if (!result.ok || !result.activated) {
    return { ok: false, error: result.error || "That license key could not be activated." };
  }
  writeJson(LICENSE_KEY, {
    licenseKey: result.licenseKey,
    instanceId: result.instanceId,
    instanceName: result.instanceName,
    state: "pro",
    validatedAt: Date.now(),
  });
  return { ok: true, error: "" };
}

export async function deactivateLicense(client = licenseClient()) {
  const stored = getStoredLicense();
  if (!stored) return { ok: true, error: "" };
  const result = await client.deactivate(stored.licenseKey, stored.instanceId);
  // Clear local state regardless: even if the server call failed, the user asked
  // to remove the license from this browser, and the seat can be reclaimed from
  // the Lemon Squeezy dashboard.
  clearStoredLicense();
  if (!result.ok || !result.deactivated) {
    return { ok: false, error: `${result.error || "Deactivation did not confirm."} The key was still removed from this browser.` };
  }
  return { ok: true, error: "" };
}

// Last four characters for display ("…9F3A") — never show the whole key on screen.
export function maskLicenseKey(key) {
  const clean = String(key || "").replace(/\s+/g, "");
  if (clean.length <= 4) return "••••";
  return `••••${clean.slice(-4)}`;
}
