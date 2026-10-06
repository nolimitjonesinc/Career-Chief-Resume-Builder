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
import { GuardError, clientIp, createMemoryStore } from "./ai-guard.mjs";

export const ACCESS_HEADER = "x-access-code";
const MAX_WRONG_PER_HOUR = 10;
// Wrong guesses are counted per caller per hour, in env.AI_LIMIT_STORE when one is
// bound. The in-memory fallback counts per server instance, so on serverless it
// slows a guesser rather than stopping one; bind a shared store before relying on it.
const fallbackStore = createMemoryStore();
const storeOf = (env) => env.AI_LIMIT_STORE || fallbackStore;

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

const callerKey = (request, env) => `access:wrong:${clientIp(request, env)}:${Math.floor(Date.now() / 3_600_000)}`;

const lockedOut = async (request, env) => (Number(await storeOf(env).get(callerKey(request, env))) || 0) >= MAX_WRONG_PER_HOUR;
const noteWrong = async (request, env) => {
  const key = callerKey(request, env);
  await storeOf(env).put(key, (Number(await storeOf(env).get(key)) || 0) + 1, 3700);
};
const tooMany = () => new GuardError("Too many tries. Please wait a while and try again.", 429, 3600);

// Every door (the code screen, the AI routes, the link reader) shares the one
// counter, so switching doors does not hand a guesser fresh tries.
export async function assertAccess(request, env = {}) {
  if (!accessRequired(env)) return;
  if (await lockedOut(request, env)) throw tooMany();
  const given = request.headers.get(ACCESS_HEADER);
  if (await matches(given, env)) return;
  if (given) await noteWrong(request, env);
  throw new GuardError("This is a private preview. Enter the access code to continue.", 401);
}

// GET  /api/access        -> { required }
// POST /api/access {code} -> { ok: true } or 401
export async function handleAccess(request, env = {}) {
  if (request.method === "GET") return Response.json({ required: accessRequired(env) });
  if (request.method !== "POST") return Response.json({ error: "Method not allowed." }, { status: 405 });
  if (!accessRequired(env)) return Response.json({ ok: true });
  if (await lockedOut(request, env)) return guardReply(tooMany());
  let code = "";
  try { code = String((await request.json())?.code || "").slice(0, 200); } catch { /* an empty body just fails the check */ }
  if (await matches(code, env)) return Response.json({ ok: true });
  await noteWrong(request, env);
  return Response.json({ error: "That code isn't right. Check with whoever invited you." }, { status: 401 });
}

// One place that turns a refusal into a response, shared by every route.
export const guardReply = (error) => Response.json({ error: error.message }, { status: error.status, headers: error.retryAfter ? { "retry-after": String(error.retryAfter) } : {} });
