// The one canonical view of a resume doc, shared by the on-screen preview and
// the exports.
//
// The preview renders this exact markup (plus invisible data-edit hooks),
// with styles tuned to the PDF export's metrics — same fonts, sizes, page
// width and margins — so what you see in the preview is what downloads.
// The HTML export uses the same markup with its own long-standing styles,
// and its bytes are pinned by tests: the preview matches the exports, never
// the other way around.

// Prompts shown in the on-screen working draft that must never reach a paid
// export. A buyer exporting before finishing the interview would otherwise
// pay for a file that says "Add your most recent role and accomplishments."
export const PLACEHOLDERS = new Set([
  "Add your most recent role and accomplishments.",
  "Add earlier roles that strengthen this case.",
  "Add an accomplishment supported by your career history.",
  "Contact details",
  "Your name",
  "Professional title",
  "Education",
]);

const JUNK = /^(undefined|null|nan)$/i;
const cleanText = (value) => {
  const text = String(value ?? "").trim();
  return PLACEHOLDERS.has(text) || JUNK.test(text) ? "" : text;
};
const cleanList = (values) => (Array.isArray(values) ? values : String(values ?? "").split("\n"))
  .map((item) => cleanText(item)).filter(Boolean);

// Returns the doc with placeholder prompts and junk removed (same shape).
// The on-screen draft keeps its prompts; only exports are cleaned.
export function sanitizeDoc(rawDoc) {
  const doc = rawDoc || {};
  return {
    name: cleanText(doc.name),
    title: cleanText(doc.title),
    contact: cleanText(doc.contact),
    summary: cleanText(doc.summary),
    roles: (Array.isArray(doc.roles) ? doc.roles : []).map((role) => ({
      title: cleanText(role.title),
      company: cleanText(role.company),
      dates: cleanText(role.dates),
      bullets: cleanList(role.bullets),
    })).filter((role) => role.title || role.company || role.bullets.length),
    // Approved interview lines never get a section of their own in a paid
    // export; they ride along as bullets under the newest role instead.
    highlights: cleanList(doc.highlights),
    education: cleanList(doc.education),
    skills: cleanList(doc.skills),
    interests: cleanText(doc.interests),
  };
}

// The export view of a doc: highlights folded into the newest role's bullets,
// so approved interview lines reach the paid file without their own section.
// NOTE: not idempotent — applying it twice would duplicate the folded lines.
export function exportView(rawDoc) {
  const doc = sanitizeDoc(rawDoc);
  const roles = doc.roles.map((role) => ({ ...role }));
  if (doc.highlights.length && roles.length) {
    roles[0] = { ...roles[0], bullets: [...doc.highlights, ...roles[0].bullets] };
  } else if (doc.highlights.length) {
    roles.push({ title: "", company: "", dates: "", bullets: [...doc.highlights] });
  }
  return { ...doc, roles };
}

// How many leading bullets of the export view's first role are folded
// highlights (rather than the role's own bullets). The preview uses this to
// map an edited bullet back to the highlights list or the role's bullets.
export function foldedHighlightCount(rawDoc) {
  return sanitizeDoc(rawDoc).highlights.length;
}

export const roleHeadline = (role) => [role.title, role.company].filter(Boolean).join(", ");
export const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);

// One role header, as the user edits it in the preview: "Title, Company —
// dates". Mirrors the parser's parseRoleHead: the last comma separates the
// company, a trailing location ("Austin TX") is not the company, and a
// "Company — Title" line reads company-first. Returns null for a blank line.
const DATE_RANGE_TAIL = /(?:\s*[–—-]\s*|\s*,\s*|\s+)(?:\(?\d{4}\s*[–—-]\s*(?:\d{4}|Present|Current)\)?)\s*$/i;
export function parseRoleHeaderLine(line) {
  const text = String(line || "").trim();
  if (!text) return null;
  let head = text;
  let dates = "";
  const sep = text.lastIndexOf(" — ");
  if (sep >= 0) {
    const maybeDates = text.slice(sep + 3).trim();
    // The em dash also separates "Company — Title" lines, so only treat
    // the tail as dates when it actually looks like a date range.
    if (/^\(?\d{4}\s*[–—-]\s*(?:\d{4}|Present|Current)\)?$/.test(maybeDates) || /^(Present|Current)$/i.test(maybeDates)) {
      head = text.slice(0, sep).trim();
      dates = maybeDates;
    }
  }
  if (!dates) {
    const tail = text.match(DATE_RANGE_TAIL);
    if (tail) {
      dates = tail[0].replace(/^[–—-]\s*|^\s*,\s*|^\s+/, "").replace(/^\(|\)$/g, "").trim();
      head = text.slice(0, tail.index).trim();
    }
  }
  head = head.replace(/\s+[|·•]\s*.*$/, "").trim();
  let title = head;
  let company = "";
  const commaParts = head.split(/\s*,\s*/);
  if (commaParts.length > 1) {
    // A trailing location ("Austin TX") is not the company.
    if (/^[A-Z][a-z]+(?: [A-Z][a-z]+)*(?:,? [A-Z]{2})$/.test(commaParts.at(-1))) commaParts.pop();
    company = commaParts.at(-1) || "";
    title = commaParts.slice(0, -1).join(", ");
  } else {
    // "Rivermark Health — Senior Brand Marketing Manager": company first.
    const dash = head.split(/\s+[–—-]\s+/);
    if (dash.length === 2 && dash[0] && dash[1]) {
      company = dash[0].trim();
      title = dash[1].trim();
    }
  }
  const parsed = { title: title.trim(), company: company.trim(), dates };
  if (!parsed.title && !parsed.company && !parsed.dates) return null;
  return parsed;
}

// The canonical resume body markup: same element structure, order, and
// content for the on-screen preview and the HTML export. `viewDoc` must
// already be an export view (see exportView) — the preview passes
// exportView(doc); the HTML export does the same.
// With editMode, each editable line carries data-edit hooks (invisible in
// rendering) and the `editing` field renders as an input/textarea in place.
// Without editMode the output is byte-identical to the historical export.
export function resumeBodyHtml(viewDoc, options = {}) {
  const doc = viewDoc || {};
  const { editMode = false, editing = null, highlightCount = 0 } = options;
  const isEditing = (key) => Boolean(editing && editing.key === key);
  const editInput = (value, multiline) => multiline
    ? `<textarea class="edit-field" data-edit-input rows="3">${escapeHtml(value)}</textarea>`
    : `<input type="text" class="edit-field" data-edit-input value="${escapeHtml(value)}">`;
  const editAttrs = (field, extra = "") => (editMode ? ` data-edit="${field}"${extra}` : "");

  const parts = [];
  if (doc.name) {
    parts.push(isEditing("name")
      ? `<h1>${editInput(doc.name, false)}</h1>`
      : `<h1${editAttrs("name")}>${escapeHtml(doc.name)}</h1>`);
  }
  if (doc.title) {
    parts.push(isEditing("title")
      ? `<h2>${editInput(doc.title, false)}</h2>`
      : `<h2${editAttrs("title")}>${escapeHtml(doc.title)}</h2>`);
  }
  if (doc.contact) {
    parts.push(isEditing("contact")
      ? `<p class="contact">${editInput(doc.contact, false)}</p>`
      : `<p class="contact"${editAttrs("contact")}>${escapeHtml(doc.contact)}</p>`);
  }
  if (doc.summary) {
    parts.push("<h3>Summary</h3>");
    parts.push(isEditing("summary")
      ? `<p class="summary">${editInput(doc.summary, true)}</p>`
      : `<p class="summary"${editAttrs("summary")}>${escapeHtml(doc.summary)}</p>`);
  }
  if ((doc.roles || []).length) {
    parts.push("<h3>Experience</h3>");
    doc.roles.forEach((role, roleIndex) => {
      const headLine = [roleHeadline(role), role.dates].filter(Boolean).join(" — ");
      const headKey = `roleHead:${roleIndex}`;
      parts.push(isEditing(headKey)
        ? `<div class="role-head">${editInput(headLine, false)}</div>`
        : `<div class="role-head"${editAttrs("roleHead", ` data-role="${roleIndex}"`)}><strong>${escapeHtml(roleHeadline(role))}</strong>${role.dates ? `<span class="dates">${escapeHtml(role.dates)}</span>` : ""}</div>`);
      if (role.bullets.length) {
        const items = role.bullets.map((bullet, bulletIndex) => {
          // Role 0's first `highlightCount` bullets are folded interview
          // lines: editing one edits the highlights list, not the role.
          const isHighlight = roleIndex === 0 && bulletIndex < highlightCount;
          const source = isHighlight ? "highlight" : "role";
          const index = isHighlight ? bulletIndex : bulletIndex - highlightCount;
          const key = `bullet:${roleIndex}:${bulletIndex}`;
          const attrs = editAttrs("bullet", ` data-role="${roleIndex}" data-bullet="${bulletIndex}" data-source="${source}" data-index="${index}"`);
          return isEditing(key) ? `<li>${editInput(bullet, true)}</li>` : `<li${attrs}>${escapeHtml(bullet)}</li>`;
        }).join("");
        parts.push(`<ul>${items}</ul>`);
      }
    });
  }
  if ((doc.education || []).length) {
    parts.push("<h3>Education</h3>");
    const items = doc.education.map((line, index) => {
      const key = `education:${index}`;
      const attrs = editAttrs("education", ` data-index="${index}"`);
      return isEditing(key) ? `<li>${editInput(line, true)}</li>` : `<li${attrs}>${escapeHtml(line)}</li>`;
    }).join("");
    parts.push(`<ul>${items}</ul>`);
  }
  if ((doc.skills || []).length) {
    const skillsLine = doc.skills.join(" · ");
    parts.push("<h3>Skills</h3>");
    parts.push(isEditing("skills")
      ? `<p>${editInput(skillsLine, false)}</p>`
      : `<p${editAttrs("skills")}>${escapeHtml(skillsLine)}</p>`);
  }
  if (doc.interests) {
    parts.push("<h3>Interests</h3>");
    parts.push(isEditing("interests")
      ? `<p>${editInput(doc.interests, true)}</p>`
      : `<p${editAttrs("interests")}>${escapeHtml(doc.interests)}</p>`);
  }
  return parts.join("");
}

// The current value of one editable preview field, for the edit-in-place
// input. `edit` is the descriptor from the clicked element's data-edit
// attributes (field + roleIndex/bulletIndex/source/index).
export function previewFieldValue(rawDoc, edit) {
  const view = exportView(rawDoc);
  switch (edit.field) {
    case "name": return view.name || "";
    case "title": return view.title || "";
    case "contact": return view.contact || "";
    case "summary": return view.summary || "";
    case "interests": return view.interests || "";
    case "skills": return (view.skills || []).join(" · ");
    case "roleHead": {
      const role = (view.roles || [])[edit.roleIndex];
      if (!role) return "";
      return [roleHeadline(role), role.dates].filter(Boolean).join(" — ");
    }
    case "bullet": {
      const role = (view.roles || [])[edit.roleIndex];
      return role?.bullets?.[edit.bulletIndex] ?? "";
    }
    case "education": return (view.education || [])[edit.index] ?? "";
    default: return "";
  }
}

// Apply one in-place preview edit to the raw doc (never mutates the input).
// Clearing a bullet or education line removes that line; clearing a role
// header is ignored (no deleting a role by blanking its header in v1).
export function applyPreviewEdit(rawDoc, edit) {
  const doc = rawDoc || {};
  const next = {
    ...doc,
    roles: (doc.roles || []).map((role) => ({ ...role, bullets: [...(role.bullets || [])] })),
    highlights: [...(doc.highlights || [])],
    education: [...(doc.education || [])],
    skills: [...(doc.skills || [])],
  };
  const value = String(edit.value ?? "").trim();
  switch (edit.field) {
    case "name":
    case "title":
    case "contact":
    case "summary":
    case "interests":
      next[edit.field] = value;
      break;
    case "skills":
      next.skills = value.split(/[,·\n]+/).map((item) => item.trim()).filter(Boolean);
      break;
    case "bullet": {
      if (edit.source === "highlight") {
        if (!value) next.highlights.splice(edit.index, 1);
        else if (edit.index >= 0 && edit.index < next.highlights.length) next.highlights[edit.index] = value;
      } else {
        const role = next.roles[edit.roleIndex];
        if (!role) break;
        if (!value) role.bullets.splice(edit.bulletIndex, 1);
        else if (edit.bulletIndex >= 0 && edit.bulletIndex < role.bullets.length) role.bullets[edit.bulletIndex] = value;
      }
      break;
    }
    case "roleHead": {
      const parsed = parseRoleHeaderLine(edit.value);
      if (!parsed) break;
      const role = next.roles[edit.roleIndex];
      if (!role) break;
      next.roles[edit.roleIndex] = { ...role, ...parsed };
      break;
    }
    case "education": {
      if (!value) next.education.splice(edit.index, 1);
      else if (edit.index >= 0 && edit.index < next.education.length) next.education[edit.index] = value;
      break;
    }
    default:
      break;
  }
  return next;
}
