// AI consent gates — Rule 8: consent is per session. It is deliberately
// never persisted to the saved draft, so a reload always starts with AI off
// and the user must opt in again. The workspace toggle and the intake
// checkbox both flip the same session-scoped aiConsent state.

// Full AI research plan (company research + hiring-case rebuild).
export const aiPlanAllowed = (aiEnabled, aiConsent) => Boolean(aiEnabled && aiConsent);

// Per-answer AI follow-up, AI tailor, and the Revise-with-AI button: only
// available when this session's analysis actually came from AI.
export const aiFollowUpAllowed = (researchMode, aiConsent) =>
  researchMode === "ai" && Boolean(aiConsent);
