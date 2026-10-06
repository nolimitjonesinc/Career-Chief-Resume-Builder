// Browser side of the private-preview gate. The code is remembered on this
// device so the owner and testers only type it once.
const KEY = "career-chief-access-code";
const LOST = "career-chief-access-lost";

export const savedCode = () => { try { return localStorage.getItem(KEY) || ""; } catch { return ""; } };
export const saveCode = (code) => { try { localStorage.setItem(KEY, code); } catch { /* private window: it just asks again next visit */ } };
export const forgetCode = () => { try { localStorage.removeItem(KEY); } catch { /* nothing to forget */ } };

// Every call to our own /api routes carries the code, so the call sites stay as
// they were. A refusal from the server brings the code screen back.
export function installAccessHeader() {
  if (window.__careerChiefAccess) return;
  window.__careerChiefAccess = true;
  const original = window.fetch.bind(window);
  window.fetch = async (input, init = {}) => {
    const url = typeof input === "string" ? input : input?.url || "";
    if (!url.startsWith("/api/") || url.startsWith("/api/access")) return original(input, init);
    const code = savedCode();
    const headers = new Headers(init.headers || {});
    if (code) headers.set("x-access-code", code);
    const response = await original(input, { ...init, headers });
    if (response.status === 401) { forgetCode(); window.dispatchEvent(new Event(LOST)); }
    return response;
  };
}

export const onAccessLost = (handler) => { window.addEventListener(LOST, handler); return () => window.removeEventListener(LOST, handler); };

// "open" means no code is needed, "locked" means the screen must show. If the
// server can't be reached the page opens anyway: the server still refuses any
// work that needs a code, so nothing is exposed by opening the screen.
export async function checkAccess() {
  try {
    const status = await fetch("/api/access").then((r) => r.json());
    if (!status.required) return "open";
    const code = savedCode();
    if (!code) return "locked";
    const response = await fetch("/api/access", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ code }) });
    if (response.ok) return "open";
    forgetCode();
    return "locked";
  } catch { return "open"; }
}

export async function tryCode(code) {
  const response = await fetch("/api/access", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ code }) });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || "That code didn't work.");
  saveCode(code.trim());
}
