import fs from "node:fs";
import path from "node:path";
import { scanPublicPayload, stripPrivateFields } from "./public-surface-rules.mjs";

const root = new URL("../data/", import.meta.url);
const outputRoot = new URL("../public-data/", import.meta.url);
const exported = [];
const errors = [];

function exportFile(inputFile, outputFile, label) {
  if (!fs.existsSync(inputFile)) return;
  fs.mkdirSync(new URL("./", outputFile), { recursive: true });
  const publicPayload = stripPrivateFields(JSON.parse(fs.readFileSync(inputFile, "utf8")));
  errors.push(...scanPublicPayload(publicPayload, label));
  fs.writeFileSync(outputFile, `${JSON.stringify(publicPayload, null, 2)}\n`, "utf8");
  exported.push(path.posix.join("public-data", label));
}

fs.rmSync(outputRoot, { recursive: true, force: true });
fs.mkdirSync(outputRoot, { recursive: true });

for (const filename of ["items.json", "sources.json", "metrics.json"]) {
  exportFile(new URL(filename, root), new URL(filename, outputRoot), filename);
}

for (const dirent of fs.readdirSync(root, { withFileTypes: true })) {
  if (!dirent.isDirectory()) continue;
  const topicDir = new URL(`${dirent.name}/`, root);
  const publicTopicDir = new URL(`${dirent.name}/`, outputRoot);
  for (const filename of ["items.json", "sources.json", "metrics.json"]) {
    exportFile(new URL(filename, topicDir), new URL(filename, publicTopicDir), `${dirent.name}/${filename}`);
  }
}

if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}
console.log(`exported ${exported.length} public data files`);
