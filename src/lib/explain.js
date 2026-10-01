// "Why this wording?" for a proposed resume line, answered from the line itself.
// Deterministic: it describes what actually differs between the answer and the
// proposal, so it can't be wrong about what the app did. Works with AI off.
import { unsupportedNumbers } from "../../shared/claims.mjs";
import { themes } from "./analyze.js";

const words = (text) => new Set((String(text).toLowerCase().match(/[a-z][a-z'-]{3,}/g) || []));

export function explainProposal({ answer = "", proposal = "", requirements = [], supports = [] }) {
  const points = [];
  const a = words(answer);
  const kept = [...words(proposal)].filter((word) => a.has(word)).length;
  const total = words(proposal).size || 1;
  points.push(`${Math.round((kept / total) * 100)}% of the words come from your answer.`);

  const first = answer.trim().split(/\s+/)[0]?.toLowerCase();
  if (["i", "my", "we", "our"].includes(first) && !/^(i|my|we|our)\b/i.test(proposal.trim())) points.push("Dropped the first person and led with the action, the way resume lines read.");
  if (answer.trim().replace(/\s+/g, " ") === proposal.trim().replace(/\s+/g, " ")) points.push("Left your wording as it was.");

  const wanted = requirements.map((item) => themes.find((theme) => theme.key === item.key)).filter(Boolean);
  const hit = wanted.filter((theme) => theme.support.test(proposal.toLowerCase())).map((theme) => theme.label);
  if (hit.length) points.push(`Speaks to what the role asks for: ${hit.slice(0, 3).join(", ")}.`);

  const figures = unsupportedNumbers(proposal, supports.length ? supports : [answer]);
  points.push(figures.length ? `Contains figures not found in your answer or documents: ${figures.join(", ")}. Confirm or remove them.` : "Every figure in it comes from you. Nothing was added.");
  return { points, figures };
}
