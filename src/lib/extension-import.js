import { applyJobHints } from "./job-autofill.js";

// Import payloads from the "Save to Career Chief" extension.
//
// The extension opens Career Chief with a URL fragment:
//   #import=<base64url JSON { title, text, url, job, searchPage }>
//
// searchPage is true when the saved page was a search/listing page with
// NO viewed job (no detail pane). The app uses it to skip adding a junk
// source for a search page instead of trusting the (blank) hints alone.
//
// This module only decodes and validates that fragment. The payload is
// UNTRUSTED input — it comes from an arbitrary web page — so it is never
// evaluated or executed: base64url-decode, JSON-parse, shape-check, and
// the caller treats the values exactly like pasted text (visible, editable
// suggestions; nothing is auto-analyzed). Anything malformed returns null;
// the caller surfaces that in the dock — a bad fragment must never crash
// the app, poison state, or fail silently.
const MAX_TEXT = 50_000;
const MAX_TITLE = 500;

export function decodeImportFragment(hash) {
  try {
    if (typeof hash !== "string" || !hash.startsWith("#import=")) return null;
    const encoded = hash.slice("#import=".length);
    if (!encoded) return null;
    const base64 = encoded.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (encoded.length % 4)) % 4);
    const binary = atob(base64);
    const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
    const parsed = JSON.parse(new TextDecoder().decode(bytes));
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    if (typeof parsed.title !== "string" || typeof parsed.text !== "string" || typeof parsed.url !== "string") {
      return null;
    }
    const url = new URL(parsed.url);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    const job = parsed.job && typeof parsed.job === "object" && !Array.isArray(parsed.job) ? parsed.job : {};
    return {
      title: parsed.title.trim().slice(0, MAX_TITLE),
      text: parsed.text.slice(0, MAX_TEXT),
      url: url.href,
      job,
      // Only an explicit true counts. Payloads from older extension builds
      // lack the field and fall through to the pre-existing behaviour.
      searchPage: parsed.searchPage === true,
    };
  } catch {
    return null;
  }
}

// Strip ONLY the #import= fragment, so a refresh never re-imports.
// Any other fragment is left untouched.
export function stripImportFragment(href) {
  try {
    const url = new URL(href);
    if (!url.hash.startsWith("#import=")) return href;
    url.hash = "";
    return url.href;
  } catch {
    return href;
  }
}

// ---------------------------------------------------------------------------
// The import decision, as a pure function so the whole flow is testable:
// given a decoded payload and the current intake state, decide the fills,
// whether a source is added, and exactly what the dock says.
//
// Rules, all load-bearing for trust:
// - Search-page saves (searchPage true, no viewed job) add NO source: a
//   search page's text is a list of OTHER jobs plus nav — adding it would
//   pollute the analysis. The dock says why and names the next step.
//   Fills are forced empty for a search save: search-page hints are
//   untrustworthy by definition, so nothing is pre-filled from them.
// - Duplicate saves (same normalized URL + source name already present)
//   add NO second source. Two DIFFERENT jobs saved from the same search
//   page share a URL but have different names, so they are not duplicates.
// - Otherwise the source is added and fills run through applyJobHints
//   (empty fields only, never overwrite typed values).
// - The dock never claims a fill that did not happen, and never stays
//   silent about a gap: a missing description is named, not implied.
// ---------------------------------------------------------------------------

function normalizeSourceKey({ url, name } = {}) {
  const cleanUrl = String(url || "").trim().replace(/\/$/, "");
  return `${cleanUrl}::${String(name || "").trim()}`;
}

export function isDuplicateSource(sources, { url, name } = {}) {
  const key = normalizeSourceKey({ url, name });
  return (sources || []).some((source) => normalizeSourceKey(source) === key);
}

export function summarizeExtensionImport(payload, { meta = {}, jobText = "", sources = [] } = {}) {
  const name = payload?.title || payload?.url || "";
  const job = payload?.job && typeof payload.job === "object" ? payload.job : {};
  const currentMeta = {
    company: typeof meta?.company === "string" ? meta.company : "",
    role: typeof meta?.role === "string" ? meta.role : "",
  };
  const currentJobText = typeof jobText === "string" ? jobText : "";
  const date = new Date().toLocaleDateString();

  // A search-page save: no source, no fills, honest next step.
  if (payload?.searchPage === true) {
    return {
      applied: { meta: currentMeta, jobText: currentJobText, filled: [] },
      source: null,
      skipped: true,
      duplicate: false,
      message:
        "That was a search page, not a single job — I didn't add it, because it would mix other jobs into your sources. Click the job you want, then Save.",
    };
  }

  const applied = applyJobHints(currentMeta, currentJobText, job);
  const hintsBlank =
    !job?.role?.trim() &&
    !job?.company?.trim() &&
    !(typeof job?.description === "string" && job.description.length >= 80);

  // A duplicate save: no second source. Fills still run (the user may
  // have cleared a field since the first save).
  if (isDuplicateSource(sources, { url: payload?.url, name })) {
    return {
      applied,
      source: null,
      skipped: false,
      duplicate: true,
      message: applied.filled.length
        ? `That job is already in your sources. Filled in the ${applied.filled.join(", ")} — check them.`
        : "That job is already in your sources — nothing new to add.",
    };
  }

  const source = {
    kind: "job",
    name,
    origin: `Saved from browser · ${date}`,
    url: payload?.url || "",
    text: typeof payload?.text === "string" ? payload.text : "",
    status: "ready",
  };

  if (applied.filled.length) {
    let message = `Saved "${name}" from your browser and filled in the ${applied.filled.join(", ")}. Check them and fix anything that's off.`;
    // The description box is still empty and the save yielded no
    // description: name the gap instead of letting the user discover it.
    if (!applied.filled.includes("job description") && !applied.jobText.trim()) {
      message += " The job description didn't come through — you can paste it in.";
    }
    return { applied, source, skipped: false, duplicate: false, message };
  }
  if (hintsBlank) {
    return {
      applied,
      source,
      skipped: false,
      duplicate: false,
      message: `Saved "${name}" from your browser as job evidence. I couldn't pull the role, company, or description from that page — type them in if you want them pre-filled.`,
    };
  }
  return {
    applied,
    source,
    skipped: false,
    duplicate: false,
    message: `Saved "${name}" from your browser as job evidence.`,
  };
}
