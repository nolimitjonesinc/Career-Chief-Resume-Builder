// Turns the "I don't have a resume" form into plain resume text, in the layout the parser already reads.
// Only the person's own words go in. Nothing is added, rewritten or invented (rules of the house 1 and 2).

export const blankJob = () => ({ title: "", company: "", start: "", end: "", did: "" });

const clean = (value) => String(value || "").trim();
const hasJob = (job) => [job.title, job.company, job.did].some((value) => clean(value));

export function jobHeading(job) {
  const start = clean(job.start);
  const end = clean(job.end) || (start ? "Present" : "");
  const dates = start ? `${start} – ${end}` : "";
  const where = [clean(job.title), clean(job.company)].filter(Boolean).join(", ");
  return [where || "Role", dates && `(${dates})`].filter(Boolean).join(" ");
}

export function starterResumeText(form) {
  const jobs = (form.jobs || []).filter(hasJob);
  const lines = [clean(form.name), clean(form.headline), clean(form.contact)].filter(Boolean);
  if (clean(form.summary)) lines.push("SUMMARY", clean(form.summary));
  lines.push("EXPERIENCE");
  for (const job of jobs) {
    lines.push(jobHeading(job));
    lines.push(...clean(job.did).split(/\n+/).map((line) => line.replace(/^[-•*\s]+/, "").trim()).filter(Boolean));
  }
  if (clean(form.education)) lines.push("EDUCATION", ...clean(form.education).split(/\n+/).map((line) => line.trim()).filter(Boolean));
  if (clean(form.skills)) lines.push("SKILLS", clean(form.skills));
  return lines.join("\n");
}

export const starterReady = (form) => Boolean(clean(form.name)) && (form.jobs || []).some((job) => clean(job.did) && (clean(job.title) || clean(job.company)));
