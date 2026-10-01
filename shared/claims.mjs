// Rule 2 ("the app never makes up numbers"), enforced rather than promised.
// A figure on the resume must appear somewhere in what the user supplied: their
// documents or their own answers. Used in the browser (evidence ledger, export
// check) and on the server (so an AI-written line can't smuggle in a number).
//
// A figure is a comparable token: plain values ("1200"), percentages ("40%"),
// multipliers ("3x") and currency ("$1200000") never match each other, so
// "$2000" is not supported by "2000 employees" and "40 percent" is not
// supported by "40 projects".
const ONES = { two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19, dozen: 12 };
const TENS = { twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90 };
const SCALE = { k: 1e3, thousand: 1e3, m: 1e6, million: 1e6, b: 1e9, billion: 1e9 };
const MONTH = "jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec";

const round = (n) => String(Math.round(n * 100) / 100);

// value + optional scale + optional unit -> a comparable token.
function normalize(digits, scale, unit, currency) {
  const value = Number(digits.replace(/,/g, ""));
  if (!Number.isFinite(value)) return null;
  const u = (unit || "").toLowerCase();
  if (u === "%" || u === "percent" || u === "per cent") return `${round(value * (SCALE[(scale || "").toLowerCase()] || 1))}%`;
  if (u === "x" || u === "×") return `${round(value)}x`;
  const money = currency || /^(dollars?|usd)$/.test(u);
  return `${money ? "$" : ""}${round(value * (SCALE[(scale || "").toLowerCase()] || 1))}`;
}

// A bare four-digit year is a date, not a performance claim, but only with date
// context: "since 2021", "March 2019", "2018–2021", "BA, 2015", or a year that
// ends a line. "Reached 2000 customers" is a figure.
function isDateYear(raw, source, index) {
  if (!/^(19|20)\d{2}$/.test(raw)) return false;
  const before = source.slice(Math.max(0, index - 14), index).toLowerCase();
  const after = source.slice(index + raw.length, index + raw.length + 12);
  return new RegExp(`(since|in|from|until|through|during|${MONTH})\\w*\\.?,?\\s*$`).test(before)
    || /(19|20)\d{2}\s*[–—-]\s*$/.test(before)
    || /^\s*[–—-]\s*((19|20)\d{2}|present|current|now)/i.test(after)
    || /^\s*($|\n|[.,;:)–—-])/.test(after);
}

// Spoken numbers become digits first, so "forty-two", "sixteen percent" and
// "six million dollars" go through the same unit-aware pass as "42", "16%" and
// "$6M". Returns the rewritten text plus any multiplier words (double, triple).
function despell(text) {
  const tens = Object.keys(TENS).join("|");
  const ones = Object.keys(ONES).filter((word) => ONES[word] < 10).join("|");
  const scales = "thousand|million|billion";
  const words = [...Object.keys(ONES), ...Object.keys(TENS), "hundred"].join("|");
  const extra = new Set();
  let out = text
    .replace(new RegExp(`\\b(${tens})[- ](${ones})\\b`, "gi"), (_, t, o) => ` ${TENS[t.toLowerCase()] + ONES[o.toLowerCase()]} `)
    .replace(new RegExp(`\\bone\\s+(${scales})\\b`, "gi"), (_, s) => ` 1 ${s} `)
    .replace(new RegExp(`\\b(${words})\\b`, "gi"), (_, w) => ` ${ONES[w.toLowerCase()] || TENS[w.toLowerCase()] || 100} `)
    .replace(new RegExp(`(?<![\\d.,][ ]{0,2})\\b(${scales})\\b`, "gi"), (_, s) => ` 1 ${s} `);
  if (/\bdouble[ds]?\b|\bdoubling\b/i.test(text)) extra.add("2x");
  if (/\btriple[ds]?\b|\btripling\b/i.test(text)) extra.add("3x");
  return { out: out.replace(/[ \t]{2,}/g, " "), extra };
}

export function numbersIn(text) {
  // Full-width digits and look-alikes become ordinary ones.
  const { out: source, extra } = despell(String(text || "").normalize("NFKC"));
  const found = new Set(extra);
  const numeric = /(?<![A-Za-z0-9])([$€£]?)(\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?)(?:(?:\s(thousand|million|billion)\b)|(?:(k|m|b)\b))?(?:\s?(%|×|x\b|percent\b|per cent\b|dollars?\b|usd\b))?/gi;
  for (const match of source.matchAll(numeric)) {
    const [, symbol, digits, wordScale, letterScale, unit] = match;
    if (!wordScale && !letterScale && !unit && !symbol && isDateYear(digits, source, match.index)) continue;
    const token = normalize(digits, wordScale || letterScale, unit, Boolean(symbol));
    if (token) found.add(token);
  }
  return found;
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
