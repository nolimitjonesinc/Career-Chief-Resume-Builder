// Rule 2 ("the app never makes up numbers"), enforced rather than promised.
// A figure on the resume must appear somewhere in what the user supplied: their
// documents or their own answers. Used in the browser (evidence ledger, export
// check) and on the server (so an AI-written line can't smuggle in a number).
const WORDS = { two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, fifteen: 15, twenty: 20, thirty: 30, forty: 40, fifty: 50, hundred: 100 };
const SCALE = { k: 1e3, thousand: 1e3, m: 1e6, million: 1e6, b: 1e9, billion: 1e9 };

// "$1.2M", "1,200,000", "40%", "3x", "six" -> comparable tokens: "1200000", "1200000", "40%", "3x", "6".
function normalize(raw) {
  const lower = raw.toLowerCase().replace(/[$,\s]/g, "");
  const match = lower.match(/^(\d+(?:\.\d+)?)(%|x|k|m|b|thousand|million|billion)?$/);
  if (!match) return null;
  if (match[2] === "%" || match[2] === "x") return `${Number(match[1])}${match[2]}`;
  return String(Math.round(Number(match[1]) * (SCALE[match[2]] || 1) * 100) / 100);
}

// A bare four-digit year is a fact about time, not a performance claim.
const isYear = (raw) => /^(19|20)\d{2}$/.test(raw);

export function numbersIn(text) {
  const out = new Set();
  const source = String(text || "");
  const numeric = /\$?\d[\d,]*(?:\.\d+)?\s?(?:%|x\b|k\b|m\b|b\b|thousand\b|million\b|billion\b)?/gi;
  for (const match of source.matchAll(numeric)) {
    const raw = match[0].trim();
    if (isYear(raw)) continue;
    const token = normalize(raw);
    if (token) out.add(token);
  }
  for (const match of source.toLowerCase().matchAll(/\b(two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|fifteen|twenty|thirty|forty|fifty|hundred)\b/g)) out.add(String(WORDS[match[1]]));
  return out;
}

// The set of figures present anywhere in `supports` (texts the user supplied).
export function knownNumbers(supports) {
  const known = new Set();
  for (const text of supports) for (const token of numbersIn(text)) known.add(token);
  return known;
}

// Figures in `line` missing from a precomputed known set.
export const unsupportedFrom = (line, known) => [...numbersIn(line)].filter((token) => !known.has(token));

// Figures in `line` that appear in none of `supports`.
export const unsupportedNumbers = (line, supports) => unsupportedFrom(line, knownNumbers(supports));
