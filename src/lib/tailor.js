// Tailoring without AI: reorder what the person already wrote so the lines that
// speak to this job come first. Nothing is added, dropped or reworded (Rule 2),
// and the result is only a proposal until the user approves it (Rule 3).

const STOP = new Set("about above after also and any are been being but can could for from have has had into its more most not our out over per that the their them then there these they this those through use used using was were what when where which while who will with within without you your able across ability work works working team teams role roles year years strong experience experienced including include etc".split(" "));

const words = (text) => (String(text || "").toLowerCase().match(/[a-z][a-z+#.&-]{2,}/g) || []).map((word) => word.replace(/[.&-]+$/, "")).filter((word) => word.length > 3 && !STOP.has(word));
const stem = (word) => word.replace(/(ing|ed|es|s)$/, "");

// The job's vocabulary, weighted by how often the posting repeats it.
export function jobVocabulary(jobText) {
  const counts = new Map();
  for (const word of words(jobText)) counts.set(stem(word), (counts.get(stem(word)) || 0) + 1);
  return counts;
}

const score = (line, vocabulary) => {
  let total = 0;
  for (const word of new Set(words(line).map(stem))) total += vocabulary.get(word) || 0;
  return total;
};

// Stable sort, highest score first; ties keep the person's own order.
const byRelevance = (lines, vocabulary) => lines.map((line, index) => ({ line, index, value: score(line, vocabulary) })).sort((a, b) => b.value - a.value || a.index - b.index);

// A role's one-line header for display and for the AI tailor request.
export function roleHeader(role) {
  const head = [role.title, role.company].filter(Boolean).join(", ");
  return [head, role.dates].filter(Boolean).join(" — ");
}

// "Current role" for the tailor request: the newest role's header + bullets.
export function splitRole(role) {
  if (!role) return { header: "", bullets: [] };
  return { header: roleHeader(role), bullets: [...(role.bullets || [])] };
}

const splitSkills = (skills) => (Array.isArray(skills) ? skills : String(skills || "").split(/\s*[,·|;•]\s*/)).map((item) => item.trim()).filter(Boolean);

export function tailorByRules(doc, jobText) {
  const vocabulary = jobVocabulary(jobText);
  let moved = 0;
  const roles = (doc.roles || []).map((role) => {
    const ordered = byRelevance(role.bullets || [], vocabulary);
    moved += ordered.filter((item, position) => item.index !== position).length;
    return { ...role, bullets: ordered.map((item) => item.line) };
  });
  const skillList = splitSkills(doc.skills);
  const skillOrder = byRelevance(skillList, vocabulary);
  const skills = skillOrder.map((item) => item.line);
  const skillsMoved = skillOrder.filter((item, position) => item.index !== position).length;
  const why = [];
  if (moved) why.push(`Moved ${moved} line${moved === 1 ? "" : "s"} up because the job post talks about them most.`);
  if (skillsMoved) why.push("Put the skills the job post mentions first.");
  return { summary: null, roles, skills, why, changed: Boolean(moved || skillsMoved) };
}
