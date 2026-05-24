import fs from "node:fs";
import { FORBIDDEN_TEXT_PATTERNS, scanPublicPayload } from "./public-surface-rules.mjs";

const publicRoot = new URL("../public-data/", import.meta.url);
const pageFile = new URL("../index.html", import.meta.url);
const readmeFile = new URL("../README.md", import.meta.url);
const errors = [];
let files = 0;

function walk(dir) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const child = new URL(`${entry.name}${entry.isDirectory() ? "/" : ""}`, dir);
    if (entry.isDirectory()) walk(child);
    else if (entry.name.endsWith(".json")) {
      files += 1;
      errors.push(...scanPublicPayload(JSON.parse(fs.readFileSync(child, "utf8")), child.pathname));
    }
  }
}

function scanTextFile(file, label) {
  if (!fs.existsSync(file)) return;
  const text = fs.readFileSync(file, "utf8");
  for (const pattern of FORBIDDEN_TEXT_PATTERNS) {
    if (pattern.test(text)) errors.push(`${label} contains private maintenance text: ${pattern}`);
  }
}

walk(publicRoot);
scanTextFile(pageFile, "index.html");
scanTextFile(readmeFile, "README.md");

if (fs.existsSync(pageFile)) {
  const html = fs.readFileSync(pageFile, "utf8");
  if (/loadJson\([`"'](?:\.\/)?data\//.test(html) || /fetch\([`"'](?:\.\/)?data\//.test(html)) {
    errors.push("index.html must use ./public-data/* instead of raw ./data/*");
  }
}
if (files === 0) errors.push("no public JSON files exported");
if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}
console.log(`public data validated: ${files} JSON files`);
