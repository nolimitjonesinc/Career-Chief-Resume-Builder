import JSZip from "jszip";

// PowerPoint files are zip archives of XML. Text lives in <a:t> runs grouped by
// <a:p> paragraphs; speaker notes and charts are separate parts linked from each
// slide's relationship file. Parsed with patterns rather than DOMParser so the
// same code runs in the browser and in Node tests.

const MAX_SLIDES = 200;
const MAX_DECK_BYTES = 150 * 1024 * 1024;

const decode = (value) => value
  .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, "\"").replace(/&apos;/g, "'")
  .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
  .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(Number(dec)))
  .replace(/&amp;/g, "&");

function paragraphs(xml) {
  const found = [];
  for (const [paragraph] of xml.matchAll(/<a:p[\s>][\s\S]*?<\/a:p>/g)) {
    const text = [...paragraph.matchAll(/<a:t(?:\s[^>]*)?>([\s\S]*?)<\/a:t>/g)].map((run) => decode(run[1])).join("").trim();
    if (text) found.push(text);
  }
  return found;
}

function relationships(xml, basePath) {
  const rels = [];
  for (const [tag] of xml.matchAll(/<Relationship\s[^>]*>/g)) {
    const id = tag.match(/\bId="([^"]+)"/)?.[1];
    const type = tag.match(/\bType="([^"]+)"/)?.[1] || "";
    const target = tag.match(/\bTarget="([^"]+)"/)?.[1];
    if (!id || !target || /TargetMode="External"/.test(tag)) continue;
    rels.push({ id, type: type.split("/").pop(), path: resolvePath(basePath, target) });
  }
  return rels;
}

function resolvePath(basePath, target) {
  if (target.startsWith("/")) return target.slice(1);
  const parts = basePath.split("/").slice(0, -1);
  for (const piece of target.split("/")) {
    if (piece === "..") parts.pop();
    else if (piece !== ".") parts.push(piece);
  }
  return parts.join("/");
}

const relsPathFor = (partPath) => partPath.replace(/([^/]+)$/, "_rels/$1.rels");

async function readPart(zip, path) {
  const entry = zip.file(path);
  return entry ? entry.async("string") : "";
}

// Slide order comes from presentation.xml; file names can be out of order after
// slides are rearranged.
async function orderedSlidePaths(zip) {
  const presentation = await readPart(zip, "ppt/presentation.xml");
  const rels = relationships(await readPart(zip, "ppt/_rels/presentation.xml.rels"), "ppt/presentation.xml");
  const byId = new Map(rels.map((rel) => [rel.id, rel.path]));
  const ordered = [...presentation.matchAll(/<p:sldId\s[^>]*r:id="([^"]+)"/g)].map((match) => byId.get(match[1])).filter((path) => path && zip.file(path));
  if (ordered.length) return ordered;
  return Object.keys(zip.files).filter((path) => /^ppt\/slides\/slide\d+\.xml$/.test(path))
    .sort((a, b) => Number(a.match(/(\d+)\.xml$/)[1]) - Number(b.match(/(\d+)\.xml$/)[1]));
}

// Keep table rows together so "Store leads | 12" doesn't become two unrelated lines.
function tables(xml) {
  return [...xml.matchAll(/<a:tbl>[\s\S]*?<\/a:tbl>/g)].flatMap(([table]) =>
    [...table.matchAll(/<a:tr[\s>][\s\S]*?<\/a:tr>/g)].map(([row]) =>
      [...row.matchAll(/<a:tc[\s>][\s\S]*?<\/a:tc>/g)].map(([cell]) => paragraphs(cell).join(" ")).join(" | "))
      .filter((row) => row.replace(/[|\s]/g, "")));
}

// Corporate decks often keep their numbers in charts rather than on the slide.
function chartText(xml) {
  const title = paragraphs(xml.match(/<c:title>[\s\S]*?<\/c:title>/)?.[0] || "").join(" ");
  const series = [...xml.matchAll(/<c:ser>([\s\S]*?)<\/c:ser>/g)].map(([, ser]) => {
    const name = decode(ser.match(/<c:tx>[\s\S]*?<c:v>([\s\S]*?)<\/c:v>/)?.[1] || "");
    const points = (block) => [...(ser.match(new RegExp(`<c:${block}>[\\s\\S]*?</c:${block}>`))?.[0] || "").matchAll(/<c:pt\s[^>]*idx="(\d+)"[^>]*>\s*<c:v>([\s\S]*?)<\/c:v>/g)]
      .reduce((map, [, idx, value]) => map.set(idx, decode(value)), new Map());
    const categories = points("cat");
    const values = points("val");
    const pairs = [...values].map(([idx, value]) => categories.has(idx) ? `${categories.get(idx)} ${value}` : value);
    return [name, pairs.join(", ")].filter(Boolean).join(": ");
  }).filter(Boolean);
  if (!title && !series.length) return "";
  return `Chart${title ? ` "${title}"` : ""}${series.length ? ` — ${series.join("; ")}` : ""}`;
}

export async function extractPptx(data) {
  if ((data.byteLength ?? data.length) > MAX_DECK_BYTES) throw new Error("That presentation is over 150 MB. Save a copy without videos, or export it as a PDF.");
  let zip;
  try { zip = await JSZip.loadAsync(data); }
  catch { throw new Error("That PowerPoint file could not be opened. Try saving it again as .pptx or exporting it as a PDF."); }
  const slidePaths = (await orderedSlidePaths(zip)).slice(0, MAX_SLIDES);
  if (!slidePaths.length) throw new Error("I could not find any slides in that file.");
  const slides = [];
  let notesCount = 0;
  for (const [index, path] of slidePaths.entries()) {
    const xml = await readPart(zip, path);
    const rels = relationships(await readPart(zip, relsPathFor(path)), path);
    const lines = [...paragraphs(xml.replace(/<a:tbl>[\s\S]*?<\/a:tbl>/g, "")), ...tables(xml)];
    const hidden = /<p:sld\s[^>]*show="0"/.test(xml);
    const charts = [];
    for (const rel of rels.filter((item) => item.type === "chart")) {
      const text = chartText(await readPart(zip, rel.path));
      if (text) charts.push(text);
    }
    const notesPath = rels.find((item) => item.type === "notesSlide")?.path;
    // Notes pages repeat the slide number in a placeholder; drop bare numbers.
    const notes = notesPath ? paragraphs(await readPart(zip, notesPath)).filter((line) => !/^\d+$/.test(line)) : [];
    if (notes.length) notesCount += 1;
    if (!lines.length && !charts.length && !notes.length) continue;
    const [title, ...body] = lines;
    slides.push([
      `Slide ${index + 1}${hidden ? " (hidden)" : ""}: ${title || "Untitled"}`,
      ...body,
      ...charts,
      ...(notes.length ? [`Speaker notes: ${notes.join(" ")}`] : []),
    ].join("\n"));
  }
  return { text: slides.join("\n\n"), slideCount: slidePaths.length, notesCount };
}
