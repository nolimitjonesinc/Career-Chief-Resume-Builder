// Questions that could only be asked of THIS person, built from their own
// material: a line of theirs with no scale, a claim they keep repeating, a hole
// or overlap in their dates. Deterministic and offline, so the interview is
// specific even with the AI switch off. Never guesses an answer: it quotes, asks.
import { numbersIn } from "../../shared/claims.mjs";

const ACTION = /\b(led|lead|built|created|launched|managed|directed|developed|designed|owned|ran|grew|improved|drove|delivered|implemented|established|oversaw|scaled|reduced|increased|negotiated|coached|mentored|shipped|ship|set up|selected|approved)\b/i;
const SCOPE = /\b(program|team|platform|launch|strategy|process|budget|pipeline|system|portfolio|product|campaign|partnership)s?\b/i;
const STOP = new Set("the and for with that this from have has had were was are our your their into over under about across through more most such also will would could should using used use per via within between among each other than then them they what when where which while who whom whose".split(" "));
const GENERIC = new Set("experience years year work role roles company business management responsibilities including various multiple strong team teams projects project".split(" "));

// Career sources only, and never our own saved answers (asking about those again
// would be circular) or slide decks (their text is slide-by-slide, not sentences).
const careerOnly = (sources, isCareer) => sources.filter((source) => isCareer(source) && source.id !== "career-bank" && source.format !== "pptx");

const sentencesOf = (text) => String(text || "").split(/(?<=[.!?])\s+|\n+/).map((line) => line.trim()).filter(Boolean);
const hash = (text) => { let h = 5381; for (const ch of text) h = ((h << 5) + h + ch.charCodeAt(0)) | 0; return Math.abs(h).toString(36); };
const clip = (text, n = 110) => (text.length > n ? `${text.slice(0, n).replace(/\s+\S*$/, "")}…` : text).replace(/[.]+$/, "");

export function unquantifiedLines(sources, isCareer, limit = 2) {
  const seen = new Set();
  const found = [];
  careerOnly(sources, isCareer).forEach((source, order) => {
    for (const line of sentencesOf(source.text)) {
      if (line.length < 35 || line.length > 260 || !ACTION.test(line) || numbersIn(line).size) continue;
      if (/@|linkedin|\d{3}[-.) ]\d{3}/i.test(line)) continue;
      const key = line.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      // Resume first, then the lines that name something with scope.
      found.push({ line, rank: (source.kind === "resume" ? 0 : 10) + (SCOPE.test(line) ? 0 : 5) + order * 0.1 });
    }
  });
  return found.sort((a, b) => a.rank - b.rank).slice(0, limit).map((item) => item.line);
}

// Two-word phrases repeated across the candidate's documents.
export function repeatedPhrases(sources, isCareer, limit = 1) {
  const counts = new Map();
  careerOnly(sources, isCareer).forEach((source) => {
    const words = String(source.text || "").toLowerCase().match(/[a-z][a-z-]{3,}/g) || [];
    for (let i = 0; i < words.length - 1; i += 1) {
      const [a, b] = [words[i], words[i + 1]];
      if ([a, b].some((w) => STOP.has(w) || GENERIC.has(w))) continue;
      const entry = counts.get(`${a} ${b}`) || { total: 0, docs: new Set() };
      entry.total += 1; entry.docs.add(source.id);
      counts.set(`${a} ${b}`, entry);
    }
  });
  return [...counts.entries()].filter(([, entry]) => entry.total >= 3 && entry.docs.size >= 2).sort((a, b) => b[1].total - a[1].total).slice(0, limit).map(([phrase, entry]) => ({ phrase, total: entry.total }));
}

const YEAR = "(?:19|20)\\d{2}";
const RANGE = new RegExp(`(${YEAR})\\s*(?:[–—-]|to)\\s*(${YEAR}|present|current|now)`, "i");

// Roles with a date range, from the resume only.
export function careerShape(resumeText, now = new Date().getFullYear()) {
  const roles = [];
  for (const line of sentencesOf(resumeText)) {
    const match = line.match(RANGE);
    if (!match) continue;
    const start = Number(match[1]);
    const end = /^\d/.test(match[2]) ? Number(match[2]) : now;
    if (end < start) continue;
    roles.push({ label: line.slice(0, match.index).replace(/[—–,\-\s]+$/, "").trim() || line.slice(0, 40), start, end });
  }
  roles.sort((a, b) => a.start - b.start || a.end - b.end);
  const gaps = [];
  const overlaps = [];
  let reach = null;
  roles.forEach((role, index) => {
    if (reach && role.start - reach.end >= 2) gaps.push({ from: reach.end, to: role.start });
    for (const earlier of roles.slice(0, index)) if (Math.min(earlier.end, role.end) - Math.max(earlier.start, role.start) >= 1) overlaps.push([earlier, role]);
    if (!reach || role.end > reach.end) reach = role;
  });
  const shortStints = roles.filter((role) => role.end - role.start <= 1).length;
  return { roles, gaps, overlaps, shortStints };
}

export function probeQuestions(sources, isCareer = defaultIsCareer, now) {
  const questions = [];
  for (const line of unquantifiedLines(sources, isCareer)) {
    questions.push({ id: `probe-scale-${hash(line)}`, probe: true, priority: "From your own words", topic: "How big was it?", prompt: `You wrote “${clip(line)}”. How big was that: people, budget, volume, time, or customers affected?`, why: "A line with no scale reads as a duty, not a result. Only you know the real size, and I won't guess one.", tip: "A rough range is fine. If you don't know a number, say what changed because of it." });
  }
  for (const item of repeatedPhrases(sources, isCareer)) {
    questions.push({ id: `probe-repeat-${hash(item.phrase)}`, probe: true, priority: "From your own words", topic: `“${item.phrase}”`, prompt: `“${item.phrase}” comes up ${item.total} times across your documents. What is it exactly, and what changed because of it?`, why: "Something you keep returning to is probably central, and may be undersold on the resume.", tip: "Name what it was, your part in it, and the result, even a qualitative one." });
  }
  const resume = sources.find((source) => source.kind === "resume")?.text || "";
  const shape = careerShape(resume, now);
  if (shape.gaps[0]) questions.push({ id: `probe-gap-${shape.gaps[0].from}-${shape.gaps[0].to}`, probe: true, priority: "From your own words", topic: "Dates on your resume", prompt: `Your resume shows nothing between ${shape.gaps[0].from} and ${shape.gaps[0].to}. What were you doing, and do you want the resume to say so?`, why: "Readers notice gaps. A short honest line usually costs less than the question it invites.", tip: "Caregiving, study, health, a venture, a layoff: all legitimate. Say only what you're comfortable putting on the page." });
  else if (shape.overlaps[0]) { const [a, b] = shape.overlaps[0]; questions.push({ id: `probe-overlap-${hash(a.label + b.label)}`, probe: true, priority: "From your own words", topic: "Overlapping roles", prompt: `“${clip(a.label, 50)}” and “${clip(b.label, 50)}” overlap in time. Were they at the same time, or is one a different arrangement, such as consulting, a board seat or part-time?`, why: "Overlapping dates look like a mistake unless the arrangement is stated.", tip: "Say what each one was and roughly how much of your time it took." }); }
  else if (shape.shortStints >= 3) questions.push({ id: "probe-short-stints", probe: true, priority: "From your own words", topic: "Short roles", prompt: "Several roles on your resume lasted a year or less. What was the pattern: contracts, restructurings, or something else?", why: "A pattern you explain reads as a choice. One you don't reads as a risk.", tip: "One sentence on the pattern is enough, and it may belong in the resume or only in the interview." });
  return questions.slice(0, 3);
}

// Same rule analyze.js uses; duplicated as a default only so this module can be
// tested on its own. analyze.js always passes its own.
function defaultIsCareer(source) { return source.focus && source.focus !== "auto" ? source.focus !== "target" : ["resume", "current", "goals", "other"].includes(source.kind); }
