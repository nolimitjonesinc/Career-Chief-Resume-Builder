// Lemon Squeezy license-key Pro unlock — pure logic, no DOM, no secrets.
//
// This module talks ONLY to the public License API
// (https://api.lemonsqueezy.com/v1/licenses/). That API is unauthenticated by
// design: the license key itself is the credential, it is CORS-open, and it is
// safe to call from the browser. Requests are form-encoded POSTs; responses are
// plain JSON (NOT JSON:API). Rate limit: 60 requests/minute.
//
// NEVER put a Lemon Squeezy API key (Bearer, api.lemonsqueezy.com/v1) in client
// code. None is needed here.
//
// Config comes from Vite env vars (import.meta.env.VITE_LS_*). In plain Node
// (tests) import.meta.env is undefined and everything degrades to "".

export const LICENSE_API = "https://api.lemonsqueezy.com/v1/licenses";

// ── Config ──────────────────────────────────────────────────────────────────

// Read defensively: Vite replaces import.meta.env at build time in the browser;
// in Node (tests, scripts) it is undefined and process.env may carry the values.
function readEnv(name) {
  try {
    const viteEnv = typeof import.meta !== "undefined" ? import.meta.env : undefined;
    if (viteEnv && viteEnv[name] !== undefined && viteEnv[name] !== "") return String(viteEnv[name]);
  } catch { /* import.meta.env is not available here */ }
  if (typeof process !== "undefined" && process.env && process.env[name]) return String(process.env[name]);
  return "";
}

export function licenseConfig(env = null) {
  const get = env
    ? (name) => (env[name] !== undefined && env[name] !== "" ? String(env[name]) : "")
    : readEnv;
  const storeId = get("VITE_LS_STORE_ID").trim();
  const productId = get("VITE_LS_PRODUCT_ID").trim();
  const variantId = get("VITE_LS_VARIANT_ID").trim();
  const checkoutOverride = get("VITE_LS_CHECKOUT_URL").trim();
  const priceLabel = get("VITE_LS_PRICE_LABEL").trim();
  const checkoutUrl = buildCheckoutUrl(variantId, checkoutOverride);
  let tiers = parseTiers(get("VITE_LS_TIERS"));
  if (tiers.length === 0 && variantId) {
    // Legacy single-variant setup: present it as one tier so the dialog
    // works unchanged with either configuration style.
    tiers = [{ name: "Pro", price: priceLabel, variant: variantId, url: checkoutUrl, term: "" }];
  }
  return {
    storeId,
    productId,
    variantId,
    priceLabel,
    checkoutUrl,
    tiers,
    // "Configured" means real checkout links exist: with tiers, any tier's
    // link; otherwise the legacy variant. Without either, the buy UI stays
    // hidden until then.
    configured: tiers.length > 0,
  };
}

// ── Tiers ───────────────────────────────────────────────────────────────────

// A tier is { name, price, variant, url, term }. VITE_LS_TIERS carries them as
// a JSON array, e.g.
// [{"name":"30-Day","price":"$29","variant":"<uuid>","url":"<checkout>","term":"30 days"}]
// Parsing fails closed: anything malformed yields [], and the caller falls
// back to the single-variant config (or "not configured"). The `url` may be
// omitted when `variant` is given — the hosted buy link is built from it.
export function parseTiers(raw) {
  let parsed;
  try {
    parsed = JSON.parse(String(raw || ""));
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  const tiers = [];
  for (const entry of parsed) {
    if (!entry || typeof entry !== "object") continue;
    const name = String(entry.name || "").trim();
    const variant = String(entry.variant || "").trim();
    const explicitUrl = String(entry.url || "").trim().replace(/\/+$/, "");
    const url = explicitUrl || (variant ? buildCheckoutUrl(variant) : "");
    if (!name || !url) continue;
    tiers.push({
      name,
      price: String(entry.price || "").trim(),
      variant,
      url,
      term: String(entry.term || "").trim(),
    });
  }
  return tiers;
}

// Lemon Squeezy buy links look like
// https://app.lemonsqueezy.com/checkout/buy/{variant-uuid}. A custom store
// domain can be supplied instead via VITE_LS_CHECKOUT_URL.
export function buildCheckoutUrl(variantId, override = "") {
  const cleanOverride = String(override || "").trim().replace(/\/+$/, "");
  if (cleanOverride) return cleanOverride;
  const cleanVariant = String(variantId || "").trim();
  if (!cleanVariant) return "";
  return `https://app.lemonsqueezy.com/checkout/buy/${cleanVariant}`;
}

// ── License key normalization ──────────────────────────────────────────────

// Keys look like XXXXXXXX-XXXXXXXX-XXXXXXXX-XXXXXXXX. Users paste them with
// stray spaces and lowercase; normalize before sending.
export function normalizeLicenseKey(raw) {
  return String(raw || "").trim().toUpperCase().replace(/\s+/g, "");
}

// ── Request bodies (form-encoded, as the License API requires) ─────────────

export function activateBody(licenseKey, instanceName) {
  const body = new URLSearchParams();
  body.set("license_key", licenseKey);
  body.set("instance_name", instanceName);
  return body;
}

export function validateBody(licenseKey, instanceId) {
  const body = new URLSearchParams();
  body.set("license_key", licenseKey);
  if (instanceId) body.set("instance_id", instanceId);
  return body;
}

export function deactivateBody(licenseKey, instanceId) {
  const body = new URLSearchParams();
  body.set("license_key", licenseKey);
  body.set("instance_id", instanceId);
  return body;
}

// ── Response parsers (plain JSON, NOT JSON:API) ────────────────────────────

function asRecord(value) {
  return value && typeof value === "object" ? value : {};
}

function licenseKeySummary(raw) {
  const key = asRecord(raw);
  return {
    id: key.id ?? null,
    status: key.status ?? null,
    key: typeof key.key === "string" ? key.key : null,
  };
}

// POST /v1/licenses/activate → { activated, error, license_key, instance, meta }
export function parseActivate(json) {
  const data = asRecord(json);
  if (data.activated === true) {
    const instance = asRecord(data.instance);
    return {
      ok: true,
      activated: true,
      instanceId: instance.id ?? null,
      instanceName: instance.name ?? null,
      license: licenseKeySummary(data.license_key),
      error: null,
    };
  }
  return {
    ok: false,
    activated: false,
    instanceId: null,
    instanceName: null,
    license: licenseKeySummary(data.license_key),
    error: typeof data.error === "string" && data.error ? data.error : "That license key could not be activated.",
  };
}

// POST /v1/licenses/validate → { valid, error, license_key, instance, meta }
export function parseValidate(json) {
  const data = asRecord(json);
  if (data.valid === true) {
    return { ok: true, valid: true, license: licenseKeySummary(data.license_key), error: null };
  }
  return {
    ok: false,
    valid: false,
    license: licenseKeySummary(data.license_key),
    error: typeof data.error === "string" && data.error ? data.error : "That license key is not valid.",
  };
}

// POST /v1/licenses/deactivate → { deactivated, error, license_key, meta }
export function parseDeactivate(json) {
  const data = asRecord(json);
  if (data.deactivated === true) {
    return { ok: true, deactivated: true, license: licenseKeySummary(data.license_key), error: null };
  }
  return {
    ok: false,
    deactivated: false,
    license: licenseKeySummary(data.license_key),
    error: typeof data.error === "string" && data.error ? data.error : "That license could not be deactivated.",
  };
}

// ── Client ────────────────────────────────────────────────────────────────

// fetchImpl defaults to the global fetch so tests can inject a stub. Every
// failure mode — network down, non-JSON body, HTTP error — resolves to
// { ok: false, error } so the UI can fail closed to the free tier.
export class LicenseClient {
  constructor(fetchImpl = null) {
    this.fetch = fetchImpl || (typeof fetch !== "undefined" ? fetch.bind(globalThis) : null);
  }

  async post(action, body) {
    if (!this.fetch) return { ok: false, error: "Licensing is unavailable in this environment." };
    let response;
    try {
      response = await this.fetch(`${LICENSE_API}/${action}`, {
        method: "POST",
        headers: { Accept: "application/json" },
        body,
      });
    } catch {
      return { ok: false, error: "Could not reach the license server. Check your connection and try again." };
    }
    let json = null;
    try {
      json = await response.json();
    } catch {
      return { ok: false, error: "The license server returned an unreadable response." };
    }
    return { ok: true, json, status: response.status };
  }

  async activate(licenseKey, instanceName) {
    const key = normalizeLicenseKey(licenseKey);
    if (!key) return { ok: false, activated: false, error: "Enter the license key from your purchase email." };
    const result = await this.post("activate", activateBody(key, instanceName));
    if (!result.ok) return { ...result, activated: false };
    const parsed = parseActivate(result.json);
    return { ...parsed, licenseKey: key };
  }

  async validate(licenseKey, instanceId) {
    const key = normalizeLicenseKey(licenseKey);
    if (!key) return { ok: false, valid: false, error: "No license key is stored on this browser." };
    const result = await this.post("validate", validateBody(key, instanceId || ""));
    if (!result.ok) return { ...result, valid: false };
    return parseValidate(result.json);
  }

  async deactivate(licenseKey, instanceId) {
    const key = normalizeLicenseKey(licenseKey);
    if (!key || !instanceId) return { ok: false, deactivated: false, error: "No active license found on this browser." };
    const result = await this.post("deactivate", deactivateBody(key, instanceId));
    if (!result.ok) return { ...result, deactivated: false };
    return parseDeactivate(result.json);
  }
}

// ── Gating ────────────────────────────────────────────────────────────────

// The paid side of the boundary: finished resume exports (DOCX/PDF/HTML/TXT).
// Everything else — intake, analysis, interview, on-screen preview, editing,
// ledger, coverage, parse check — stays free. Unknown/checking states are NOT
// pro: the gate only opens on a positively validated license.
export function isProActive(proState) {
  return proState === "pro";
}
