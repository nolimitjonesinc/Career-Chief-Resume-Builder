import assert from "node:assert/strict";
import test from "node:test";
import JSZip from "jszip";
import { extractPptx } from "../src/lib/pptx.js";

const R = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
const rel = (id, type, target) => `<Relationship Id="${id}" Type="${R}/${type}" Target="${target}"/>`;
const rels = (...items) => `<Relationships>${items.join("")}</Relationships>`;
const para = (text) => `<a:p><a:r><a:t>${text}</a:t></a:r></a:p>`;

async function deck() {
  const zip = new JSZip();
  // slide2.xml is shown first: order must come from presentation.xml, not file names.
  zip.file("ppt/presentation.xml", `<p:presentation><p:sldIdLst><p:sldId id="1" r:id="rB"/><p:sldId id="2" r:id="rA"/></p:sldIdLst></p:presentation>`);
  zip.file("ppt/_rels/presentation.xml.rels", rels(rel("rA", "slide", "slides/slide1.xml"), rel("rB", "slide", "slides/slide2.xml")));
  zip.file("ppt/slides/slide2.xml", `<p:sld>${para("Q3 Rollout")}${para("40 stores &amp; 3 regions")}<a:tbl><a:tr><a:tc>${para("Store leads")}</a:tc><a:tc>${para("12")}</a:tc></a:tr></a:tbl></p:sld>`);
  zip.file("ppt/slides/_rels/slide2.xml.rels", rels(rel("n1", "notesSlide", "../notesSlides/notesSlide7.xml"), rel("c1", "chart", "../charts/chart3.xml")));
  zip.file("ppt/notesSlides/notesSlide7.xml", `<p:notes>${para("I led this rollout end to end.")}${para("1")}</p:notes>`);
  zip.file("ppt/charts/chart3.xml", `<c:chartSpace><c:title>${para("Revenue")}</c:title><c:ser><c:tx><c:v>$M</c:v></c:tx><c:cat><c:pt idx="0"><c:v>Q1</c:v></c:pt><c:pt idx="1"><c:v>Q2</c:v></c:pt></c:cat><c:val><c:pt idx="0"><c:v>12</c:v></c:pt><c:pt idx="1"><c:v>19</c:v></c:pt></c:val></c:ser></c:chartSpace>`);
  zip.file("ppt/slides/slide1.xml", `<p:sld show="0">${para("Backup detail")}</p:sld>`);
  return zip.generateAsync({ type: "uint8array" });
}

test("reads slides in presentation order with notes, tables and chart numbers", async () => {
  const { text, slideCount, notesCount } = await extractPptx(await deck());
  assert.equal(slideCount, 2);
  assert.equal(notesCount, 1);
  assert.equal(text, [
    "Slide 1: Q3 Rollout", "40 stores & 3 regions", "Store leads | 12",
    "Chart \"Revenue\" — $M: Q1 12, Q2 19", "Speaker notes: I led this rollout end to end.",
    "", "Slide 2 (hidden): Backup detail",
  ].join("\n"));
});

test("a file that is not a presentation gets a plain-English error", async () => {
  await assert.rejects(extractPptx(new TextEncoder().encode("not a deck")), /could not be opened/);
});
