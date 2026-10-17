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

// A page title that describes a SEARCH, not a job — e.g.
// "20,630 Ai agent engineer jobs in United States". A leading results
// count followed by "jobs" is a listing title. Never use it as a role:
// blank is always better than wrong.
const SEARCH_TITLE = /^\s*\d{1,3}(?:,\d{3})*\s+\S[\s\S]*\bjobs?\b/i;

// URL shapes that are search / listing pages, not a single job.
// Glassdoor search carries SRCH; LinkedIn/Indeed/others use /jobs/search
// or /jobs?q=... A single-job page never matches these.
const SEARCH_URL = /(?:SRCH|[/]jobs[/]search|[/]jobs[/]collections|[/]jobs[?].*(?:q|keywords|search)=|[/]Job[/][^/]*-SRCH)/i;

  function isSearchPage({ title, url }) {
    if (typeof title === "string" && SEARCH_TITLE.test(title)) return true;
    if (typeof url === "string" && SEARCH_URL.test(url)) return true;
    return false;
  }

  // The job the user is VIEWING, not the page title. On split-view pages
  // (Glassdoor / LinkedIn / Indeed search) the tab title describes the
  // SEARCH, while the selected job's detail pane sits in the DOM. The pane
  // is the viewed job.
  //
  // Selectors are grounded in the real Glassdoor search page inspected
  // 2026-10-17 (fetched HTML, first job's pane server-rendered): the pane
  // header carries data-test="job-details-header", the title is
  // h1[id^="jd-job-title-"], the company is the h4 inside the
  // EmployerProfile name heading, and the description is the div whose
  // class contains JobDetails_jobDescription. Only class PREFIXES and
  // data-test / id-prefix hooks are matched — Glassdoor's CSS-module hash
  // suffixes change on redeploy, so full class names are never matched.
  // No LinkedIn / Indeed pane selectors are included: their detail panes
  // are client-rendered and could not be inspected, so no selector is
  // guessed for them — a search page with no pane yields a blank role.
  // `doc` is the live document (content script) or a fake in tests.
  function findViewedJob(doc, url) {
    try {
      if (!doc || typeof doc.querySelector !== "function") return null;
      const host = new URL(url).hostname.toLowerCase();
      if (!host.includes("glassdoor")) return null;
      const header =
        doc.querySelector('header[data-test="job-details-header"]') ||
        doc.querySelector('[class*="JobDetails_jobDetailsHeaderWrapper"]');
      if (!header || typeof header.querySelector !== "function") return null;
      const titleEl =
        header.querySelector('h1[id^="jd-job-title-"]') || header.querySelector("h1");
      const role = cleanLabel(titleEl && titleEl.innerText);
      if (!role) return null;
      const companyEl =
        header.querySelector('[class*="EmployerProfile_employerNameHeading"] h4') ||
        header.querySelector("h4");
      const company = cleanLabel(companyEl && companyEl.innerText);
      const descEl = doc.querySelector('[class*="JobDetails_jobDescription"]');
      const description = descEl && typeof descEl.innerText === "string"
        ? descEl.innerText.replace(/\s+/g, " ").trim().slice(0, MAX_TEXT)
        : "";
      const paneText = [header.innerText, descEl && descEl.innerText]
        .filter((part) => typeof part === "string" && part.trim())
        .join("\n")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, MAX_TEXT);
      return { role, company, description, text: paneText };
    } catch {
      return null;
    }
  }

  function collectJobPostings(node, out) {
    if (!node || typeof node !== "object") return out;
    if (Array.isArray(node)) {
      for (const item of node) collectJobPostings(item, out);
      return out;
    }
    const type = node["@type"];
    if (type === "JobPosting" || (Array.isArray(type) && type.includes("JobPosting"))) out.push(node);
    collectJobPostings(node["@graph"], out);
    return out;
  }

  function findJobPosting(node) {
    const all = collectJobPostings(node, []);
    return all[0] || null;
  }

  // Same rules as the server-side jobHints (shared/url-extract.mjs), but
  // operating on DOM-gathered inputs instead of raw HTML. Priority:
  //   1. The viewed job's detail pane (split-view search pages).
  //   2. On search / listing pages with no pane: blank role, blank
  //      description. Structured data is SKIPPED — a search page may carry
  //      many JobPosting blocks and taking the first would fill the wrong
  //      job. The company may still come from the board address (an org's
  //      own board states its company).
  //   3. On single-job pages: structured JobPosting first (if several,
  //      prefer the one whose title matches the page title), then the page
  //      title, then the job-board address.
  // A field is returned only when the page states it. The description
  // comes ONLY from structured JobPosting.description or the viewed
  // pane's description — never from raw page text, which is
  // nav/footer/cookie noise.
  function hintsFromInputs(jsonLdTexts, pageTitle, url, pane) {
    const hints = { role: "", company: "", description: "" };
    if (pane) {
      hints.role = pane.role || "";
      hints.company = pane.company || companyFromAddress(url);
      hints.description = pane.description || "";
      return hints;
    }
    if (isSearchPage({ title: pageTitle, url })) {
      hints.company = companyFromAddress(url);
      return hints;
    }
    const postings = [];
    for (const scriptText of jsonLdTexts || []) {
      try {
        collectJobPostings(JSON.parse(String(scriptText).trim()), postings);
      } catch {
        /* malformed structured data: fall through to the title */
      }
    }
    let posting = postings[0] || null;
    if (postings.length > 1) {
      const pageTitleClean = cleanLabel(pageTitle);
      posting =
        postings.find((item) => cleanLabel(item.title) && cleanLabel(item.title) === pageTitleClean) ||
        posting;
    }
    if (posting) {
      hints.role = cleanLabel(posting.title);
      const org = posting.hiringOrganization;
      hints.company = cleanLabel(typeof org === "string" ? org : org?.name);
      if (typeof posting.description === "string") {
        hints.description = stripHtml(posting.description).slice(0, MAX_TEXT);
      }
    }
    if (!hints.role || !hints.company) {
      const title = cleanLabel(pageTitle);
      if (!SEARCH_TITLE.test(title)) {
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
    }
    hints.company = hints.company || companyFromAddress(url);
    return hints;
  }

  // Plain-data in, payload out. `innerText` is the page's visible text;
  // it becomes the evidence source, NOT the job-description field — except
  // when a detail pane was found, in which case the PANE text is the
  // evidence (the viewed job, not the whole search page). `doc` is the
  // live document (content script) or a fake in tests; omit it when the
  // caller has no DOM.
  function extractPageContent({ title, innerText, jsonLdTexts, url, doc }) {
    const pane = findViewedJob(doc, url);
    const hints = hintsFromInputs(jsonLdTexts, title, url, pane);
    const text = pane
      ? pane.text
      : String(innerText || "")
          .replace(/\s+/g, " ")
          .trim()
          .slice(0, MAX_TEXT);
    const payloadTitle =
      pane && pane.role
        ? cleanLabel(pane.company ? `${pane.role} at ${pane.company}` : pane.role)
        : cleanLabel(title);
    return {
      title: payloadTitle,
      text,
      url: typeof url === "string" ? url : "",
      job: hints,
    };
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
