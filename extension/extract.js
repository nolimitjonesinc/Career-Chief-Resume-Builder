// Pure extraction for "Save to Career Chief" — NO chrome APIs, NO document
// access. The content script gathers plain data (title, innerText, JSON-LD
// script texts) and this module turns it into the import payload.
//
// Single source of truth: the content script (classic script, loaded via
// chrome.scripting.executeScript) and the tests (Node) both use THIS file.
// It is written as a UMD-style classic script on purpose — extension content
// scripts cannot import ESM modules without a bundler, and this repo has
// none for the extension. In a classic-script context it attaches to
// `self.CareerChiefExtract`; in Node tests it is loaded via `vm` and the
// same property is read off the sandbox.
(function (root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  } else if (root) {
    root.CareerChiefExtract = api;
  }
})(typeof self !== "undefined" ? self : this, function () {
  const MAX_TEXT = 50_000;

  function cleanLabel(value) {
    return typeof value === "string" ? decodeEntities(value).replace(/\s+/g, " ").trim().slice(0, 120) : "";
  }

  function decodeEntities(value) {
    return value
      .replace(/&nbsp;/gi, " ")
      .replace(/&amp;/gi, "&")
      .replace(/&quot;/gi, '"')
      .replace(/&#39;|&apos;/gi, "'")
      .replace(/&lt;/gi, "<")
      .replace(/&gt;/gi, ">");
  }

  function stripHtml(html) {
    return decodeEntities(
      String(html)
        .replace(/<script[\s\S]*?<\/script>/gi, " ")
        .replace(/<style[\s\S]*?<\/style>/gi, " ")
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim(),
    );
  }

  // Never treat a job board's own name as the company: "Role | LinkedIn"
  // means the company is unknown, not that the company is LinkedIn.
  const BOARD_NAMES = /^(linkedin|indeed|glassdoor|ziprecruiter|greenhouse|lever|workday|careers?|jobs?|home|apply)\b/i;

  function findJobPosting(node) {
    if (!node || typeof node !== "object") return null;
    if (Array.isArray(node)) {
      for (const item of node) {
        const hit = findJobPosting(item);
        if (hit) return hit;
      }
      return null;
    }
    const type = node["@type"];
    if (type === "JobPosting" || (Array.isArray(type) && type.includes("JobPosting"))) return node;
    return findJobPosting(node["@graph"]);
  }

  function companyFromAddress(url) {
    try {
      const parsed = new URL(url);
      const host = parsed.hostname.toLowerCase();
      const first = parsed.pathname.split("/").filter(Boolean)[0];
      if (
        first &&
        /(^|\.)(greenhouse\.io|lever\.co|ashbyhq\.com|workable\.com|smartrecruiters\.com)$/.test(host) &&
        /^[a-z0-9-]{2,40}$/i.test(first)
      ) {
        return first.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
      }
    } catch {
      /* unparseable address: no company hint */
    }
    return "";
  }

  // Same rules as the server-side jobHints (shared/url-extract.mjs), but
  // operating on DOM-gathered inputs instead of raw HTML: structured
  // JobPosting first, then the page title, then the job-board address.
  // A field is returned only when the page states it. The description
  // comes ONLY from structured JobPosting.description — never from raw
  // page text, which is nav/footer/cookie noise.
  function hintsFromInputs(jsonLdTexts, pageTitle, url) {
    const hints = { role: "", company: "", description: "" };
    for (const scriptText of jsonLdTexts || []) {
      try {
        const posting = findJobPosting(JSON.parse(String(scriptText).trim()));
        if (!posting) continue;
        hints.role = cleanLabel(posting.title);
        const org = posting.hiringOrganization;
        hints.company = cleanLabel(typeof org === "string" ? org : org?.name);
        if (typeof posting.description === "string") {
          hints.description = stripHtml(posting.description).slice(0, MAX_TEXT);
        }
        break;
      } catch {
        /* malformed structured data: fall through to the title */
      }
    }
    if (!hints.role || !hints.company) {
      const title = cleanLabel(pageTitle);
      const at = title.match(/^(.{3,90}?)\s+at\s+(.{2,60}?)(?:\s+[-|–].*)?$/i);
      const parts = title
        .split(/\s+[-|–]\s+/)
        .map((part) => part.trim())
        .filter(Boolean);
      if (at) {
        hints.role = hints.role || at[1];
        hints.company = hints.company || at[2];
      } else if (parts.length >= 2 && !BOARD_NAMES.test(parts[0])) {
        hints.role = hints.role || parts[0];
        if (!BOARD_NAMES.test(parts[1])) hints.company = hints.company || parts[1];
      }
    }
    hints.company = hints.company || companyFromAddress(url);
    return hints;
  }

  // Plain-data in, payload out. `innerText` is the page's visible text;
  // it becomes the evidence source, NOT the job-description field.
  function extractPageContent({ title, innerText, jsonLdTexts, url }) {
    const text = String(innerText || "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, MAX_TEXT);
    return {
      title: cleanLabel(title),
      text,
      url: typeof url === "string" ? url : "",
      job: hintsFromInputs(jsonLdTexts, title, url),
    };
  }

  // Chunked so a 50k-char payload never blows the argument stack.
  function base64UrlEncode(str) {
    const bytes = new TextEncoder().encode(str);
    let binary = "";
    const CHUNK = 0x8000;
    for (let i = 0; i < bytes.length; i += CHUNK) {
      binary += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK));
    }
    return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }

  function base64UrlDecode(encoded) {
    const base64 = encoded.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (encoded.length % 4)) % 4);
    const binary = atob(base64);
    const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  }

  function encodeImportPayload(payload) {
    return base64UrlEncode(JSON.stringify(payload));
  }

  function decodeImportPayload(encoded) {
    return JSON.parse(base64UrlDecode(encoded));
  }

  return { extractPageContent, encodeImportPayload, decodeImportPayload, MAX_TEXT };
});
