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
    // One "unit" is one plan or one answer check. A plan is several model calls
    // (research + reasoning), so a unit is deliberately conservative.
    dailyUnits: fromEnv(env, "AI_DAILY_UNIT_CAP", 40),
    // Per caller (hashed IP), per hour. Stops one person draining the day's cap.
    perCallerPerHour: fromEnv(env, "AI_PER_CALLER_HOURLY", 6),
    // Largest body we will read back from the model provider.
    maxResponseBytes: fromEnv(env, "AI_MAX_RESPONSE_BYTES", 1_000_000),
  };
}

export const unitCost = { "/api/ai/plan": 3, "/api/ai/follow-up": 1, "/api/ai/revise": 1 };
