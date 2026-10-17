// Popup: collects the Career Chief URL (saved in chrome.storage.local)
// and asks the background worker to save the active tab. No page data
// flows through the popup itself.
const DEFAULT_URL = "https://careerchief.ai/";

const input = document.getElementById("url");
const button = document.getElementById("save");
const status = document.getElementById("status");

chrome.storage.local.get({ careerChiefUrl: DEFAULT_URL }, ({ careerChiefUrl }) => {
  input.value = careerChiefUrl;
});

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
  await chrome.storage.local.set({ careerChiefUrl: normalized });
  input.value = normalized;
  status.textContent = "Saving…";
  button.disabled = true;
  try {
    const response = await chrome.runtime.sendMessage({ type: "save-page" });
    status.textContent = response?.ok
      ? "Saved — Career Chief opened in a new tab."
      : `Couldn't save: ${response?.error || "unknown error"}`;
  } catch {
    status.textContent = "Couldn't save — is the extension still running?";
  }
  button.disabled = false;
});
