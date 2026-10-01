import assert from "node:assert/strict";
import test from "node:test";
import mammoth from "mammoth";
import { Packer } from "docx";
import { roundTripChecks, staticChecks, summarize } from "../src/lib/parsecheck.js";

const doc = { name: "Jordan Avery", title: "Brand Marketing Leader", contact: "San Francisco, CA · jordan@example.com", summary: "Brand leader.", current: "Rivermark Health — Senior Manager, 2021–present\nLed brand positioning.", tailored: "Built a customer content program.", earlier: "Lume Collective — Manager, 2018–2021", education: "BA Communications, 2015", skills: "Leadership · Strategy" };
const runtime = { toBytes: async (d) => new Uint8Array(await Packer.toBuffer(d)), extractText: async (bytes) => (await mammoth.extractRawText({ buffer: Buffer.from(bytes) })).value };

test("a clean resume passes the static checks", () => {
  assert.deepEqual(summarize(staticChecks(doc)).failed, []);
});

test("flags missing contact, undated roles, placeholders and unprintable characters", () => {
  const bad = { ...doc, contact: "Contact details", current: "Led things → great results", earlier: "Add earlier roles that strengthen this case." };
  const failed = summarize(staticChecks(bad)).failed.map((item) => item.id);
  assert.deepEqual(failed.sort(), ["characters", "contact", "dates", "placeholders"].sort());
  assert.match(summarize(staticChecks(bad)).failed.find((item) => item.id === "characters").hint, /→/);
});

test("the real Word file reads back with name, email, headings and body intact", async () => {
  const checks = await roundTripChecks(doc, runtime);
  assert.deepEqual(summarize(checks).failed, []);
});

test("the round trip catches a resume the parser cannot read back", async () => {
  const broken = await roundTripChecks(doc, { ...runtime, extractText: async () => "garbled" });
  assert.ok(summarize(broken).failed.length >= 3);
});
