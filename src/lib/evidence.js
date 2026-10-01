// The evidence ledger: for every line on the resume, where did it come from?
//
// Informational only. It never blocks, hides or rewrites anything: the resume is
// the user's (Rule 1). It exists so the user can see, before submitting, which
// lines trace to their own words, which were written by Career Chief, and which
// carry a figure nobody supplied (Rule 2).
import { unsupportedNumbers } from "../../shared/claims.mjs";

const STOP = new Set("the and for with that this from have has had were was are our your their into over under about across through more most also will would could should using used per via within between each other than then them they what when where which while who".split(" "));
const tokens = (text) => new Set((String(text).toLowerCase().match(/[a-z0-9][a-z0-9'-]{2,}/g) || []).filter((word) => !STOP.has(word)));
const sentencesOf = (text) => String(text || "").split(/(?<=[.!?])\s+|\n+/).map((line) => line.trim()).filter((line) => line.length > 3);

// How much of `line` is contained in `candidate` (0..1).
function containment(line, candidate) {
  const wanted = tokens(line);
  if (!wanted.size) return 0;
  const have = tokens(candidate);
  let shared = 0;
  for (const word of wanted) if (have.has(word)) shared += 1;
  return shared / wanted.size;
}

export const ledgerFields = [["summary", "Summary"], ["current", "Experience"], ["tailored", "Highlight for this role"], ["earlier", "Earlier experience"], ["education", "Education"], ["skills", "Capabilities"]];

export const statusInfo = {
  answer: { label: "Your answer", tone: "ok", note: "Written from something you told me and approved." },
  document: { label: "Your documents", tone: "ok", note: "Found in material you supplied." },
  template: { label: "Written by Career Chief", tone: "note", note: "Generic wording from your title. Replace it with your own, or leave it." },
  unsourced: { label: "Not traced", tone: "note", note: "Not found in your documents or answers. Fine if it's true; it's your resume." },
  placeholder: { label: "Placeholder", tone: "check", note: "Still a prompt to fill in." },
};

export function traceLine(line, { answers = [], sources = [], baseline = null, field = "" } = {}) {
  const supports = [...answers.map((item) => item.text), ...sources.map((item) => item.text)];
  const figures = unsupportedNumbers(line, supports);
  const done = (status, support = null) => ({ status, ...statusInfo[status], support, unsupportedNumbers: figures, tone: figures.length ? "check" : statusInfo[status].tone });

  if (/^add (your|earlier|an accomplishment)/i.test(line) || /^(contact details|professional title|education|your name)$/i.test(line)) return done("placeholder");
  const answer = answers.find((item) => item.resumeLine && (line.includes(item.resumeLine.trim()) || containment(item.resumeLine, line) >= 0.8));
  if (answer) return done("answer", { name: `Your answer: ${answer.topic}`, excerpt: answer.text.slice(0, 200) });
  if (baseline && ["summary", "skills"].includes(field) && baseline[field] === line) return done("template");

  let best = null;
  for (const source of sources) {
    for (const sentence of sentencesOf(source.text)) {
      const score = containment(line, sentence);
      if (score >= 0.7 && (!best || score > best.score)) best = { score, source, sentence };
    }
  }
  if (best) return done("document", { name: best.source.name, excerpt: best.sentence.slice(0, 200) });
  return done("unsourced");
}

export function buildLedger(doc, context) {
  const items = [];
  for (const [field, label] of ledgerFields) {
    String(doc?.[field] || "").split("\n").map((line) => line.trim()).filter(Boolean).forEach((line, index) => {
      items.push({ id: `${field}-${index}`, field, section: label, line, ...traceLine(line, { ...context, field }) });
    });
  }
  const count = (status) => items.filter((item) => item.status === status).length;
  return {
    items,
    counts: { answer: count("answer"), document: count("document"), template: count("template"), unsourced: count("unsourced"), placeholder: count("placeholder"), figures: items.filter((item) => item.unsupportedNumbers.length).length },
    attention: items.filter((item) => item.tone === "check"),
  };
}
