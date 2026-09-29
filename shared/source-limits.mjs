// How much of each source the AI sees. Shared by the browser (which trims before
// sending, so one long deck can't push the whole request over the size cap) and
// the server (which trims again rather than trusting the browser).
export function aiTextLimit(source) {
  if (source.kind === "resume" || source.kind === "job") return 13_000;
  if (source.format === "pptx" || (source.focus && source.focus !== "auto")) return 10_000;
  return 5_000;
}

export const trimForAi = (source) => ({ ...source, text: String(source.text || "").slice(0, aiTextLimit(source)) });
