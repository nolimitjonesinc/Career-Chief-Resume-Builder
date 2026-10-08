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
    // createdAt anchors client-side term expiry: a license key is issued at
    // purchase time, so createdAt + the tier's term is when Pro ends — even if
    // the buyer re-activates later in another browser. expiresAt is Lemon
    // Squeezy's own expiry when it sets one (null for one-time products).
    createdAt: typeof key.created_at === "string" ? key.created_at : null,
    expiresAt: typeof key.expires_at === "string" ? key.expires_at : null,
  };
}

// The `meta` block on every License API response names the store, product and
// variant the key was sold for. It is the only thing tying a key to THIS
// product: the public License API is unauthenticated, so without checking it,
// a license key bought from any other Lemon Squeezy merchant would validate
// here too.
export function parseLicenseMeta(raw) {
  const meta = asRecord(raw);
  const num = (value) => (value === null || value === undefined || value === "" ? null : value);
  const str = (value) => (typeof value === "string" && value !== "" ? value : null);
  return {
    storeId: num(meta.store_id),
    orderId: num(meta.order_id),
    orderItemId: num(meta.order_item_id),
    productId: num(meta.product_id),
    productName: str(meta.product_name),
    variantId: num(meta.variant_id),
    variantName: str(meta.variant_name),
    customerId: num(meta.customer_id),
    customerName: str(meta.customer_name),
    customerEmail: str(meta.customer_email),
  };
}

// ── Term expiry ───────────────────────────────────────────────────────────

// Lemon Squeezy does not expire license keys for one-time products — the store
// sells "30-Day" and "1-Year" tiers, but the keys stay valid forever unless we
// enforce the term ourselves. The tier is identified from the meta block: first
// by matching the tier's configured name against the variant name, then by
// keyword fallback on the variant name. Unknown tiers return null (no expiry)
// so a paying customer is never locked out by a naming surprise.
export const DAY_MS = 24 * 60 * 60 * 1000;

// Match a license variant name against the configured tier names. Returns the
// tier object, or null when nothing matches. Used for the tier label in the UI
// and as the preferred signal for term length.
export function matchTier(variantName, tiers = []) {
  const name = String(variantName || "").toLowerCase();
  if (!name) return null;
  const list = Array.isArray(tiers) ? tiers : [];
  for (const tier of list) {
    const tierName = tier && typeof tier.name === "string" ? tier.name.toLowerCase() : "";
    if (tierName !== "" && name.includes(tierName)) return tier;
  }
  for (const tier of list) {
    const tierName = tier && typeof tier.name === "string" ? tier.name.toLowerCase() : "";
    if (tierName !== "" && tierName.includes(name)) return tier;
  }
  return null;
}

export function licenseTermMs(variantName, tiers = []) {
  // Prefer the configured tier names: the variant name usually contains them
  // ("Career Chief Pro — 30-Day").
  const tier = matchTier(variantName, tiers);
  const haystack = `${tier ? tier.name : ""} ${variantName || ""}`.toLowerCase();
  if (/(lifetime|life-time|forever)/.test(haystack)) return null;
  if (/(year|annual|12.?mo|365)/.test(haystack)) return 365 * DAY_MS;
  if (/(30|month|day)/.test(haystack)) return 30 * DAY_MS;
  return null;
}

// The earliest moment Pro ends for this key, as an ISO string, or null when
// the key never expires. Anchored on the key's creation (purchase) time so
// re-activating in another browser cannot extend the term.
export function computeExpiresAt({ createdAt, lsExpiresAt, variantName, tiers } = {}) {
  const termMs = licenseTermMs(variantName, tiers);
  const candidates = [];
  if (typeof lsExpiresAt === "string" && !Number.isNaN(Date.parse(lsExpiresAt))) {
    candidates.push(Date.parse(lsExpiresAt));
  }
  if (termMs !== null) {
    const created = typeof createdAt === "string" ? Date.parse(createdAt) : Number.NaN;
    if (!Number.isNaN(created)) candidates.push(created + termMs);
  }
  if (candidates.length === 0) return null;
  return new Date(Math.min(...candidates)).toISOString();
}

// ── Key-to-product assertion ──────────────────────────────────────────────

// Reject keys that are not from this store. Fails closed: a missing meta
// block, or a store id that does not match the configured one, means the key
// is not accepted. When no store id is configured (local dev), only the
// presence of the meta block is required.
export function assertLicenseMeta(meta, config = {}) {
  if (!meta || typeof meta !== "object" || meta.storeId === null || meta.storeId === undefined || meta.storeId === "") {
    return { ok: false, error: "The license server did not identify which product this key belongs to." };
  }
  const want = String(config.storeId || "").trim();
  if (want !== "" && String(meta.storeId) !== want) {
    return { ok: false, error: "This license key belongs to a different store." };
  }
  return { ok: true, error: "" };
}

// POST /v1/licenses/activate → { activated, error, license_key, instance, meta }
export function parseActivate(json) {
  const data = asRecord(json);
  const meta = parseLicenseMeta(data.meta);
  if (data.activated === true) {
    const instance = asRecord(data.instance);
    return {
      ok: true,
      activated: true,
      instanceId: instance.id ?? null,
      instanceName: instance.name ?? null,
      license: licenseKeySummary(data.license_key),
      meta,
      error: null,
    };
  }
  return {
    ok: false,
    activated: false,
    instanceId: null,
    instanceName: null,
    license: licenseKeySummary(data.license_key),
    meta,
    error: typeof data.error === "string" && data.error ? data.error : "That license key could not be activated.",
  };
}

// POST /v1/licenses/validate → { valid, error, license_key, instance, meta }
export function parseValidate(json) {
  const data = asRecord(json);
  const meta = parseLicenseMeta(data.meta);
  if (data.valid === true) {
    return { ok: true, valid: true, license: licenseKeySummary(data.license_key), meta, error: null };
  }
  return {
    ok: false,
    valid: false,
    license: licenseKeySummary(data.license_key),
    meta,
    error: typeof data.error === "string" && data.error ? data.error : "That license key is not valid.",
  };
}

// POST /v1/licenses/deactivate → { deactivated, error, license_key, meta }
export function parseDeactivate(json) {
  const data = asRecord(json);
  if (data.deactivated === true) {
    return { ok: true, deactivated: true, license: licenseKeySummary(data.license_key), meta: parseLicenseMeta(data.meta), error: null };
  }
  return {
    ok: false,
    deactivated: false,
    license: licenseKeySummary(data.license_key),
    meta: parseLicenseMeta(data.meta),
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
