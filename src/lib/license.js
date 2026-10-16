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

// Lemon Squeezy's raw errors are terse ("...activation limit..."). When the
// seats are exhausted, say so plainly and point at the two ways out.
function friendlyActivationError(rawError) {
  const raw = typeof rawError === "string" && rawError ? rawError : "That license key could not be activated.";
  if (/activation limit|no more activations|maximum .* activat|instance limit/i.test(raw)) {
    return "This key is already active on 3 browsers. Deactivate it in an old browser to free a seat — or email support@dannyjones.ai and we'll reset it for you.";
  }
  return raw;
}

export async function activateLicense(rawKey, client = licenseClient(), config = null) {
  const result = await client.activate(rawKey, getInstanceName());
  if (!result.ok || !result.activated) {
    return { ok: false, error: friendlyActivationError(result.error) };
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

// ── Daily export limit ──────────────────────────────────────────────────────
// Cap: 10 finished-file exports per license key per calendar day (the user's
// local day). Counts live in localStorage next to the license record, keyed
// by license key so two keys in one browser get separate counts.
//
// HONEST LIMIT: this is client-side friction, not a wall. A determined abuser
// could clear browser storage and keep going — real server-side enforcement
// would need a backend this app doesn't have. It stops casual key-sharing and
// makes running a resume shop on one key impractical, which is the goal.
// The count is deliberately NOT cleared when a license is deactivated, so
// deactivating and re-activating the same key the same day can't reset it.
// If storage is unavailable the check fails open (allows the export) so a
// paying user in a blocked-storage browser is never locked out by the cap.

export const DAILY_EXPORT_LIMIT = 10;
export const EXPORT_LIMIT_MESSAGE =
  "Daily export limit reached — you've used your 10 exports for today. Your draft is safe; come back tomorrow to export again.";
const EXPORT_COUNT_KEY = "career-chief-export-count-v1";

function exportDayKey(date) {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function normalizeExportNow(now) {
  if (now instanceof Date) return now;
  if (typeof now === "number") return new Date(now);
  return new Date();
}

function readExportCounts() {
  try {
    const parsed = JSON.parse(localStorage.getItem(EXPORT_COUNT_KEY) || "null");
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function writeExportCounts(counts) {
  try {
    localStorage.setItem(EXPORT_COUNT_KEY, JSON.stringify(counts));
  } catch {
    /* Storage may be blocked; the export still went through (fail open). */
  }
}

// Exports this key has already used today (0 when none, or when the stored
// entry is from an earlier day — the counter resets with the calendar).
export function getExportCountForToday(licenseKey, now) {
  if (!licenseKey) return 0;
  const entry = readExportCounts()[String(licenseKey)];
  if (!entry || typeof entry !== "object" || entry.date !== exportDayKey(normalizeExportNow(now))) return 0;
  const count = Number(entry.count);
  return Number.isFinite(count) && count > 0 ? Math.floor(count) : 0;
}

export function getExportUsage(licenseKey, now) {
  const count = getExportCountForToday(licenseKey, now);
  return { count, limit: DAILY_EXPORT_LIMIT, remaining: Math.max(0, DAILY_EXPORT_LIMIT - count) };
}

export function canExport(licenseKey, now) {
  // No key: fail open — the Pro gate already blocks keyless exports, so a
  // missing key here must never become a new lockout path.
  if (!licenseKey) return true;
  return getExportCountForToday(licenseKey, now) < DAILY_EXPORT_LIMIT;
}

// Record one completed export. Returns { allowed, count, remaining }.
// Refuses to count past the cap, so calling it without a prior canExport
// check still can't push a key over the limit. Call this only after an
// export actually succeeded — a failed export must not burn quota.
export function recordExport(licenseKey, now) {
  if (!licenseKey) return { allowed: true, count: 0, remaining: DAILY_EXPORT_LIMIT };
  const date = normalizeExportNow(now);
  const day = exportDayKey(date);
  const counts = readExportCounts();
  const key = String(licenseKey);
  const current = getExportCountForToday(licenseKey, date);
  if (current >= DAILY_EXPORT_LIMIT) return { allowed: false, count: current, remaining: 0 };
  const next = current + 1;
  counts[key] = { date: day, count: next };
  writeExportCounts(counts);
  return { allowed: true, count: next, remaining: DAILY_EXPORT_LIMIT - next };
}
