// Browser-side Pro license state. Everything lives in localStorage next to the
// draft: no accounts, no server. A license activated here works only in this
// browser — the same tradeoff the draft itself already makes.
//
// Fail-closed contract: any validation failure, network error, or missing key
// resolves to the free tier. The free tier is never locked out.

import { LicenseClient, assertLicenseMeta, computeExpiresAt, licenseConfig, matchTier } from "../../shared/lemonsqueezy.mjs";

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

// Term expiry: a stored record carries expiresAt (ISO) once the tier is
// known. Expired records drop to the free tier even before any network call —
// the term genuinely ended, online or not.
function expiryNotice(stored) {
  const tier = stored && stored.tierName ? `${stored.tierName} ` : "";
  let when = "";
  try {
    when = stored && stored.expiresAt ? new Date(stored.expiresAt).toLocaleDateString() : "";
  } catch {
    /* leave blank */
  }
  return `Your ${tier}Pro access${when ? ` ended on ${when}` : " has expired"}. Your draft is untouched — renew to keep exporting.`;
}

function isExpiredRecord(stored, nowMs = Date.now()) {
  if (!stored || typeof stored.expiresAt !== "string" || stored.expiresAt === "") return false;
  const at = Date.parse(stored.expiresAt);
  return !Number.isNaN(at) && nowMs >= at;
}

function expiredResult(stored) {
  clearStoredLicense();
  return { state: "free", notice: expiryNotice(stored) };
}

function foreignKeyResult() {
  clearStoredLicense();
  return {
    state: "free",
    notice: "This license key belongs to a different product, so it can't unlock Career Chief Pro. Your draft is untouched.",
  };
}

// Validate on app load. Returns { state: "pro" | "free", notice } — notice is a
// plain-English message for the UI when the user should be told something.
export async function validateStoredLicense(client = licenseClient(), config = null) {
  const stored = getStoredLicense();
  if (!stored) return { state: "free", notice: "" };
  if (isExpiredRecord(stored)) return expiredResult(stored);

  const cfg = config || licenseConfig();

  const freshEnough =
    stored.state === "pro" &&
    typeof stored.validatedAt === "number" &&
    Date.now() - stored.validatedAt < REVALIDATE_MS;
  if (freshEnough) return { state: "pro", notice: "" };

  const result = await client.validate(stored.licenseKey, stored.instanceId);
  if (result.ok && result.valid) {
    // The public License API validates any merchant's key: confirm this one
    // was actually sold by the Career Chief store before trusting it.
    if (!assertLicenseMeta(result.meta, cfg).ok) return foreignKeyResult();
    // Backfill (or refresh) the term expiry from the server's key record, so
    // keys activated before expiry existed still end on time.
    const expiresAt = computeExpiresAt({
      createdAt: result.license ? result.license.createdAt : null,
      lsExpiresAt: result.license ? result.license.expiresAt : null,
      variantName: result.meta ? result.meta.variantName : null,
      tiers: cfg.tiers,
    });
    const tier = matchTier(result.meta ? result.meta.variantName : null, cfg.tiers);
    const next = {
      ...stored,
      state: "pro",
      validatedAt: Date.now(),
      variantName: result.meta ? result.meta.variantName : stored.variantName,
      tierName: tier ? tier.name : stored.tierName,
      expiresAt,
    };
    if (isExpiredRecord(next)) return expiredResult(next);
    writeJson(LICENSE_KEY, next);
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

export async function activateLicense(rawKey, client = licenseClient(), config = null) {
  const result = await client.activate(rawKey, getInstanceName());
  if (!result.ok || !result.activated) {
    return { ok: false, error: result.error || "That license key could not be activated." };
  }
  const cfg = config || licenseConfig();
  // Same guard as validation: a key from any other Lemon Squeezy merchant
  // activates fine on the public API — only accept this store's keys.
  if (!assertLicenseMeta(result.meta, cfg).ok) {
    return { ok: false, error: "This license key belongs to a different product, so it can't unlock Career Chief Pro." };
  }
  const variantName = result.meta ? result.meta.variantName : null;
  const tier = matchTier(variantName, cfg.tiers);
  const expiresAt = computeExpiresAt({
    createdAt: result.license ? result.license.createdAt : null,
    lsExpiresAt: result.license ? result.license.expiresAt : null,
    variantName,
    tiers: cfg.tiers,
  });
  writeJson(LICENSE_KEY, {
    licenseKey: result.licenseKey,
    instanceId: result.instanceId,
    instanceName: result.instanceName,
    state: "pro",
    validatedAt: Date.now(),
    variantName,
    tierName: tier ? tier.name : null,
    expiresAt,
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
