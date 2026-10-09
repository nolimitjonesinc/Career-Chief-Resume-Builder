import { assertHostResolvesPublic } from "./net-safety.mjs";
import { readTextLimited } from "./limited-read.mjs";

const MAX_BYTES = 1_000_000;
const MAX_HOPS = 5;

function isPublicHttps(raw) {
  const url = new URL(raw);
  // A trailing dot ("localhost.") names the same host; check the name without it.
  const host = url.hostname.toLowerCase().replace(/\.$/, "");
  if (url.protocol !== "https:") throw new Error("Use a public HTTPS link.");
  if (url.username || url.password) throw new Error("Links with a username or password are not supported.");
  if (url.port && url.port !== "443") throw new Error("Only standard HTTPS links are supported.");
  if (host === "localhost" || host.endsWith(".local") || !host.includes(".")) {
    throw new Error("That address is not a public website.");
  }
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.startsWith("[")) {
    throw new Error("Direct IP addresses are not supported.");
  }
  return url;
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

function htmlToText(html) {
  return decodeEntities(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim(),
  );
}


// Best-effort job details read from the page itself. Nothing is invented: a
// field is returned only when the page states it (structured job data first,
// then the page title, then the job-board address). The caller shows these as
// editable suggestions.
const BOARD_NAMES = /^(linkedin|indeed|glassdoor|ziprecruiter|greenhouse|lever|workday|careers?|jobs?|home|apply)\b/i;

function findJobPosting(node) {
  if (!node || typeof node !== "object") return null;
  if (Array.isArray(node)) {
    for (const item of node) { const hit = findJobPosting(item); if (hit) return hit; }
    return null;
  }
  const type = node["@type"];
  if (type === "JobPosting" || (Array.isArray(type) && type.includes("JobPosting"))) return node;
  return findJobPosting(node["@graph"]);
}

function cleanLabel(value) {
  return typeof value === "string" ? decodeEntities(value).replace(/\s+/g, " ").trim().slice(0, 120) : "";
}

function companyFromAddress(url) {
  const host = url.hostname.toLowerCase();
  const first = url.pathname.split("/").filter(Boolean)[0];
  if (first && /(^|\.)(greenhouse\.io|lever\.co|ashbyhq\.com|workable\.com|smartrecruiters\.com)$/.test(host) && /^[a-z0-9-]{2,40}$/i.test(first)) {
    return first.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  }
  return "";
}

export function jobHints(raw, pageTitle, url) {
  const hints = { role: "", company: "", description: "" };
  for (const match of raw.matchAll(/<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const posting = findJobPosting(JSON.parse(match[1].trim()));
      if (!posting) continue;
      hints.role = cleanLabel(posting.title);
      const org = posting.hiringOrganization;
      hints.company = cleanLabel(typeof org === "string" ? org : org?.name);
      if (typeof posting.description === "string") hints.description = htmlToText(decodeEntities(posting.description)).slice(0, 50_000);
      break;
    } catch { /* malformed structured data: fall through to the title */ }
  }
  if (!hints.role || !hints.company) {
    const title = cleanLabel(raw.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i)?.[1] || pageTitle);
    const at = title.match(/^(.{3,90}?)\s+at\s+(.{2,60}?)(?:\s+[-|–].*)?$/i);
    const parts = title.split(/\s+[-|–]\s+/).map((part) => part.trim()).filter(Boolean);
    if (at) {
      hints.role ||= at[1];
      hints.company ||= at[2];
    } else if (parts.length >= 2 && !BOARD_NAMES.test(parts[0])) {
      hints.role ||= parts[0];
      if (!BOARD_NAMES.test(parts[1])) hints.company ||= parts[1];
    }
  }
  hints.company ||= companyFromAddress(new URL(url));
  return hints;
}

// Follow redirects by hand. Every hop is checked (name, then where the name
// actually points) BEFORE the request for that hop is made; letting fetch follow
// redirects would check only after the request had already gone out.
async function fetchPublic(startUrl, fetchImpl, resolve, signal) {
  let url = startUrl;
  for (let hop = 0; hop <= MAX_HOPS; hop += 1) {
    await assertHostResolvesPublic(url.hostname, resolve);
    const response = await fetchImpl(url, { redirect: "manual", signal, headers: { "user-agent": "CareerChiefPrototype/1.0" } });
    if (response.status >= 300 && response.status < 400 && response.headers.get("location")) {
      await response.body?.cancel?.().catch?.(() => {});
      url = isPublicHttps(new URL(response.headers.get("location"), url).href);
      continue;
    }
    return { response, url };
  }
  throw new Error("That link redirected too many times.");
}

export async function extractPublicUrl(rawUrl, fetchImpl = fetch, { resolve } = {}) {
  const start = isPublicHttps(rawUrl);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);
  try {
    const { response, url: finalUrl } = await fetchPublic(start, fetchImpl, resolve, controller.signal);
    if (!response.ok) throw new Error(`The page returned ${response.status}.`);
    const type = response.headers.get("content-type") || "";
    if (!/(text\/html|text\/plain|application\/json)/i.test(type)) {
      throw new Error("That link is not a readable HTML or text page. Download and upload the document instead.");
    }
    // Truncate rather than reject: the first megabyte of a long page is plenty.
    const raw = await readTextLimited(response, MAX_BYTES, "truncate");
    const title = decodeEntities(raw.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.trim() || finalUrl.hostname);
    const text = type.includes("html") ? htmlToText(raw) : raw.replace(/\s+/g, " ").trim();
    if (text.length < 80) throw new Error("The page did not expose enough readable text.");
    return { url: finalUrl.href, title, text: text.slice(0, 50_000), job: jobHints(raw, title, finalUrl.href), fetchedAt: new Date().toISOString() };
  } catch (error) {
    if (error.name === "AbortError") throw new Error("The page took too long to respond.");
    if (error instanceof TypeError && /fetch/i.test(error.message)) throw new Error("The page could not be reached by the link reader.");
    throw error;
  } finally {
    clearTimeout(timer);
  }
}
