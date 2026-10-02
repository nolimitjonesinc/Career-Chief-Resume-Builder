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
    return { url: finalUrl.href, title, text: text.slice(0, 50_000), fetchedAt: new Date().toISOString() };
  } catch (error) {
    if (error.name === "AbortError") throw new Error("The page took too long to respond.");
    if (error instanceof TypeError && /fetch/i.test(error.message)) throw new Error("The page could not be reached by the link reader.");
    throw error;
  } finally {
    clearTimeout(timer);
  }
}
