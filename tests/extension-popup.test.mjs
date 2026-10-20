import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

// popup.js is a classic browser script (chrome.* + document). Load it in
// a vm with faked chrome/storage/document and drive it: this is the only
// test that can prove the fresh-install default-URL note fires exactly
// when it should — untouched production default, never after any URL save.
const POPUP_CODE = readFileSync(new URL("../extension/popup.js", import.meta.url), "utf8");
const DEFAULT_URL = "https://careerchief.ai/";

function loadPopup(stored) {
  const elements = {
    url: { value: "" },
    save: { disabled: false, handlers: {}, addEventListener(type, fn) { this.handlers[type] = fn; } },
    status: { textContent: "" },
    "default-note": { hidden: true },
  };
  const storage = { ...stored };
  const chrome = {
    storage: {
      local: {
        get(defaults, cb) { cb({ ...defaults, ...storage }); },
        async set(patch) { Object.assign(storage, patch); },
      },
    },
    runtime: { async sendMessage() { return { ok: true }; } },
  };
  const sandbox = {
    document: { getElementById: (id) => elements[id] },
    chrome,
    URL,
  };
  vm.createContext(sandbox);
  vm.runInContext(POPUP_CODE, sandbox);
  return { elements, storage, clickSave: () => elements.save.handlers.click() };
}

test("fresh install (untouched production default): the warning note shows", () => {
  const { elements } = loadPopup({});
  assert.equal(elements.url.value, DEFAULT_URL);
  assert.equal(elements["default-note"].hidden, false);
});

test("a stale saved preview address is reset to the live site, with no note", () => {
  const { elements, storage } = loadPopup({
    careerChiefUrl: "https://careerchiefresumebuilder-abc-nolimitjonesincs-projects.vercel.app/",
    careerChiefUrlSet: true,
  });
  assert.equal(elements.url.value, DEFAULT_URL);
  assert.equal(storage.careerChiefUrl, DEFAULT_URL);
  assert.equal(elements["default-note"].hidden, true);
});

test("production URL explicitly saved before: no note (user chose it)", () => {
  const { elements } = loadPopup({ careerChiefUrl: DEFAULT_URL, careerChiefUrlSet: true });
  assert.equal(elements["default-note"].hidden, true);
});

test("Save click persists the URL AND marks it set, so the note never returns", async () => {
  const { elements, storage, clickSave } = loadPopup({});
  elements.url.value = "https://careerchiefresumebuilder-abc-nolimitjonesincs-projects.vercel.app/";
  await clickSave();
  assert.equal(storage.careerChiefUrlSet, true);
  assert.equal(
    storage.careerChiefUrl,
    "https://careerchiefresumebuilder-abc-nolimitjonesincs-projects.vercel.app/",
  );
  assert.equal(elements.status.textContent, "Saved — Career Chief opened in a new tab.");
  // Reopening the popup with the stored flag: note stays hidden.
  const reopened = loadPopup(storage);
  assert.equal(reopened.elements["default-note"].hidden, true);
});

test("an invalid URL is rejected in the popup, nothing saved", async () => {
  const { elements, storage, clickSave } = loadPopup({});
  elements.url.value = "not a url :::";
  await clickSave();
  assert.equal(storage.careerChiefUrlSet, undefined);
  assert.match(elements.status.textContent, /doesn't look valid/);
});
