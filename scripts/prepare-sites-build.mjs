#!/usr/bin/env node
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { buildSync } from "esbuild";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dist = path.join(root, "dist");
const index = path.join(dist, "client", "index.html");
const worker = path.join(root, "worker", "index.js");
const hosting = path.join(root, ".openai", "hosting.json");
const extractor = path.join(root, "shared", "url-extract.mjs");

for (const file of [index, worker, hosting, extractor]) {
  if (!existsSync(file)) throw new Error("Missing Sites build input: " + file);
}

mkdirSync(path.join(dist, "server"), { recursive: true });
mkdirSync(path.join(dist, ".openai"), { recursive: true });
buildSync({ entryPoints: [worker], outfile: path.join(dist, "server", "index.js"), bundle: true, platform: "browser", format: "esm", target: "es2022" });
copyFileSync(hosting, path.join(dist, ".openai", "hosting.json"));

console.log("Prepared Sites build: dist/server/index.js and dist/.openai/hosting.json");
