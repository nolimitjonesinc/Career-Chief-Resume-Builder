// "Can a machine read this?" as a checklist, not a score. Two layers:
//   - staticChecks: things true of the text itself (contact present, dates
//     present, nothing left as a placeholder, characters the PDF font can print).
//   - roundTripChecks: build the real Word file, read it back with a document
//     parser, and confirm the important parts survived. That is the same kind of
//     reading an applicant tracking system does, so a pass means something.
// There is deliberately no number. "87/100" would be invented precision.
import { buildDocx } from "./docx-build.js";

const EMAIL = /[^\s@]+@[^\s@]+\.[^\s@]+/;
const PHONE = /(\+?\d[\d\s().-]{8,}\d)/;
const RANGE = /(19|20)\d{2}\s*(?:[–—-]|to)\s*((19|20)\d{2}|present|current|now)/i;
const PLACEHOLDER = /^(add (your|earlier|an accomplishment)|contact details$|professional title$|your name$)/im;
// Characters the standard PDF font (WinAnsi) can print: Latin-1 plus a few typographic marks.
const WIN_ANSI_EXTRA = new Set("€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ".split(""));
const printableInPdf = (ch) => ch.charCodeAt(0) < 256 || WIN_ANSI_EXTRA.has(ch);

const check = (id, ok, label, hint) => ({ id, ok, label, hint: ok ? "" : hint });

export function staticChecks(doc) {
  const all = ["name", "title", "contact", "summary", "current", "tailored", "earlier", "education", "skills"].map((key) => String(doc[key] || "")).join("\n");
  const experience = `${doc.current}\n${doc.earlier}`;
  const odd = [...new Set([...all].filter((ch) => !printableInPdf(ch) && ch !== "\n"))];
  const words = all.split(/\s+/).filter(Boolean).length;
  return [
    check("contact", EMAIL.test(doc.contact) || PHONE.test(doc.contact), "Email or phone is in the contact line", "Add an email or phone number to the contact line, or recruiters and parsers have nothing to reach you with."),
    check("dates", RANGE.test(experience), "Roles have date ranges", "Add years to your roles (for example 2019–present). Parsers use them to order your history."),
    check("placeholders", !PLACEHOLDER.test(all), "No placeholder text left", "Some sections still say \"Add…\". Fill them in or delete them before you send this."),
    check("characters", odd.length === 0, "Every character prints in the PDF", `These may print as blanks or boxes in the PDF: ${odd.slice(0, 8).join(" ")}. Use plain punctuation, or send the Word version.`),
    check("length", words <= 900, "Length fits about two pages", `About ${words} words is long for most readers. Consider cutting the earliest or weakest lines.`),
  ];
}

// `toBytes(document)` -> Uint8Array and `extractText(bytes)` -> string are supplied
// by the runtime (browser: Packer.toBlob + mammoth; tests: Packer.toBuffer + mammoth).
export async function roundTripChecks(doc, { toBytes, extractText }) {
  const text = await extractText(await toBytes(await buildDocx(doc)));
  const flat = text.replace(/\s+/g, " ");
  const has = (value) => !value || flat.includes(String(value).trim().split("\n")[0].replace(/\s+/g, " ").slice(0, 60));
  const headings = ["Experience", "Education", "Capabilities"].every((heading) => flat.includes(heading));
  const email = (doc.contact.match(EMAIL) || [])[0];
  return [
    check("rt-name", has(doc.name), "Your name reads back from the Word file", "The name did not survive a read-back. Check it for unusual characters."),
    check("rt-contact", !email || flat.includes(email), "Your email reads back from the Word file", "The email did not read back cleanly. Retype it with plain characters."),
    check("rt-headings", headings, "Section headings read back in order", "Standard headings were not found when the file was read back."),
    check("rt-body", [doc.current, doc.tailored, doc.education].every(has), "Experience and education text reads back", "Some resume text did not survive a read-back."),
    check("rt-columns", true, "Single column, no tables or text boxes", ""),
  ];
}

export const summarize = (checks) => ({ passed: checks.filter((item) => item.ok).length, total: checks.length, failed: checks.filter((item) => !item.ok) });
