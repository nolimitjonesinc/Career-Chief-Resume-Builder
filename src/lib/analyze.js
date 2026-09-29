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

const priorities = [
  ["creator", "Creator / contributor program"], ["community", "Community building"], ["editorial", "Editorial leadership"],
  ["social", "Social leadership"], ["acquisition", "Customer acquisition"], ["growth", "Measurable growth"],
  ["trust", "Audience trust"], ["team", "Team leadership"], ["strategy", "Brand strategy"],
];

function makeDoc(resumeText, role, candidateContext = "") {
  const lines = resumeText.split(/\n+/).map((line) => line.trim()).filter(Boolean);
  const name = lines[0] || "Your name";
  const title = lines[1] || role || "Professional title";
  const contactIndex = lines.findIndex((line) => /@|linkedin|\d{3}[-.) ]\d{3}/i.test(line));
  const contact = contactIndex > 1 ? lines[contactIndex] : "Contact details";
  const bodyLines = lines.slice(contactIndex > 1 ? contactIndex + 1 : 2);
  const educationLine = lines.find((line) => /^\s*education\b|^\s*(BA|BS|B\.A\.|B\.S\.|MBA|MA|MS|PhD)\b|university|college/i.test(line)) || "Education";
  const careerLines = bodyLines.filter((line) => line !== educationLine);
  const splitAt = Math.min(careerLines.length, Math.max(2, Math.ceil(careerLines.length / 2)));
  const currentText = careerLines.slice(0, splitAt).join("\n");
  const earlierText = careerLines.slice(splitAt).join("\n");
  const suppliedAccomplishment = candidateContext.split(/(?<=[.!?])\s+/)[0]?.trim();
  const firstName = name.split(/\s+/)[0];
  const candidateLine = suppliedAccomplishment?.replace(new RegExp(`^${firstName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s+`, "i"), "") || "";
  const firstCareerSentence = currentText.split(/(?<=[.!?])\s+/).find((line) => /\b(led|built|created|directed|developed|managed|launched|improved)\b/i.test(line)) || currentText;
  const tailored = candidateLine || firstCareerSentence || "Add an accomplishment supported by your career history.";
  return {
    name, title, contact,
    summary: role ? `${title} with experience relevant to ${role}. Brings cross-functional leadership, audience understanding, and evidence-led storytelling.` : `${title} with cross-functional leadership and evidence-led storytelling experience.`,
    current: currentText || "Add your most recent role and accomplishments.",
    tailored: tailored.charAt(0).toUpperCase() + tailored.slice(1).replace(/[.\s]+$/, "") + ".",
    earlier: earlierText || "Add earlier roles that strengthen this case.",
    education: educationLine,
    skills: "Leadership · Strategy · Storytelling · Cross-functional collaboration",
  };
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
  const careerText = sources.filter(isCareerSource).map((source) => source.text).join(" ");
  const jobText = sources.filter(isRoleSource).map((source) => source.text).join(" ");
  const lowerCareer = careerText.toLowerCase();
  const lowerJob = jobText.toLowerCase();
  const supportPatterns = {
    creator: /creator|contributor|expert content program|participant sourcing/,
    community: /community|audience program/,
    editorial: /editorial|content team|content program/,
    social: /social/,
    acquisition: /acquisition|customer adoption|prospective customer/,
    growth: /growth|increase|improved|expanded/,
    trust: /trust|sensitive customer|credibility/,
    team: /team|direct reports|people manager|managed [a-z -]*staff/,
    strategy: /strategy|positioning/,
  };
  const requirements = priorities.filter(([key]) => lowerJob.includes(key)).map(([key, label]) => ({ key, label, supported: supportPatterns[key].test(lowerCareer) }));
  const isSample = sources.some((source) => source.id === "sample-job");
  const baseQuestions = questionPlan(allText, meta.role, isSample);
  const questions = [...baseQuestions.slice(0, 1), ...deckQuestions(sources), ...baseQuestions.slice(1)];
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
  const first = cleanAnswer.split(/(?<=[.!?])\s+/)[0];
  const lead = /^(i |my |we )/i.test(first) ? first.replace(/^i\s+/i, "").replace(/^my\s+/i, "").replace(/^we\s+/i, "Collaborated to ") : first;
  const capitalized = lead.charAt(0).toUpperCase() + lead.slice(1);
  if (question.id === "ownership" && /customer and expert content program/i.test(cleanAnswer)) {
    return "Built a customer and expert content program, creating the strategy and participant-sourcing process with Sales and Operations, selecting the production partner, and approving stories and final edits.";
  }
  return `${capitalized.replace(/[.]+$/, "")}.`;
}
