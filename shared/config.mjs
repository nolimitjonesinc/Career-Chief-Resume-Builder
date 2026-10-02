// Every tunable number for the server side lives here so cost and safety can be
// retuned in one place. Each can be overridden with an environment variable.
// `process` is absent on some runtimes (Workers), so it is read defensively.
const fromEnv = (env, name, fallback) => {
  const raw = env?.[name];
  const value = Number(raw);
  return raw !== undefined && raw !== "" && Number.isFinite(value) && value >= 0 ? value : fallback;
};

export function aiLimits(env = {}) {
  return {
    // Units are a proxy for spend, not dollars: a plan (research with web search
    // plus the reasoning model) is 10, an answer check or rewrite is 1. The
    // ratio is an ESTIMATE; measure real cost on the first live run and retune.
    // Defaults: about 30 full plans a day for the whole site.
    dailyUnits: fromEnv(env, "AI_DAILY_UNIT_CAP", 300),
    // Per caller (hashed IP), per hour. Sized so one real session (a plan, a
    // dozen answer checks, a few rewrites) fits, but one person can't drain the day.
    perCallerPerHour: fromEnv(env, "AI_PER_CALLER_HOURLY", 30),
    // Largest body we will read back from the model provider.
    maxResponseBytes: fromEnv(env, "AI_MAX_RESPONSE_BYTES", 1_000_000),
  };
}

export const unitCost = { "/api/ai/plan": 10, "/api/ai/follow-up": 1, "/api/ai/revise": 1 };
