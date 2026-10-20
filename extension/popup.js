// Popup: collects the Career Chief URL (saved in chrome.storage.local)
// and asks the background worker to save the active tab. No page data
// flows through the popup itself.
//
// The production-default trap: a fresh install has no saved URL, so the
// field shows the production default — and Save then just opens the
// public site, which may not have the newest features yet. The note
// below fires ONLY while the URL is still that untouched default; once
// the user has saved any URL (Save click), it never appears again.
const DEFAULT_URL = "https://careerchief.ai/";

const input = document.getElementById("url");
const button = document.getElementById("save");
const status = document.getElementById("status");
const note = document.getElementById("default-note");

chrome.storage.local.get(
  { careerChiefUrl: DEFAULT_URL, careerChiefUrlSet: false },
  ({ careerChiefUrl, careerChiefUrlSet }) => {
    input.value = careerChiefUrl;
    if (!careerChiefUrlSet && careerChiefUrl === DEFAULT_URL) note.hidden = false;
  },
);

button.addEventListener("click", async () => {
  const raw = input.value.trim() || DEFAULT_URL;
  let normalized = raw;
  try {
    normalized = new URL(raw).href;
  } catch {
    try {
      normalized = new URL(`https://${raw}`).href;
    } catch {
      status.textContent = "That URL doesn't look valid — include https://.";
      return;
    }
  }
  // Ask once, for this one site, so a save can find and reuse the open tab.
  // Declining only means a new tab opens each time.
  try {
    const site = new URL(normalized);
    const bare = site.hostname.replace(/^www\./, "");
    await chrome.permissions.request({ origins: [`${site.protocol}//${bare}/*`, `${site.protocol}//www.${bare}/*`] });
  } catch {
    // Not granted: saving still works, it just opens a new tab.
  }
  await chrome.storage.local.set({ careerChiefUrl: normalized, careerChiefUrlSet: true });
  input.value = normalized;
  status.textContent = "Saving…";
  button.disabled = true;
  try {
    const response = await chrome.runtime.sendMessage({ type: "save-page" });
    status.textContent = response?.ok
      ? (response.reused ? "Saved — sent to your open Career Chief tab." : "Saved — Career Chief opened in a new tab.")
      : `Couldn't save: ${response?.error || "unknown error"}`;
  } catch {
    status.textContent = "Couldn't save — is the extension still running?";
  }
  button.disabled = false;
});
