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

  // Multi-line text (innerText / block HTML) keeps its line structure:
  // collapse horizontal whitespace only, trim each line's edges, collapse
  // 3+ newlines to 2, trim. Newlines are NEVER flattened into spaces —
  // a description with structure must not arrive as one run-on line.
  function normalizeMultilineText(value) {
    return String(value || "")
      .replace(/\r\n?/g, "\n")
      .replace(/[ \t\u00a0]+/g, " ")
      .replace(/^[ \t\u00a0]+|[ \t\u00a0]+$/gm, "")
      .replace(/\n{3,}/g, "\n\n")
      .trim()
      .slice(0, MAX_TEXT);
  }

  // Glassdoor's detail pane puts a metadata block AHEAD of the real
  // description: "Job Title: ... Job Category: ... Time Type: ..." —
  // leading "Label: value" runs whose labels are the pane's field names.
  // The description hint must hold the actual description, not that block
  // (Job Title also duplicates the role field). Only LEADING runs are
  // stripped: once the text stops starting with a known label, the rest
  // is the description, untouched. The labels below are the ones seen in
  // Danny's CACI screenshot plus Glassdoor's sibling field names; the
  // list errs short on purpose — a missed label leaves one metadata line
  // in the description, while a wrongly-stripped body line loses content.
  const METADATA_LABELS = [
    "Minimum Clearance Required to Start",
    "Percentage of Travel Required",
    "Clearance Required to Start",
    "Anticipated Posting End",
    "Security Clearance",
    "Travel Required",
    "Job Category",
    "Employee Type",
    "Employment Type",
    "Salary Range",
    "Compensation",
    "Requisition ID",
    "Job Location",
    "Work Location",
    "Posting End",
    "Posted Date",
    "Date Posted",
    "Job Title",
    "Time Type",
    "Job Type",
    "Type of Travel",
    "Location",
    "Salary",
    "Pay Range",
    "Base Pay",
    "Schedule",
    "Shift",
    "Work Type",
    "Job ID",
    "Req ID",
    "Pay",
  ];

  function escapeRegExp(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  // Longest first: "Minimum Clearance Required to Start" must win over
  // "Clearance Required to Start" when both could match at one position.
  const METADATA_ALT = [...METADATA_LABELS]
    .sort((a, b) => b.length - a.length)
    .map(escapeRegExp)
    .join("|");

  // A metadata value is a short field ("Full time", "TS/SCI with
  // Polygraph"). If the run to the next label / newline is longer than
  // this, it is body text that merely starts with a label word — stop and
  // keep it all. The final run (no next label, no newline) has no
  // delimiter between the value and any following body, so it is only
  // stripped when the whole remainder is short.
  const METADATA_VALUE_MAX = 150;
  const METADATA_FINAL_MAX = 60;

  function stripLeadingMetadata(text) {
    let rest = String(text || "");
    for (let guard = 0; guard < 50; guard++) {
      const trimmed = rest.replace(/^\s+/, "");
      const m = trimmed.match(new RegExp(`^(?:${METADATA_ALT})\\s*:\\s*`, "i"));
      if (!m) break;
      const after = trimmed.slice(m[0].length);
      // The value ends at the next metadata label, the next newline
      // (line-separated form), or the end — whichever comes first.
      let end = after.length;
      let bounded = false;
      const nl = after.indexOf("\n");
      if (nl >= 0) {
        end = Math.min(end, nl);
        bounded = true;
      }
      const next = new RegExp(`\\s+(?:${METADATA_ALT})\\s*:`, "gi").exec(after);
      if (next) {
        end = Math.min(end, next.index);
        bounded = true;
      }
      if (bounded ? end > METADATA_VALUE_MAX : after.length > METADATA_FINAL_MAX) break;
      rest = after.slice(end);
    }
    return rest.replace(/^\s+/, "");
  }

  // The description hint is what fills the description box: normalized
  // multi-line text with the pane's leading metadata block stripped. If
  // stripping would leave nothing usable (the description WAS only
  // metadata), fall back to the full text — never destroy the
  // description trying to clean it.
  function cleanDescriptionHint(raw) {
    const normalized = normalizeMultilineText(raw);
    const stripped = stripLeadingMetadata(normalized);
    if (stripped.trim().length < 20) return normalized;
    return stripped;
  }

  // HTML description (JSON-LD) keeps its block structure: block closers
  // and <br> become newlines BEFORE tags are stripped, so paragraphs
  // survive instead of collapsing into one run-on line. Tags are
  // stripped before entities are decoded, so "&lt;div&gt;" in the source
  // can never be mistaken for a real tag.
  function stripHtml(html) {
    const withBreaks = String(html)
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<(?:br|hr)[^>]*>/gi, "\n")
      .replace(/<\/(?:p|div|li|ul|ol|section|article|h[1-6]|tr|blockquote|pre)>/gi, "\n");
    return normalizeMultilineText(decodeEntities(withBreaks.replace(/<[^>]+>/g, " ")));
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

  // Prefer VISIBLE elements. A split-view page can carry more than one
  // pane header in the DOM — the real Glassdoor search page carries TWO
  // headers for the same job (the pane header + a sticky header), and a
  // stale hidden pane for a previously viewed job is possible. First-match
  // selection could pick a hidden/stale one. Elements that affirmatively
  // report no layout boxes are hidden; elements without layout info
  // (test fakes) count as visible so the fallback stays first-match.
  function isVisible(el) {
    if (!el || typeof el !== "object") return false;
    if (typeof el.getClientRects === "function") return el.getClientRects().length > 0;
    if ("offsetParent" in el) return el.offsetParent !== null;
    return true;
  }

  function queryAll(doc, sel) {
    try {
      if (doc && typeof doc.querySelectorAll === "function") return Array.from(doc.querySelectorAll(sel));
      if (doc && typeof doc.querySelector === "function") {
        const one = doc.querySelector(sel);
        return one ? [one] : [];
      }
    } catch {
      /* selector unsupported: no candidates */
    }
    return [];
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
      if (host.includes("linkedin")) return findLinkedInJob(doc);
      if (!host.includes("glassdoor")) return null;
      // Both header selectors can match several elements (pane + sticky
      // header). Prefer a VISIBLE header that yields a role; fall back to
      // any header that yields one.
      const headerCandidates = [];
      for (const el of [
        ...queryAll(doc, 'header[data-test="job-details-header"]'),
        ...queryAll(doc, '[class*="JobDetails_jobDetailsHeaderWrapper"]'),
      ]) {
        if (el && !headerCandidates.includes(el)) headerCandidates.push(el);
      }
      const orderedHeaders = [
        ...headerCandidates.filter(isVisible),
        ...headerCandidates.filter((el) => !isVisible(el)),
      ];
      let header = null;
      let role = "";
      for (const candidate of orderedHeaders) {
        if (!candidate || typeof candidate.querySelector !== "function") continue;
        const titleEl =
          candidate.querySelector('h1[id^="jd-job-title-"]') || candidate.querySelector("h1");
        const candidateRole = cleanLabel(titleEl && titleEl.innerText);
        if (candidateRole) {
          header = candidate;
          role = candidateRole;
          break;
        }
      }
      if (!header) return null;
      const companyEl =
        header.querySelector('[class*="EmployerProfile_employerNameHeading"] h4') ||
        header.querySelector("h4");
      const company = cleanLabel(companyEl && companyEl.innerText);
      // Same visibility preference for the description element.
      const descCandidates = queryAll(doc, '[class*="JobDetails_jobDescription"]');
      const withText = descCandidates.filter(
        (el) => typeof el?.innerText === "string" && el.innerText.trim(),
      );
      const orderedDesc = [...withText.filter(isVisible), ...withText.filter((el) => !isVisible(el))];
      const descEl = orderedDesc[0] || null;
      // The description HINT gets the metadata block stripped (its Job
      // Title duplicates the role field) and keeps line breaks. The
      // evidence text keeps the FULL pane, metadata included — Analyze
      // still needs to see clearance, travel, etc.
      const description =
        descEl && typeof descEl.innerText === "string" ? cleanDescriptionHint(descEl.innerText) : "";
      const paneText = normalizeMultilineText(
        [header.innerText, descEl && descEl.innerText]
          .filter((part) => typeof part === "string" && part.trim())
          .join("\n"),
      );
      return { role, company, description, text: paneText };
    } catch {
      return null;
    }
  }

  // LinkedIn's open job (split-view search or a single job page). Checked
  // against a live, logged-in LinkedIn job page on 2026-10-20: the detail
  // pane carries a top-card title, a top-card company name, and the full
  // description in #job-details. Only stable class PREFIXES are matched.
  // No pane found means null, and the page is then judged by its address.
  function findLinkedInJob(doc) {
    const pick = (sel) => {
      const els = queryAll(doc, sel);
      return [...els.filter(isVisible), ...els.filter((el) => !isVisible(el))][0] || null;
    };
    const titleEl = pick('[class*="job-details-jobs-unified-top-card__job-title"]');
    const role = cleanLabel(titleEl && titleEl.innerText);
    if (!role) return null;
    const companyEl = pick('[class*="job-details-jobs-unified-top-card__company-name"]');
    const company = cleanLabel(companyEl && companyEl.innerText);
    const descEl = pick("#job-details") || pick('[class*="jobs-description__content"]');
    const rawDescription = descEl && typeof descEl.innerText === "string" ? descEl.innerText : "";
    const description = cleanDescriptionHint(rawDescription.replace(/^\s*About the job\s*/i, ""));
    const text = normalizeMultilineText(
      [company, role, rawDescription].filter((part) => typeof part === "string" && part.trim()).join("\n"),
    );
    return { role, company, description, text };
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
        hints.description = cleanDescriptionHint(stripHtml(posting.description));
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
  // evidence (the viewed job, not the whole search page). `searchPage`
  // tells the app this was a search/listing page with NO viewed job, so
  // the app can skip adding a junk source for it instead of trusting the
  // (blank) hints alone. `doc` is the live document (content script) or
  // a fake in tests; omit it when the caller has no DOM.
  function extractPageContent({ title, innerText, jsonLdTexts, url, doc }) {
    const pane = findViewedJob(doc, url);
    const hints = hintsFromInputs(jsonLdTexts, title, url, pane);
    const text = pane ? pane.text : normalizeMultilineText(innerText);
    const payloadTitle =
      pane && pane.role
        ? cleanLabel(pane.company ? `${pane.role} at ${pane.company}` : pane.role)
        : cleanLabel(title);
    return {
      title: payloadTitle,
      text,
      url: typeof url === "string" ? url : "",
      job: hints,
      searchPage: !pane && isSearchPage({ title, url }),
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
