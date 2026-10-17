// Background service worker: owns the save flow. The popup only collects
// the Career Chief URL and asks for a save; this worker runs the extractor
// on the active tab and opens Career Chief with the payload as a URL
// fragment. Nothing is sent anywhere except Career Chief, and only on click.
importScripts("extract.js");

const DEFAULT_URL = "https://careerchief.ai/";

function normalizeBase(value) {
  const trimmed = String(value || "").trim() || DEFAULT_URL;
  try {
    return new URL(trimmed).href;
  } catch {
    return new URL(`https://${trimmed}`).href;
  }
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== "save-page") return;
  (async () => {
    try {
      const { careerChiefUrl } = await chrome.storage.local.get({
        careerChiefUrl: DEFAULT_URL,
      });
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.id) throw new Error("No active tab.");
      const results = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ["extract.js", "content.js"],
      });
      const page = results?.[0]?.result;
      if (!page || typeof page.text !== "string" || !page.text.trim()) {
        throw new Error("This page has no readable text to save.");
      }
      const url = new URL(normalizeBase(careerChiefUrl));
      url.hash = `import=${self.CareerChiefExtract.encodeImportPayload(page)}`;
      await chrome.tabs.create({ url: url.href });
      sendResponse({ ok: true });
    } catch (error) {
      sendResponse({ ok: false, error: error?.message || "Could not save this page." });
    }
  })();
  return true; // keep the message channel open for the async response
});
