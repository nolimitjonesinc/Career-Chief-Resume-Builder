const MAX_BYTES = 1_000_000;

function isPublicHttps(raw) {
  const url = new URL(raw);
  const host = url.hostname.toLowerCase();
  if (url.protocol !== "https:") throw new Error("Use a public HTTPS link.");
  if (host === "localhost" || host.endsWith(".local") || !host.includes(".")) {
    throw new Error("That address is not a public website.");
  }
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host === "[::1]") {
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

export async function extractPublicUrl(rawUrl, fetchImpl = fetch) {
  const url = isPublicHttps(rawUrl);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);
  try {
    const response = await fetchImpl(url, {
      redirect: "follow",
      signal: controller.signal,
      headers: { "user-agent": "CareerChiefPrototype/1.0" },
    });
    if (!response.ok) throw new Error(`The page returned ${response.status}.`);
    const finalUrl = isPublicHttps(response.url || url.href);
    const type = response.headers.get("content-type") || "";
    if (!/(text\/html|text\/plain|application\/json)/i.test(type)) {
      throw new Error("That link is not a readable HTML or text page. Download and upload the document instead.");
    }
    const length = Number(response.headers.get("content-length") || 0);
    if (length > MAX_BYTES) throw new Error("That page is too large for this prototype.");
    const raw = (await response.text()).slice(0, MAX_BYTES);
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
