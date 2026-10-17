// Import payloads from the "Save to Career Chief" extension.
//
// The extension opens Career Chief with a URL fragment:
//   #import=<base64url JSON { title, text, url, job }>
//
// This module only decodes and validates that fragment. The payload is
// UNTRUSTED input — it comes from an arbitrary web page — so it is never
// evaluated or executed: base64url-decode, JSON-parse, shape-check, and
// the caller treats the values exactly like pasted text (visible, editable
// suggestions; nothing is auto-analyzed). Anything malformed returns null
// and the import is silently ignored: a bad fragment must never crash
// the app or poison state.
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
