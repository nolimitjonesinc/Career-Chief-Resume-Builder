// Who may call the AI routes, and how much they may spend.
//
// Three layers, cheapest first:
//   1. The master switch (AI_ENABLED=true AND a key). One place, every runtime.
//   2. Same-origin check. A browser on our own site sends a matching Origin; a
//      script on another site or a curl loop does not. This is a speed bump, not
//      authentication: a determined caller can forge headers. It exists to stop
//      casual abuse and drive-by embedding, not to replace accounts.
//   3. A per-caller hourly limit and a global daily budget, kept in a store.
//
// The store is an interface ({ get(key), put(key, value, ttlSeconds) }) so Workers
// KV or a Durable Object can replace the in-memory default without touching the
// callers. The in-memory default is per-instance: on serverless runtimes each
// instance counts separately, so treat it as a soft cap until a shared store is
// bound as env.AI_LIMIT_STORE.
import { aiLimits, unitCost } from "./config.mjs";
import { readTextLimited } from "./limited-read.mjs";

export class GuardError extends Error {
  constructor(message, status, retryAfter) {
    super(message);
    this.status = status;
    this.retryAfter = retryAfter;
  }
}

export function createMemoryStore() {
  const rows = new Map();
  return {
    async get(key) {
      const row = rows.get(key);
      if (!row) return null;
      if (row.expires <= Date.now()) { rows.delete(key); return null; }
      return row.value;
    },
    async put(key, value, ttlSeconds = 3600) {
      rows.set(key, { value, expires: Date.now() + ttlSeconds * 1000 });
      // Keep memory bounded: drop expired rows opportunistically.
      if (rows.size > 5000) for (const [k, r] of rows) if (r.expires <= Date.now()) rows.delete(k);
    },
  };
}

const defaultStore = createMemoryStore();

export const aiSwitchOn = (env = {}) => env.AI_ENABLED === "true" && Boolean(env.OPENAI_API_KEY || env.ANTHROPIC_API_KEY);

const hostOf = (value) => { try { return new URL(value).host.toLowerCase(); } catch { return ""; } };

export function assertAllowedOrigin(request, env = {}) {
  const origin = request.headers.get("origin");
  if (!origin) throw new GuardError("This request did not come from the Career Chief website.", 403);
  const allowed = String(env.AI_ALLOWED_ORIGINS || "").split(",").map((item) => hostOf(item.trim())).filter(Boolean);
  const own = (request.headers.get("host") || new URL(request.url).host).toLowerCase();
  const from = hostOf(origin);
  if (from && (from === own || allowed.includes(from))) return;
  throw new GuardError("This request did not come from the Career Chief website.", 403);
}

async function callerId(request) {
  const raw = request.headers.get("cf-connecting-ip") || request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const bytes = new TextEncoder().encode(raw);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  // Hashed so the limit store never holds a raw address.
  return [...new Uint8Array(digest).slice(0, 8)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

// Spend `cost` units for this caller, or throw. Read-then-write is not atomic
// across instances; the daily cap is therefore a ceiling with some slack, which
// is the right failure direction for a spend limit.
export async function spendOrThrow(request, env = {}, cost = 1, now = Date.now()) {
  const limits = aiLimits(env);
  const store = env.AI_LIMIT_STORE || defaultStore;
  const day = new Date(now).toISOString().slice(0, 10);
  const hour = Math.floor(now / 3_600_000);
  const dayKey = `ai:day:${day}`;
  const callerKey = `ai:caller:${await callerId(request)}:${hour}`;
  const [dayUsed, callerUsed] = await Promise.all([store.get(dayKey), store.get(callerKey)]).then((rows) => rows.map((row) => Number(row) || 0));
  if (dayUsed + cost > limits.dailyUnits) throw new GuardError("AI research has reached today's limit. The transparent analysis still works; try AI again tomorrow.", 429, 3600);
  if (callerUsed + cost > limits.perCallerPerHour) throw new GuardError("You've used AI research several times this hour. Your working draft is safe; try again a little later.", 429, 3600);
  await Promise.all([store.put(dayKey, dayUsed + cost, 90_000), store.put(callerKey, callerUsed + cost, 3_700)]);
}

export const costOf = (pathname) => unitCost[pathname] ?? 1;

// Read a provider response without trusting its size.
export async function readJsonLimited(response, maxBytes) {
  try { return JSON.parse(await readTextLimited(response, maxBytes, "throw")); }
  catch (error) {
    if (error.message === "TOO_LARGE") throw new Error("AI research returned more data than expected. Your working draft is still available.");
    throw error;
  }
}

// The handful of settings the AI routes read, picked from any environment object
// so each runtime adapter stays one line.
export function aiEnvFrom(source = {}) {
  const names = ["OPENAI_API_KEY", "AI_ENABLED", "AI_DAILY_UNIT_CAP", "AI_PER_CALLER_HOURLY", "AI_MAX_RESPONSE_BYTES", "AI_ALLOWED_ORIGINS", "OPENAI_BASE_URL", "ANTHROPIC_API_KEY", "ANTHROPIC_BASE_URL", "CAREER_AI_PROVIDER", "ACCESS_CODE"];
  return Object.fromEntries(names.filter((name) => source[name] !== undefined).map((name) => [name, source[name]]));
}
