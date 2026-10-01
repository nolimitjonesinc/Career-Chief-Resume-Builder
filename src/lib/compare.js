// One career record, several jobs: what to lead with for each, and why.
// Comparative, not generative: it reorders and explains the same evidence for
// each posting, and quotes the proof. It never writes a claim.
import { evaluateRequirements, isCareerSource } from "./analyze.js";

export const MAX_JOBS = 3;

export function compareJobs(sources, answerTexts, jobs) {
  const career = [...sources.filter(isCareerSource).map((source) => source.text), ...answerTexts].join(" ");
  const results = jobs.filter((job) => String(job.text || "").trim().length >= 20).slice(0, MAX_JOBS).map((job) => {
    const requirements = evaluateRequirements(job.text, career);
    const solid = requirements.filter((item) => item.strength === "solid");
    const thin = requirements.filter((item) => item.strength === "thin");
    const none = requirements.filter((item) => item.strength === "none");
    const leadWith = [...solid, ...thin].slice(0, 2);
    const weight = requirements.length ? (solid.length * 2 + thin.length) / (requirements.length * 2) : 0;
    return { id: job.id, title: job.title || "Untitled role", requirements, solid, thin, gaps: none, leadWith, weight };
  });
  const leads = results.map((result) => new Set(result.leadWith.map((item) => item.key)));
  results.forEach((result, index) => {
    result.distinct = result.leadWith.filter((item) => leads.every((set, other) => other === index || !set.has(item.key)));
  });
  const ranked = results.filter((result) => result.requirements.length).sort((a, b) => b.weight - a.weight);
  const everyKey = results.length > 1 ? results.map((result) => new Set(result.solid.concat(result.thin).map((item) => item.key))) : [];
  const shared = everyKey.length ? [...everyKey[0]].filter((key) => everyKey.every((set) => set.has(key))) : [];
  return { jobs: results, bestId: ranked.length > 1 && ranked[0].weight > ranked[1].weight ? ranked[0].id : null, sharedLabels: shared.map((key) => results[0].requirements.find((item) => item.key === key)?.label).filter(Boolean) };
}
