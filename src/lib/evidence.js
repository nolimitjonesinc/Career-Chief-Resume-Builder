// The evidence ledger: for every line on the resume, where did it come from?
//
// Informational only. It never blocks, hides or rewrites anything: the resume is
// the user's (Rule 1). It exists so the user can see, before submitting, which
// lines trace to their own words, which were written by Career Chief, and which
// carry a figure nobody supplied (Rule 2).
import { knownNumbers, unsupportedFrom } from "../../shared/claims.mjs";

const STOP = new Set("the and for with that this from have has had were was are our your their into over under about across through more most also will would could should using used per via within between each other than then them they what when where which while who".split(" "));
const tokens = (text) => new Set((String(text).toLowerCase().match(/[a-z0-9][a-z0-9'-]{2,}/g) || []).filter((word) => !STOP.has(word)));
// Things a resume line could have been copied from: a whole line of a document,
// a sentence, or up to three consecutive sentences. Resume lines often join
// several sentences, so single sentences alone miss real matches.
function candidatesOf(text) {
  const out = [];
  for (const line of String(text || "").split("\n").map((item) => item.trim()).filter((item) => item.length > 3)) {
    const sentences = line.split(/(?<=[.!?])\s+/).map((item) => item.trim()).filter(Boolean);
    out.push(line);
    for (let i = 0; i < sentences.length; i += 1) for (let n = 1; n <= 3 && i + n <= sentences.length; n += 1) out.push(sentences.slice(i, i + n).join(" "));
  }
  return [...new Set(out)];
}

// Tokenize every source once per ledger instead of once per resume line.
const prepare = (sources) => sources.map((source) => ({ source, candidates: candidatesOf(source.text).map((text) => ({ text, tokens: tokens(text) })) }));

// How much of `line` is contained in a candidate's token set (0..1).
function containment(wanted, have) {
  if (!wanted.size) return 0;
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

export function traceLine(line, { answers = [], sources = [], baseline = null, field = "", prepared = prepare(sources), known = knownNumbers([...answers.map((item) => item.text), ...sources.map((item) => item.text)]) } = {}) {
  const figures = unsupportedFrom(line, known);
  const done = (status, support = null) => ({ status, ...statusInfo[status], support, unsupportedNumbers: figures, tone: figures.length ? "check" : statusInfo[status].tone });
  const lineTokens = tokens(line);

  if (/^add (your|earlier|an accomplishment)/i.test(line) || /^(contact details|professional title|education|your name)$/i.test(line)) return done("placeholder");
  const answer = answers.find((item) => item.resumeLine && (line.includes(item.resumeLine.trim()) || containment(tokens(item.resumeLine), lineTokens) >= 0.8));
  if (answer) return done("answer", { name: `Your answer: ${answer.topic}`, excerpt: answer.text.slice(0, 200) });
  if (baseline && ["summary", "skills"].includes(field) && baseline[field] === line) return done("template");

  // Best match wins; among equals, the tightest excerpt.
  let best = null;
  for (const { source, candidates } of prepared) {
    for (const candidate of candidates) {
      const score = containment(lineTokens, candidate.tokens);
      if (score >= 0.7 && (!best || score > best.score || (score === best.score && candidate.text.length < best.text.length))) best = { score, source, text: candidate.text };
    }
  }
  if (best) return done("document", { name: best.source.name, excerpt: best.text.slice(0, 200) });
  return done("unsourced");
}

export function buildLedger(doc, context) {
  const prepared = prepare(context.sources || []);
  const known = knownNumbers([...(context.answers || []).map((item) => item.text), ...(context.sources || []).map((item) => item.text)]);
  const items = [];
  for (const [field, label] of ledgerFields) {
    String(doc?.[field] || "").split("\n").map((line) => line.trim()).filter(Boolean).forEach((line, index) => {
      items.push({ id: `${field}-${index}`, field, section: label, line, ...traceLine(line, { ...context, field, prepared, known }) });
    });
  }
  const count = (status) => items.filter((item) => item.status === status).length;
  return {
    items,
    counts: { answer: count("answer"), document: count("document"), template: count("template"), unsourced: count("unsourced"), placeholder: count("placeholder"), figures: items.filter((item) => item.unsupportedNumbers.length).length },
    attention: items.filter((item) => item.tone === "check"),
  };
}
