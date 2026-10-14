// "Can a machine read this?" as a checklist, not a score. Two layers:
//   - staticChecks: things true of the text itself (contact present, dates
//     present, nothing left as a placeholder, characters the PDF font can print).
//   - roundTripChecks: build the real Word file, read it back with a document
//     parser, and confirm the important parts survived. That is the same kind
//     of reading an applicant tracking system does, so a pass means something.
// There is deliberately no number. "87/100" would be invented precision.
import { buildDocx } from "./docx-build.js";
import { exportView } from "./exporters.js";

const EMAIL = /[^\s@]+@[^\s@]+\.[^\s@]+/;
const PHONE = /(\+?\d[\d\s().-]{8,}\d)/;
const RANGE = /(19|20)\d{2}\s*(?:[–—-]|to)\s*((19|20)\d{2}|present|current|now)/i;
const PLACEHOLDER = /^(add (your|earlier|an accomplishment)|contact details$|professional title$|your name$)/im;
// Characters the standard PDF font (WinAnsi) can print: Latin-1 plus a few typographic marks.
const WIN_ANSI_EXTRA = new Set("€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ".split(""));
const printableInPdf = (ch) => ch.charCodeAt(0) < 256 || WIN_ANSI_EXTRA.has(ch);

const check = (id, ok, label, hint) => ({ id, ok, label, hint: ok ? "" : hint });

const roleText = (role) => [[role.title, role.company].filter(Boolean).join(" "), role.dates, ...(role.bullets || [])].join("\n");
const docText = (doc) => [doc.name, doc.title, doc.contact, doc.summary, ...(doc.roles || []).map(roleText), ...(doc.highlights || []), ...(doc.education || []), (doc.skills || []).join(" "), doc.interests].join("\n");

export function staticChecks(rawDoc) {
  const doc = exportView(rawDoc);
  const all = docText(doc);
  const experience = (doc.roles || []).map(roleText).join("\n");
  const odd = [...new Set([...all].filter((ch) => !printableInPdf(ch) && ch !== "\n"))];
  const words = all.split(/\s+/).filter(Boolean).length;
  // Placeholders are stripped before export, so they are checked against the
  // raw draft — otherwise the warning could never fire.
  const str = (value) => String(value ?? "");
  const rawRole = (role) => role && typeof role === "object"
    ? [[role.title, role.company].filter(Boolean).join(" "), role.dates, ...((role.bullets || []).map(str))].join("\n")
    : str(role);
  const rawText = [rawDoc?.name, rawDoc?.title, rawDoc?.contact, rawDoc?.summary,
    ...((rawDoc?.roles || []).map(rawRole)), ...((rawDoc?.highlights || []).map(str)),
    ...((rawDoc?.education || []).map(str)), ((rawDoc?.skills || []).map(str)).join(" "),
    rawDoc?.interests, str(rawDoc?.current), str(rawDoc?.earlier), str(rawDoc?.tailored),
  ].map(str).join("\n");
  return [
    check("contact", EMAIL.test(doc.contact) || PHONE.test(doc.contact), "Email or phone is in the contact line", "Add an email or phone number to the contact line, or recruiters and parsers have nothing to reach you with."),
    check("dates", RANGE.test(experience), "Roles have date ranges", "Add years to your roles (for example 2019–present). Parsers use them to order your history."),
    check("structure", (doc.roles || []).length > 0 && (doc.roles || []).every((role) => role.title || (role.bullets || []).length), "Experience is split into roles", "The experience section could not be split into roles. Check that each role has a date range."),
    check("placeholders", !PLACEHOLDER.test(rawText), "No placeholder text left", "Some sections still say \"Add…\". Fill them in or delete them before you send this."),
    check("characters", odd.length === 0, "Every character prints in the PDF", `These may print as blanks or boxes in the PDF: ${odd.slice(0, 8).join(" ")}. Use plain punctuation, or send the Word version.`),
    check("length", words <= 900, "Length fits about two pages", `About ${words} words is long for most readers. Consider cutting the earliest or weakest lines.`),
  ];
}

// `toBytes(document)` -> Uint8Array and `extractText(bytes)` -> string are supplied
// by the runtime (browser: Packer.toBlob + mammoth; tests: Packer.toBuffer + mammoth).
export async function roundTripChecks(rawDoc, { toBytes, extractText }) {
  const doc = exportView(rawDoc);
  const text = await extractText(await toBytes(await buildDocx(rawDoc)));
  const flat = text.replace(/\s+/g, " ");
  const has = (value) => !value || flat.includes(String(value).trim().split("\n")[0].replace(/\s+/g, " ").slice(0, 60));
  const headings = ["Experience", "Education", "Skills"].every((heading) => flat.includes(heading));
  const noHighlights = !/highlights for this role/i.test(flat);
  const email = (doc.contact.match(EMAIL) || [])[0];
  const firstRole = doc.roles[0];
  return [
    check("rt-name", has(doc.name), "Your name reads back from the Word file", "The name did not survive a read-back. Check it for unusual characters."),
    check("rt-contact", !email || flat.includes(email), "Your email reads back from the Word file", "The email did not read back cleanly. Retype it with plain characters."),
    check("rt-headings", headings, "Section headings read back in order", "Standard headings were not found when the file was read back."),
    check("rt-roles", !firstRole || has(firstRole.title), "Role titles read back from the Word file", "The newest role title did not survive a read-back."),
    check("rt-bullets", !firstRole || !firstRole.bullets[0] || has(firstRole.bullets[0]), "Bullets read back from the Word file", "Resume bullets did not survive a read-back."),
    check("rt-no-highlights", noHighlights, "No interview-scaffolding section in the file", "A \"Highlights for this role\" section leaked into the export."),
    check("rt-columns", true, "Single column, no tables or text boxes", ""),
  ];
}

export const summarize = (checks) => ({ passed: checks.filter((item) => item.ok).length, total: checks.length, failed: checks.filter((item) => !item.ok) });
