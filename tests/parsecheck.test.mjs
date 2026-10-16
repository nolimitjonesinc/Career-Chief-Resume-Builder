import assert from "node:assert/strict";
import test from "node:test";
import mammoth from "mammoth";
import { Packer } from "docx";
import { roundTripChecks, staticChecks, summarize } from "../src/lib/parsecheck.js";

const doc = {
  name: "Jordan Avery",
  title: "Brand Marketing Leader",
  contact: "San Francisco, CA · jordan@example.com",
  summary: "Brand leader.",
  roles: [{ title: "Senior Manager", company: "Rivermark Health", dates: "2021–present", bullets: ["Led brand positioning."] }],
  highlights: ["Built a customer content program."],
  education: ["BA Communications, 2015"],
  skills: ["Leadership", "Strategy"],
  interests: "",
};
const runtime = { toBytes: async (d) => new Uint8Array(await Packer.toBuffer(d)), extractText: async (bytes) => (await mammoth.extractRawText({ buffer: Buffer.from(bytes) })).value };

test("a clean resume passes the static checks", () => {
  assert.deepEqual(summarize(staticChecks(doc)).failed, []);
});

test("flags missing contact, undated roles, placeholders and unprintable characters", () => {
  const bad = {
    ...doc,
    contact: "Contact details",
    summary: "Brand leader →",
    roles: [],
    highlights: [],
    education: ["Add earlier roles that strengthen this case."],
  };
  const failed = summarize(staticChecks(bad)).failed.map((item) => item.id);
  assert.deepEqual(failed.sort(), ["characters", "contact", "dates", "placeholders", "structure"].sort());
  assert.match(summarize(staticChecks(bad)).failed.find((item) => item.id === "characters").hint, /→/);
});

test("the real Word file reads back with name, email, headings, roles and bullets intact", async () => {
  const checks = await roundTripChecks(doc, runtime);
  assert.deepEqual(summarize(checks).failed, []);
});

test("the round trip catches a resume the parser cannot read back", async () => {
  const broken = await roundTripChecks(doc, { ...runtime, extractText: async () => "garbled" });
  assert.ok(summarize(broken).failed.length >= 3);
});

test("highlights never get their own section in the export", async () => {
  const { buildDocx } = await import("../src/lib/docx-build.js");
  const withHighlights = { ...doc, highlights: ["Shipped the thing nobody else could ship."] };
  const text = await runtime.extractText(await runtime.toBytes(await buildDocx(withHighlights)));
  assert.doesNotMatch(text, /highlights for this role/i);
  assert.match(text, /Shipped the thing nobody else could ship/);
});
