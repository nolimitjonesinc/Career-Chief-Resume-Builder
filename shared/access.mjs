// The front door for friends, family and beta testers.
//
// ACCESS_CODE holds one code, or several separated by commas (so the owner can
// keep a personal code and hand out a guest code that can be swapped later).
// When it is not set, the site is open, which is what local dev and the tests
// expect. When it is set, every route that does work (the AI and the link
// reader) refuses callers who do not send a matching code, and the website
// shows a code screen first.
//
// The screen is a courtesy. The server check is the real lock: it is what stops
// a stranger from spending AI credits.
import { GuardError, createMemoryStore } from "./ai-guard.mjs";

export const ACCESS_HEADER = "x-access-code";
const MAX_WRONG_PER_HOUR = 10;
const attempts = createMemoryStore();

export const accessCodes = (env = {}) => String(env.ACCESS_CODE || "").split(",").map((code) => code.trim()).filter(Boolean);
export const accessRequired = (env = {}) => accessCodes(env).length > 0;

const digest = async (text) => new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)));

// Compare fixed-length hashes so timing reveals nothing about the real code.
async function matches(given, env) {
  const probe = await digest(String(given || "").trim());
  let ok = false;
  for (const code of accessCodes(env)) {
    const real = await digest(code);
    let diff = 0;
    for (let i = 0; i < real.length; i += 1) diff |= real[i] ^ probe[i];
    if (diff === 0) ok = true;
  }
  return ok;
}

const callerKey = (request) => {
  const raw = request.headers.get("cf-connecting-ip") || request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  return `access:wrong:${raw}:${Math.floor(Date.now() / 3_600_000)}`;
};

export async function assertAccess(request, env = {}) {
  if (!accessRequired(env)) return;
  if (await matches(request.headers.get(ACCESS_HEADER), env)) return;
  throw new GuardError("This is a private preview. Enter the access code to continue.", 401);
}

// GET  /api/access        -> { required }
// POST /api/access {code} -> { ok: true } or 401
export async function handleAccess(request, env = {}) {
  if (request.method === "GET") return Response.json({ required: accessRequired(env) });
  if (request.method !== "POST") return Response.json({ error: "Method not allowed." }, { status: 405 });
  if (!accessRequired(env)) return Response.json({ ok: true });
  const key = callerKey(request);
  const wrong = Number(await attempts.get(key)) || 0;
  if (wrong >= MAX_WRONG_PER_HOUR) return Response.json({ error: "Too many tries. Please wait a while and try again." }, { status: 429, headers: { "retry-after": "3600" } });
  let code = "";
  try { code = String((await request.json())?.code || "").slice(0, 200); } catch { /* an empty body just fails the check */ }
  if (await matches(code, env)) return Response.json({ ok: true });
  await attempts.put(key, wrong + 1, 3700);
  return Response.json({ error: "That code isn't right. Check with whoever invited you." }, { status: 401 });
}

// One place that turns a refusal into a response, shared by every route.
export const guardReply = (error) => Response.json({ error: error.message }, { status: error.status, headers: error.retryAfter ? { "retry-after": String(error.retryAfter) } : {} });
