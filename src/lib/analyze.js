import { probeQuestions } from "./probes.js";

export const sourceLabels = {
  resume: "Resume",
  job: "Job description",
  application: "Application questions",
  company: "Company research",
  leadership: "CEO / leadership",
  current: "Current role",
  goals: "Career goals",
  other: "Other context",
};

// What a source should inform, separate from what it is. A deck about a launch is
// "Current role" material by kind but might be meant for the cover letter.
export const focusLabels = {
  auto: "Let Career Chief decide",
  current: "My current role",
  past: "Past roles and accomplishments",
  target: "The role I want",
  cover: "My future cover letter",
};

const hasFocus = (source) => source.focus && source.focus !== "auto";
export const isCareerSource = (source) => hasFocus(source) ? source.focus !== "target" : ["resume", "current", "goals", "other"].includes(source.kind);
export const isRoleSource = (source) => hasFocus(source) ? source.focus === "target" : ["job", "application"].includes(source.kind);
const isCurrentRoleSource = (source) => hasFocus(source) ? source.focus === "current" : source.kind === "current";
const isResearchSource = (source) => hasFocus(source) ? source.focus === "target" : !["resume", "current", "goals"].includes(source.kind);

const sampleResume = `Jordan Avery\nBrand Marketing Leader\nSan Francisco, CA · jordan@example.com\nRivermark Health — Senior Brand Marketing Manager, 2021–present\nLed brand positioning and customer education. Managed agency and content partnerships. Led six direct reports across brand and content.\nLume Collective — Brand Marketing Manager, 2018–2021\nDeveloped brand strategy for consumer clients. Directed customer storytelling.\nBA Communications, 2015`;

export const sampleSources = [
  { id: "sample-resume", kind: "resume", name: "Jordan Avery — resume.pdf", origin: "PDF · 2 pages", text: sampleResume, status: "ready" },
  { id: "sample-job", kind: "job", name: "Senior Director, Content & Community", origin: "Job posting", text: "Report to the CMO. Build a repeatable creator program, lead editorial and social teams, protect audience trust, and connect content to customer acquisition. Application questions ask what creator program the candidate built, which content teams they led, and how they measure performance.", status: "ready" },
  { id: "sample-company", kind: "company", name: "Nestwell company direction", origin: "Fictional public webpage", text: "Nestwell is expanding from a single service into a broader family-services platform. The business is investing in connected offers, customer education, and durable audience trust. Revenue, profitability, and IPO plans are not publicly verified in this example.", status: "ready" },
  { id: "sample-ceo", kind: "leadership", name: "CEO Morgan Ellis — direction", origin: "Fictional leadership interview", text: "Morgan Ellis describes the next chapter as bringing several family services together under one trusted brand while preserving usefulness and credibility.", status: "ready" },
  { id: "sample-cmo", kind: "leadership", name: "CMO Alex Chen — priorities", origin: "Fictional interview", text: "Alex Chen emphasizes repeatable content production systems, clear team ownership, and evidence that content contributes to customer growth.", status: "ready" },
  { id: "sample-current", kind: "current", name: "Current responsibilities", origin: "User-supplied note", text: "Jordan created a customer and expert content program, set up participant sourcing with Sales and Operations, selected the production partner, approved stories and final edits, and coaches a six-person team on sensitive customer storytelling.", status: "ready" },
  { id: "sample-application", kind: "application", name: "Application questions", origin: "Application form", text: "What creator program have you built? Which content teams have you directly led? How do you measure content performance?", status: "ready" },
];

// Each theme says how to spot it in a job post (job) and in the candidate's own
// material (support). The first nine came with the marketing sample and match by
// their key; the rest make the rule-based analyzer useful beyond marketing roles.
const keyed = (key, label, support) => ({ key, label, job: new RegExp(key), support });
export const themes = [
  keyed("creator", "Creator / contributor program", /creator|contributor|expert content program|participant sourcing/),
  keyed("community", "Community building", /community|audience program/),
  keyed("editorial", "Editorial leadership", /editorial|content team|content program/),
  keyed("social", "Social leadership", /social/),
  keyed("acquisition", "Customer acquisition", /acquisition|customer adoption|prospective customer/),
  keyed("growth", "Measurable growth", /growth|increase|improved|expanded/),
  keyed("trust", "Audience trust", /trust|sensitive customer|credibility/),
  keyed("team", "Team leadership", /team|direct reports|people manager|managed (?:[a-z]+ ){0,4}staff/),
  keyed("strategy", "Brand strategy", /strategy|positioning/),
  { key: "analytics", label: "Analytics & measurement", job: /analytic|data[- ]driven|metrics|\bkpis?\b|measure|dashboard|a\/b test|insights/, support: /analytic|metric|kpi|measur|dashboard|\bdata\b|a\/b|insight/ },
  { key: "product", label: "Product & roadmap", job: /product (strategy|management|roadmap|manager)|roadmap|product-led|go-to-market|\bgtm\b/, support: /product|roadmap|launch|go-to-market|\bgtm\b|feature/ },
  { key: "engineering", label: "Engineering & systems", job: /software|engineer|backend|frontend|full[- ]stack|\bapi\b|infrastructure|cloud|devops|architecture/, support: /software|engineer|\bcode\b|develop|deploy|\bapi\b|infrastructure|cloud|architect|system/ },
  { key: "sales", label: "Revenue & sales", job: /\bsales\b|revenue|quota|pipeline|business development|account (executive|management)/, support: /sales|revenue|quota|pipeline|closed|bookings|\barr\b/ },
  { key: "operations", label: "Operations & process", job: /operations|process improvement|supply chain|logistics|efficiency|workflow/, support: /operation|process|supply|logistic|efficien|workflow|streamlin/ },
  { key: "projects", label: "Project delivery", job: /project management|program management|implementation|deliver(y|ing)|\bpmo\b/, support: /project|program|implement|deliver|rollout|launched/ },
  { key: "stakeholders", label: "Stakeholder leadership", job: /stakeholder|executive|c-suite|cross[- ]functional/, support: /stakeholder|executive|c-suite|cross[- ]functional|sponsor|board/ },
  { key: "customer", label: "Customer outcomes", job: /customer success|customer experience|client (relationship|service)|retention|churn|onboarding/, support: /customer|client|retention|churn|onboard|satisf/ },
  { key: "finance", label: "Budget & finance", job: /budget|p&l|forecast|financial|finance|cost reduction/, support: /budget|p&l|forecast|financ|\bcost|margin/ },
  { key: "compliance", label: "Compliance & risk", job: /compliance|regulat|risk management|audit|governance|security|privacy/, support: /compliance|regulat|risk|audit|governance|security|privacy|hipaa|gdpr|\bsox\b/ },
  { key: "hiring", label: "Hiring & coaching", job: /hiring|recruit|talent|mentor|coach|performance management/, support: /hir(e|ed|ing)|recruit|talent|mentor|coach/ },
  { key: "design", label: "Design & experience", job: /\bdesign|\bux\b|user experience|figma|prototype/, support: /design|\bux\b|user experience|figma|prototype|usab/ },
  { key: "ai", label: "AI & automation", job: /\bai\b|machine learning|\bllm|generative|automation/, support: /\bai\b|machine learning|\bllm|generative|automat/ },
];

// The sentence that best shows a theme: a real sentence beats a bare title, and
// among those the one that matches most.
const clipAtWord = (text, n) => (text.length <= n ? text : `${text.slice(0, n).replace(/\s+\S*$/, "")}…`);
const sentenceAround = (text, pattern) => {
  const global = new RegExp(pattern.source, "g");
  const matching = String(text).split(/(?<=[.!?])\s+|\n+/).map((line) => line.trim()).filter((line) => line && pattern.test(line.toLowerCase()));
  const best = matching.map((line) => ({ line, score: (line.toLowerCase().match(global) || []).length + (line.length >= 30 ? 10 : 0) })).sort((x, y) => y.score - x.score)[0];
  return best ? clipAtWord(best.line, 180) : "";
};

// Which role priorities does this material support, how strongly, and where is
// the proof? Pure so the same logic serves the hiring case, the live coverage
// view after each answer, and the side-by-side job comparison.
export function evaluateRequirements(jobText, careerText) {
  const job = String(jobText || "").toLowerCase();
  // Capped so a pathological paste can't stall the page on every keystroke.
  const career = String(careerText || "").slice(0, 300_000).toLowerCase();
  return themes.filter((theme) => theme.job.test(job)).map((theme) => {
    const hits = (career.match(new RegExp(theme.support.source, "g")) || []).length;
    return { key: theme.key, label: theme.label, supported: hits > 0, strength: hits >= 2 ? "solid" : hits === 1 ? "thin" : "none", evidence: hits ? sentenceAround(careerText, theme.support) : "" };
  });
}

// Coverage as the interview goes on: documents plus the answers approved so far.
export function coverageFor(sources, answerTexts = []) {
  const role = sources.filter(isRoleSource).map((source) => source.text).join("\n");
  const career = [...sources.filter(isCareerSource).map((source) => source.text), ...answerTexts].join("\n");
  return evaluateRequirements(role, career);
}

// ---------------------------------------------------------------------------
// Structured resume parsing (DRAFT_VERSION 3).
//
// A resume is parsed into a structured document:
//
//   { name, title, contact, summary,
//     roles: [{ title, company, dates, bullets: [] }],
//     highlights: [],   // approved interview lines; folded into the newest
//                       // role at export time, never a section of its own
//     education: [], skills: [], interests: "" }
//
// Real-world PDFs (LinkedIn's "Save to PDF" especially) wrap text mid-line,
// so headings end up glued inside lines ("605-484-3913 Summary Product
// builder") and date ranges wrap mid-date. The parser therefore rejoins
// wrapped fragments first, detects headings even when glued to line starts or
// mid-sentence, and splits roles on a date range found ANYWHERE in a line —
// never by halving the text.
// ---------------------------------------------------------------------------

const DATE_RANGE = /(?:\b(?:19|20)\d{2}\b|present|current)\s*(?:[-–—]|to)\s*(?:\b(?:19|20)\d{2}\b|present|current)/i;
const EMAIL_RE = /[^\s@|·,;]+@[^\s@|·,;]+\.[^\s@|·,;]+/;
const PHONE_RE = /(\+?1?[-.\s]?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4})/;
const URL_RE = /\b((?:https?:\/\/)?(?:www\.)?(?:linkedin\.com\/[^\s|·,;]+|[a-z0-9-]+\.(?:com|ai|io|dev|me|co|net|org|us)(?:\/[^\s|·,;]*)?))/i;
const LOCATION_RE = /\b([A-Z][a-z]+(?: [A-Z][a-z]+)?,\s*[A-Z]{2})\b/;
const JUNK_LINE = /^(undefined|null|nan|none)$/i;
// A repeated per-page header ("Danny Jones Resume", or a fragment of one) is
// layout, not content. LinkedIn stamps it on every page; when the page
// footer splits across extraction lines, the "Page X of Y" half is stripped
// by ingest clean() but the name half survives and would parse as a bullet.
// Only applied to lines that ARE a contiguous fragment of the name + "Resume"
// sequence ("Danny", "Danny Jones", "Jones Resume", "Resume") — never to a
// line that merely mentions the name inside a sentence.
const normHeader = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
function isPageHeaderJunk(line, name) {
  const text = normHeader(line);
  if (!text) return false;
  const nameWords = [...normHeader(name || "").split(" ").filter(Boolean), "resume"];
  const lineWords = text.split(" ").filter(Boolean);
  if (lineWords.length > nameWords.length) return false;
  for (let start = 0; start + lineWords.length <= nameWords.length; start++) {
    if (nameWords.slice(start, start + lineWords.length).join(" ") === text) return true;
  }
  return false;
}
const BULLET_GLYPH = /^[•\-\*·▪◦‣]+\s*/;
// The app's own draft prompts ("Add earlier roles…", "Contact details") are
// not resume content — dropped when a Career Chief export is re-uploaded.
const PROMPTS_EXACT = ["contact details", "your name", "professional title", "education"];
const PROMPTS_PREFIX = [
  "add your most recent role and accomplishments.",
  "add earlier roles that strengthen this case.",
  "add an accomplishment supported by your career history.",
];
const isPrompt = (line) => {
  const text = String(line).trim().toLowerCase();
  return PROMPTS_EXACT.includes(text) || PROMPTS_PREFIX.some((prompt) => text === prompt || text.startsWith(prompt + " "));
};

const SECTION_HEADINGS = [
  ["summary", /^(professional |career |executive )?(summary|profile|objective)$|^about( me)?$/i],
  ["experience", /^((professional|work|relevant|career|earlier) )?experience$|^(employment|work|career)( history)?$/i],
  ["education", /^education( (and|&) (training|certifications?))?$/i],
  ["skills", /^((core|key|technical|professional) )?(skills|competencies)$|^(skills (and|&) tools|capabilities|expertise)$/i],
  ["interests", /^interests$/i],
  ["other", /^(certifications?|licenses?|projects?|awards?( (and|&) honou?rs)?|publications?|volunteer(ing)?( experience)?|languages)$/i],
  // The app's own interview scaffolding: recognized so it can be dropped,
  // never parsed as resume content.
  ["drop", /^highlights( for this role)?$/i],
];
const headingAlone = (line) => {
  const label = line.replace(/[:\s]+$/, "").trim();
  if (label.length > 48) return null;
  return SECTION_HEADINGS.find(([, pattern]) => pattern.test(label))?.[0] || null;
};
// A heading glued to the start of a content line: "Summary Product builder…".
// The remainder must start uppercase (or be empty / after a colon), so a bullet
// like "Experience with Python" is not mistaken for a heading.
const headingPrefix = (line) => {
  const colon = line.match(/^([A-Za-z&() ]+?)\s*:\s*(.*)$/);
  if (colon) {
    const key = SECTION_HEADINGS.find(([, pattern]) => pattern.test(colon[1].trim()))?.[0];
    if (key) return { key, rest: colon[2].trim() };
  }
  const words = line.split(/\s+/);
  for (let n = Math.min(4, words.length - 1); n >= 1; n--) {
    const label = words.slice(0, n).join(" ");
    if (label.length > 40) continue;
    const key = SECTION_HEADINGS.find(([, pattern]) => pattern.test(label))?.[0];
    if (!key) continue;
    const rest = words.slice(n).join(" ").trim();
    if (rest && !/^[A-Z0-9(]/.test(rest)) continue;
    return { key, rest };
  }
  return null;
};
// A heading glued mid-line after a sentence: "...brands. Experience Founder…"
const MID_HEADING_RE = /(?<=[.!?])\s+(?=((professional |career |executive )?(summary|profile|objective)|((professional|work|relevant|career|earlier) )?experience|(employment|work|career)( history)?|education( (and|&) (training|certifications?))?|((core|key|technical|professional) )?(skills|competencies)|(skills (and|&) tools|capabilities|expertise)|interests|certifications?)\b)/i;
// Headings glued with no sentence end ("…productions Education & Training
// Black Hills…", "…(2003) Skills Product:…"): only split when the text after
// the heading starts with a capital or digit, so "customer education across"
// and "experience managing" are left alone.
const LOOSE_MID_HEADING_RE = /(?<=\s)(Education & Training|Work Experience|Professional Experience|Technical Skills|Core Skills|Key Skills|Core Competencies|Areas of Expertise|Selected Work|Earlier Experience)(?=\s+[A-Z0-9])/i;
const LOOSE_SINGLE_HEADING_RE = /(?<=\s)(Summary|Experience|Education|Employment|Skills|Interests|Projects|Certifications|Volunteering)(?=\s+[A-Z0-9])/;

const splitLineOnHeading = (line) => {
  // Cut points where a heading starts mid-line: after a sentence, or glued
  // with no sentence end when the following text starts capitalized.
  const cuts = [];
  // For MID the match is the preceding whitespace (heading in group 1); for
  // the LOOSE patterns the match IS the heading word.
  const cutAt = (re, matchIsHeading) => {
    const rx = new RegExp(re.source, re.flags.includes("g") ? re.flags : re.flags + "g");
    let m;
    while ((m = rx.exec(line)) !== null) {
      const word = (m[1] || "").trim();
      const key = SECTION_HEADINGS.find(([, pattern]) => pattern.test(word))?.[0];
      if (!key) continue;
      const start = matchIsHeading ? m.index : m.index + m[0].length;
      if (cuts.some((cut) => Math.abs(cut.start - start) < word.length + 1)) continue;
      cuts.push({ start, end: start + word.length, key });
    }
  };
  cutAt(MID_HEADING_RE, false);
  cutAt(LOOSE_MID_HEADING_RE, true);
  cutAt(LOOSE_SINGLE_HEADING_RE, true);
  cuts.sort((a, b) => a.start - b.start);
  if (!cuts.length) return [{ heading: null, text: line }];
  const segments = [];
  let cursor = 0;
  let currentKey = null;
  for (const cut of cuts) {
    const before = line.slice(cursor, cut.start).trim();
    if (before) segments.push({ heading: currentKey, text: before });
    currentKey = cut.key;
    cursor = cut.end;
  }
  const tail = line.slice(cursor).trim();
  if (tail) segments.push({ heading: currentKey, text: tail });
  return segments.filter((segment) => segment.text);
};

// Rejoin lines that a narrow-column PDF wrapped mid-sentence. A fragment joins
// the previous line when the previous line does not end with sentence
// punctuation, the fragment is not a heading or a new role, and either the
// fragment starts lowercase (a true continuation) or the previous line ends
// mid-construct like "(2022 –" or "(". Bullet glyphs and headings always break.
function rejoinWrapped(lines) {
  const out = [];
  for (const raw of lines) {
    const line = raw.trim();
    if (!line || JUNK_LINE.test(line)) continue;
    const prev = out.at(-1);
    const prevIsHeading = prev && (headingAlone(prev) || headingPrefix(prev));
    const lineIsHeading = headingAlone(line) || headingPrefix(line);
    const lineIsRole = DATE_RANGE.test(line);
    // A new contact line (email/phone first) or a line ending in a structural
    // pipe is a fresh block, not a wrapped sentence fragment.
    const lineIsContact = /^[^\s@|·,;]+@[^\s@|·,;]+\.[^\s@|·,;]+/.test(line) || /^(\+?1?[-.\s]?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4})/.test(line);
    const continues = prev && !prevIsHeading && !lineIsHeading && !lineIsRole && !lineIsContact
      && !BULLET_GLYPH.test(line)
      && !/[.!?:;|]$/.test(prev)
      && (/^[a-z]/.test(line) || /[-–—(]$/.test(prev));
    if (continues) out[out.length - 1] = `${prev} ${line}`;
    else out.push(line);
  }
  return out;
}

const TITLE_WORDS = /\b(founder|co-?founder|ceo|cto|cfo|coo|president|vp|vice president|director|manager|engineer|developer|designer|builder|leader|head|assistant|analyst|consultant|specialist|marketer|writer|photographer|architect|producer|strategist|administrator|coordinator)\b/i;

// First line is the name; when the extractor glued the headline onto it
// ("Danny Jones Founder & AI Product Builder"), split before the title words.
function splitNameLine(line) {
  const atPipe = line.search(/\s[|·•]\s/);
  if (atPipe > 0) return { name: line.slice(0, atPipe).trim(), extra: line.slice(atPipe).replace(/^[\s|·•]+/, "").trim() };
  const words = line.trim().split(/\s+/);
  if (words.length <= 3) return { name: line.trim(), extra: "" };
  const titleAt = words.findIndex((word, index) => index > 0 && TITLE_WORDS.test(word));
  if (titleAt > 1) return { name: words.slice(0, titleAt).join(" "), extra: words.slice(titleAt).join(" ") };
  return { name: words.slice(0, 3).join(" "), extra: words.slice(3).join(" ") };
}

// A role title wrapped across lines ("…toy 1st Assistant" / "Director,
// Freelance (2017 – …)"): the fragment is a trailing run of 2–4 capitalized
// words after a lowercase word, and it names a title ("assistant",
// "photographer"). Only recovered when the dated line's own title is a stub.
const TITLE_FRAG_RE = /^(.*?\s)((?:[A-Z0-9][\w&',-]*\s+){1,3}[A-Z0-9][\w&',-]*)$/;
const TITLE_WORD_RE = /\b(director|assistant|manager|lead|head|chief|officer|president|vp|vice|engineer|developer|designer|photographer|producer|editor|writer|analyst|consultant|specialist|coordinator|executive|founder|partner|associate|architect|scientist|marketer)\b/i;

function extractContactBits(line, bits) {
  let rest = line;
  const take = (pattern, key) => {
    const match = rest.match(pattern);
    if (match && !bits[key]) { bits[key] = match[1] || match[0]; rest = rest.replace(match[0], " "); }
  };
  // A 2-word city ("Los Angeles, CA") wins, unless the first word is a job
  // title ("Manager Austin, TX" is Austin, not "Manager Austin").
  const takeLocation = () => {
    if (bits.location) return;
    const re = new RegExp(LOCATION_RE.source, "g");
    let m, fallback = null;
    while ((m = re.exec(rest)) !== null) {
      const cityWords = m[1].split(",")[0].trim().split(/\s+/);
      if (cityWords.length === 1 || !TITLE_WORD_RE.test(cityWords[0])) {
        bits.location = m[1];
        rest = rest.replace(m[0], " ");
        return;
      }
      fallback = fallback || { index: m.index + cityWords[0].length };
    }
    if (fallback) {
      const single = rest.slice(fallback.index).match(LOCATION_RE);
      if (single) { bits.location = single[1]; rest = rest.replace(single[0], " "); }
    }
  };
  take(EMAIL_RE, "email");
  take(PHONE_RE, "phone");
  take(URL_RE, "url");
  takeLocation();
  rest = rest.replace(/[|·•,;\s]+$/g, "").replace(/^[|·•,;\s]+/g, "").trim();
  return rest;
}

// Header block: name, headline, and one clean contact line composed from
// whatever contact bits the extractor scattered across the first lines.
// Scanning stops at the first section heading so headings are never eaten.
function parseHeader(lines) {
  const { name, extra } = splitNameLine(lines[0] || "");
  const bits = { location: "", url: "", email: "", phone: "" };
  const body = [];
  if (extra) body.push(extra);
  let i = 1;
  for (; i < Math.min(lines.length, 8); i++) {
    const line = lines[i];
    if (headingAlone(line) || headingPrefix(line)) break;
    const rest = extractContactBits(line, bits);
    // Contact bits are taken even when section content follows on the same
    // line; the remainder flows into the body for section parsing.
    if (rest) body.push(rest);
    if (MID_HEADING_RE.test(line)) { i++; break; }
  }
  const contact = [bits.location, bits.url, bits.email, bits.phone].filter(Boolean).join(" | ");
  // The headline itself can wrap ("Founder & AI Product Builder" /
  // "| 1st Assistant Director"): take body lines until a heading, a dated
  // role line, or a bullet, and join them as the title.
  const titleLines = [];
  while (body.length && !headingAlone(body[0]) && !headingPrefix(body[0]) && !DATE_RANGE.test(body[0]) && !/^([•\-*]|\d+[.)])\s/.test(body[0])) {
    titleLines.push(body.shift());
  }
  // The name line sometimes repeats the headline ("Danny Jones Founder & …")
  // while the next line has the full version: drop the duplicated stub.
  if (titleLines.length > 1 && titleLines[1].startsWith(titleLines[0])) titleLines.shift();
  const title = titleLines.filter((line) => !isPrompt(line)).join(" | ");
  return { name: name || "", title, contact, rest: [...body, ...lines.slice(i)] };
}

function parseRoleHead(before) {
  const text = before.replace(/\s+[|·•]\s*.*$/, "").trim();
  let title = text;
  let company = "";
  const commaParts = text.split(/\s*,\s*/);
  if (commaParts.length > 1) {
    // A trailing location ("Austin TX") is not the company.
    if (/^[A-Z][a-z]+(?: [A-Z][a-z]+)*(?:,? [A-Z]{2})$/.test(commaParts.at(-1))) commaParts.pop();
    company = commaParts.at(-1) || "";
    title = commaParts.slice(0, -1).join(", ");
  } else {
    // "Rivermark Health — Senior Brand Marketing Manager": company first.
    const dash = text.split(/\s+[–—-]\s+/);
    if (dash.length === 2 && dash[0] && dash[1]) {
      company = dash[0].trim();
      title = dash[1].trim();
    }
  }
  return { title: title.trim(), company: company.trim() };
}

const toBullets = (lines) => lines
  .flatMap((line) => String(line).split(/(?<=[.!?])\s+(?=[A-Z0-9(])/))
  .map((line) => line.replace(BULLET_GLYPH, "").trim())
  .filter((line) => line && !JUNK_LINE.test(line) && line.length > 1);

const normLine = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const dedupeLines = (lines) => {
  const seen = new Set();
  return lines.filter((line) => {
    const key = normLine(line);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};
// Split experience lines into roles on a date range found ANYWHERE in a line.
// Text before the first dated line is held as pending and prepended to that
// role's header — narrow-column PDFs often wrap "…Founder &" / "AI Product
// Builder, … (2022 –" across lines. Repeated roles and bullets (a PDF that
// prints its content twice) collapse into one.
function splitRoles(lines, name = "") {
  const roles = [];
  let pending = [];
  for (const line of lines) {
    const match = line.match(DATE_RANGE);
    if (match) {
      let before = [...pending, line.slice(0, match.index).trim()].join(" ").trim().replace(/[,;:([\-–—\s]+$/, "");
      pending = [];
      const after = line.slice(match.index + match[0].length).trim().replace(/^[,;:\-–—\s)]+/, "");
      // Recover a title fragment stranded at the end of the previous bullet.
      const prev = roles.at(-1);
      if (prev?.bullets.length && before.split(",")[0].trim().split(/\s+/).filter(Boolean).length <= 2) {
        const lastBullet = prev.bullets[prev.bullets.length - 1];
        const frag = lastBullet && !/[.!?:;]$/.test(lastBullet) ? lastBullet.match(TITLE_FRAG_RE) : null;
        if (frag && /[a-z]$/.test(frag[1].trim()) && TITLE_WORD_RE.test(frag[2])) {
          prev.bullets[prev.bullets.length - 1] = frag[1].trim();
          before = `${frag[2]} ${before}`.trim();
        }
      }
      let { title, company } = parseRoleHead(before);
      // Bullet spill: a long title starting with lowercase words ("landscapes
      // Mount Rushmore…") loses the spill.
      if (title.split(/\s+/).filter(Boolean).length > 3) title = title.replace(/^(?:[a-z][\w&'-]*\s+)+/, "").trim();
      // A page-header fragment stranded after a date range ("(2009 – 2017)
      // Danny") is layout, not a bullet.
      const afterBullet = after && !isPageHeaderJunk(after, name) ? [after] : [];
      roles.push({ title, company, dates: match[0].trim(), bullets: afterBullet });
    } else if (roles.length) {
      roles.at(-1).bullets.push(line);
    } else {
      pending.push(line);
    }
  }
  if (!roles.length && pending.length) {
    roles.push({ title: "", company: "", dates: "", bullets: pending });
  }
  const out = [];
  for (const role of roles) {
    const key = [role.title, role.company, role.dates].map(normLine).join("|");
    const existing = out.find((r) => [r.title, r.company, r.dates].map(normLine).join("|") === key);
    if (existing) {
      existing.bullets.push(...role.bullets);
      continue;
    }
    out.push(role);
  }
  return out.map((role) => ({ ...role, bullets: dedupeLines(toBullets(role.bullets)) }));
}

const EDUCATION_HINT = /(\b(B\.?A\.?|B\.?S\.?|M\.?B\.?A\.?|M\.?A\.?|M\.?S\.?|Ph\.?D\.?|J\.?D\.?)\b|university|college|school of|institute of|certificat)/i;

// Parse resume text into the structured doc model. Never throws: the worst
// case is a sparse doc, never a crash and never invented content.
export function parseResumeText(resumeText) {
  const rawLines = String(resumeText || "").split(/\n+/).map((line) => line.trim()).filter(Boolean);
  if (!rawLines.length) {
    return { name: "", title: "", contact: "", summary: "", roles: [], highlights: [], education: [], skills: [], interests: "" };
  }
  const { name, title, contact, rest } = parseHeader(rejoinWrapped(rawLines));
  // Drop repeated per-page headers that survived extraction ("Danny Jones
  // Resume", bare name lines) before they can parse as bullets. The real
  // header block was already consumed by parseHeader, so a line that IS the
  // name out here is layout, not content.
  const content = rest.filter((line) => !isPageHeaderJunk(line, name));
  const sections = { summary: [], experience: [], education: [], skills: [], interests: [], other: [], drop: [] };
  let at = null;
  const feedText = (heading, text) => {
    if (heading) at = heading;
    if (text && at) sections[at].push(text);
    else if (text && !at) sections.experience.push(text);
    // "drop" sections (app scaffolding) are collected and ignored.
  };
  const feedLine = (line) => {
    const alone = headingAlone(line);
    if (alone) { at = alone; return; }
    // A heading stranded at the end of a line ("…storytelling Interests"):
    // the head stays in the current section, the next line starts the new one.
    const trailing = line.match(/\s((?:Education(?: & Training)?|Professional Experience|Work Experience|Technical Skills|Core Skills|Summary|Experience|Employment|Skills|Interests|Projects|Certifications))\s*$/);
    if (trailing) {
      const key = SECTION_HEADINGS.find(([, pattern]) => pattern.test(trailing[1]))?.[0];
      if (key) {
        const head = line.slice(0, trailing.index).trim();
        if (head) feedText(null, head);
        at = key;
        return;
      }
    }
    const prefixed = headingPrefix(line);
    if (prefixed) {
      // The remainder can itself contain further glued headings.
      feedText(prefixed.key, null);
      for (const segment of splitLineOnHeading(prefixed.rest)) feedText(segment.heading, segment.text);
      return;
    }
    for (const segment of splitLineOnHeading(line)) feedText(segment.heading, segment.text);
  };
  for (const line of content) feedLine(line);
  for (const key of Object.keys(sections)) sections[key] = sections[key].filter((line) => !isPrompt(line));
  // No headings at all: leading lines without date ranges are the summary,
  // everything from the first role header on is experience.
  if (!at && !sections.experience.length) {
    const firstRole = content.findIndex((line) => DATE_RANGE.test(line));
    const lead = firstRole < 0 ? content : content.slice(0, firstRole);
    sections.summary.push(...lead.filter((line) => !EDUCATION_HINT.test(line)));
    sections.education.push(...lead.filter((line) => EDUCATION_HINT.test(line)));
    if (firstRole >= 0) sections.experience.push(...content.slice(firstRole));
  }
  // Stray education lines hiding in experience (no heading case) get rescued.
  const rescued = [];
  sections.experience = sections.experience.filter((line) => {
    if (!DATE_RANGE.test(line) && EDUCATION_HINT.test(line) && line.length < 160) { rescued.push(line); return false; }
    return true;
  });
  const education = dedupeLines([...sections.other, ...sections.education, ...rescued]);
  const skills = dedupeLines(sections.skills
    .flatMap((line) => line.split(/(?<=[.!?])\s+/))
    .flatMap((line) => line.split(/\s*[,·|;•]\s*/))
    .flatMap((line) => line.split(/(?<=[a-z])\s+(?=[A-Z][a-z]+:)/))
    .map((item) => item.replace(/^[A-Z][a-z]+:\s*/, "").replace(BULLET_GLYPH, "").replace(/[.]+$/, "").trim())
    .filter((item) => item && !JUNK_LINE.test(item) && item.length > 1 && !isPrompt(item)));
  return {
    name, title, contact,
    summary: sections.summary.join(" ").trim(),
    roles: splitRoles(sections.experience, name),
    highlights: [],
    education: education.map((line) => line.trim()).filter(Boolean),
    skills,
    interests: dedupeLines(sections.interests.flatMap((line) => line.split(/(?<=[.!?])\s+(?=[A-Z0-9(])/))).join(" ").trim(),
  };
}

// Split free-typed experience text back into roles (used by the resume editor).
export function textToRoles(text) {
  return splitRoles(String(text || "").split(/\n+/).map((line) => line.trim()).filter(Boolean));
}

function makeDoc(resumeText, role, candidateContext = "") {
  const doc = parseResumeText(resumeText);
  const suppliedAccomplishment = candidateContext.split(/(?<=[.!?])\s+/)[0]?.trim();
  const firstName = doc.name.split(/\s+/)[0] || "";
  const candidateLine = suppliedAccomplishment?.replace(new RegExp(`^${firstName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s+`, "i"), "") || "";
  if (!doc.summary) {
    doc.summary = role
      ? `${doc.title || "Professional"} with experience relevant to ${role}. Brings cross-functional leadership, audience understanding, and evidence-led storytelling.`
      : `${doc.title || "Professional"} with cross-functional leadership and evidence-led storytelling experience.`;
  }
  if (!doc.skills.length) doc.skills = ["Leadership", "Strategy", "Storytelling", "Cross-functional collaboration"];
  if (candidateLine) {
    const line = candidateLine.charAt(0).toUpperCase() + candidateLine.slice(1).replace(/[.\s]+$/, "") + ".";
    doc.highlights = [line];
  }
  return doc;
}

// Presentations show the work; the user decides what to claim from it. One
// question per deck (up to three) asks exactly that, naming the deck.
function deckQuestions(sources) {
  return sources.filter((source) => source.format === "pptx").slice(0, 3).map((source) => {
    const titles = [...source.text.matchAll(/^Slide \d+(?: \(hidden\))?: (.+)$/gm)].map((match) => match[1]).filter((title) => title !== "Untitled").slice(0, 3);
    const covers = titles.length ? ` covers ${titles.map((title) => `“${title}”`).join(", ")}` : " is loaded";
    const name = source.name.replace(/\.pptx$/i, "");
    const prompt = {
      current: `Your deck “${name}”${covers}. What was your part in it, and what should your current-role section say about it?`,
      target: `Your deck “${name}”${covers}. What in it matters most for the role you want, and where have you already done similar work?`,
      cover: `Your deck “${name}”${covers}. What is the story behind it that you would want a hiring manager to hear first?`,
    }[source.focus] || `Your deck “${name}”${covers}. What was your part in it, and what should your resume say about it?`;
    return { id: `deck-${source.id}`, priority: "Highest value", topic: `Deck: ${name}`.slice(0, 70), prompt, section: source.focus === "current" ? "current" : undefined, why: "Presentations show the work that rarely makes it onto a resume. Your answer decides what the resume claims from it.", tip: "Rough notes are fine: your role, who it was for, decisions you made, and any numbers from the deck you want on the resume." };
  });
}

function questionPlan(allText, role, isSample) {
  if (isSample) return [
    { id: "ownership", priority: "Highest value", topic: "Program ownership", prompt: "You mention content partnerships. What did you personally build—from the first idea through the operating process?", why: "The role asks for a builder. A partnership alone does not prove personal ownership.", tip: "Think about strategy, contributor sourcing, partner selection, approvals, and the process you created.", sample: "I created the customer and expert content program. I developed the strategy, set up participant sourcing with Sales and Operations, selected the production partner, and approved stories and final edits." },
    { id: "results", priority: "High value", topic: "Outcomes", prompt: "What changed because of that program, and what evidence can you support?", why: "Nestwell connects content to customer growth. We need to separate reach from attributable business results.", tip: "Qualitative evidence is useful. Do not guess at a number.", sample: "Sales began using the stories in prospective-customer conversations. We saw stronger engagement with expert-led stories, but I do not have attributable acquisition data." },
    { id: "team", priority: "High value", topic: "Team leadership", prompt: "What did your six-person team own, and how did you lead the work?", why: "The posting asks for direct editorial and social leadership, not only agency management.", tip: "Include roles, decisions you owned, and how you improved quality or pace.", sample: "The team covered brand, editorial, and customer education. I set priorities, coached story development, and created the review process for sensitive topics." },
    { id: "judgment", priority: "Useful", topic: "Audience trust", prompt: "Tell me about a time you protected audience trust when commercial pressure pushed the other way.", why: "The company’s direction depends on useful content remaining credible.", tip: "A decision, trade-off, or piece you chose not to publish can be strong evidence.", sample: "I stopped a customer story from becoming a product pitch and rewrote the brief around the customer’s actual decision process." },
    { id: "transition", priority: "Useful", topic: "Company direction", prompt: "Have you helped one brand bring several services or audiences together? What was your role?", why: "The fictional CEO’s direction points to a broader family-services platform.", tip: "The example does not need to be identical; show the transferable operating problem.", sample: "I helped unify education for three healthcare service lines under one customer promise while keeping each audience’s practical needs distinct." },
    { id: "objection", priority: "Useful", topic: "Likely concern", prompt: "What would a skeptical hiring manager misunderstand about your readiness for this role?", why: "A strong application addresses the real objection without sounding defensive.", tip: "Name the concern and the evidence that changes the conclusion.", sample: "My title sounds narrower than my scope. I already lead brand and content people and built the operating process behind our customer-story program." },
    { id: "missing", priority: "Final check", topic: "What we missed", prompt: "What important part of your work is missing or underestimated in everything you shared?", why: "Documents rarely contain the whole hiring case.", tip: "Consider recent responsibilities, invisible work, difficult decisions, or accomplishments you take for granted.", sample: "I am often the person who turns sensitive, cross-functional disagreements into a clear customer-facing story." },
  ];
  const qs = [];
  const lower = allText.toLowerCase();
  if (/lead|manager|director|head/.test(role.toLowerCase()) || /team|leadership/.test(lower)) qs.push({ id: "team", priority: "Highest value", topic: "Leadership scope", prompt: "What team, budget, or cross-functional work did you directly lead—and what decisions were yours?", why: "The target role appears to require leadership scope that a title alone cannot establish.", tip: "Name the people or functions, the decisions you owned, and the operating rhythm." });
  qs.push({ id: "current", priority: "Highest value", topic: "Current role", prompt: "What are you doing in your current job that is not yet reflected in the resume you shared?", why: "Recent scope is often the strongest evidence and the most likely to be missing.", tip: "Rough notes are enough: responsibilities, decisions, launches, and problems people rely on you to solve." });
  qs.push({ id: "results", priority: "High value", topic: "Evidence of impact", prompt: "Which result best proves you can solve the target company’s problem?", why: "A hiring case needs supported outcomes, not only responsibilities.", tip: "Use a metric if you know it. A credible qualitative result is better than a guessed number." });
  qs.push({ id: "fit", priority: "High value", topic: "Transferable experience", prompt: `Which part of your background is most relevant to ${role || "this role"}, even if the wording or industry is different?`, why: "Transferable evidence often disappears when resumes mirror job-posting language too literally.", tip: "Explain the underlying problem, your role, and what changed." });
  qs.push({ id: "objection", priority: "Useful", topic: "Likely concern", prompt: "What concern might a skeptical hiring manager have, and what evidence should change their mind?", why: "Addressing the real objection improves the resume, application, and interview story.", tip: "Be direct. A concern is a question to answer, not proof that you are unqualified." });
  qs.push({ id: "missing", priority: "Final check", topic: "What we missed", prompt: "What important achievement, responsibility, or career goal is missing from the material you shared?", why: "Uploaded documents rarely contain the whole story.", tip: "Think about invisible work, recent changes, or something you take for granted." });
  return qs;
}

export function analyzeSources(sources, meta) {
  const allText = sources.map((source) => source.text).join("\n");
  const resumeText = sources.find((source) => source.kind === "resume")?.text || "";
  const careerText = sources.filter(isCareerSource).map((source) => source.text).join("\n");
  const jobText = sources.filter(isRoleSource).map((source) => source.text).join("\n");
  const requirements = evaluateRequirements(jobText, careerText);
  const isSample = sources.some((source) => source.id === "sample-job");
  const baseQuestions = questionPlan(allText, meta.role, isSample);
  const questions = [...baseQuestions.slice(0, 1), ...deckQuestions(sources), ...probeQuestions(sources, isCareerSource, undefined, isSample ? 1 : 3), ...baseQuestions.slice(1)];
  const known = requirements.filter((item) => item.supported).map((item) => item.label);
  const gaps = requirements.filter((item) => !item.supported).map((item) => item.label);
  const research = sources.filter(isResearchSource).map((source) => ({
    id: source.id,
    label: sourceLabels[source.kind],
    title: source.name,
    finding: source.text.split(/(?<=[.!?])\s+/)[0]?.slice(0, 260) || "Source added.",
    implication: source.kind === "leadership" ? "Use this to test strategic fit; do not claim private leadership preferences." : source.kind === "company" ? "Connect the resume to the company’s current problem, without presenting unverified trajectory as fact." : source.kind === "application" ? "Treat explicit application questions as screening priorities." : "Use this to distinguish required experience from generic keyword matching.",
    origin: source.origin,
  }));
  return {
    // Deck text is slide-by-slide, so its first sentence makes a poor resume line;
    // decks feed the interview instead.
    doc: makeDoc(resumeText, meta.role, sources.filter((source) => isCurrentRoleSource(source) && source.format !== "pptx").map((source) => source.text).join(" ")),
    questions,
    requirements,
    research,
    known,
    gaps,
    sourceCount: sources.length,
    characterCount: sources.reduce((sum, source) => sum + source.text.length, 0),
    thesis: isSample ? "A brand and audience-trust leader who has already begun building the content operation this role needs." : `${meta.role || "This opportunity"} needs a clear case built from supported scope, results, and transferable experience.`,
    strongestFit: known.slice(0, 2).join(" + ") || "Leadership + transferable evidence",
    caution: gaps.length ? `The current material does not yet establish ${gaps.slice(0, 3).join(", ").toLowerCase()}.` : "The core requirements appear in the supplied material; outcomes and personal ownership still need checking.",
  };
}

export function proposeResumeUpdate(doc, question, answer) {
  const cleanAnswer = answer.trim().replace(/\s+/g, " ");
  const first = cleanAnswer.split(/(?<=[.!?])\s+/)[0].replace(/^i['’](?:ve|m|d)\s+/i, "I ");
  const lead = /^(i |my |we )/i.test(first) ? first.replace(/^i\s+/i, "").replace(/^my\s+/i, "").replace(/^we\s+/i, "Collaborated to ") : first;
  const capitalized = lead.charAt(0).toUpperCase() + lead.slice(1);
  if (question.id === "ownership" && /customer and expert content program/i.test(cleanAnswer)) {
    return "Built a customer and expert content program, creating the strategy and participant-sourcing process with Sales and Operations, selecting the production partner, and approving stories and final edits.";
  }
  return `${capitalized.replace(/[.]+$/, "")}.`;
}

// The homepage's before/after, built from the real sample and the real
// proposal function, so it can only ever show what the app actually does.
export function sampleTransformation() {
  const question = questionPlan("", "", true)[0];
  const said = sampleResume.split(/(?<=[.!?])\s+|\n+/).find((line) => /partnerships/i.test(line)) || "";
  return { said, asked: question.prompt, answer: question.sample, became: proposeResumeUpdate({}, question, question.sample) };
}
