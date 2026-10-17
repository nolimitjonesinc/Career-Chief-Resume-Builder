// Pure fill decision for auto-fill from a pasted job link.
//
// Rules, all of them load-bearing for trust:
// - Fill ONLY fields the user left empty. Anything already typed stays
//   exactly as typed — pre-filled values are suggestions in the same visible,
//   editable fields, never silent overwrites.
// - A description is used only when it is substantial (>= 80 chars). Short or
//   missing extractions leave the field blank rather than guess.
// - Missing/empty hints change nothing. The caller still adds the fetched
//   page as an evidence source either way.
export function applyJobHints(meta, jobText, job) {
  const current = {
    company: typeof meta?.company === "string" ? meta.company : "",
    role: typeof meta?.role === "string" ? meta.role : "",
  };
  const currentJobText = typeof jobText === "string" ? jobText : "";
  const hints = job && typeof job === "object" ? job : {};
  const nextMeta = { ...current };
  const filled = [];
  if (typeof hints.role === "string" && hints.role.trim() && !current.role.trim()) {
    nextMeta.role = hints.role;
    filled.push("role");
  }
  if (typeof hints.company === "string" && hints.company.trim() && !current.company.trim()) {
    nextMeta.company = hints.company;
    filled.push("company");
  }
  let nextJobText = currentJobText;
  if (typeof hints.description === "string" && hints.description.length >= 80 && !currentJobText.trim()) {
    nextJobText = hints.description;
    filled.push("job description");
  }
  return { meta: nextMeta, jobText: nextJobText, filled };
}
