import fs from 'node:fs';

const dataRoot = new URL('../data/', import.meta.url);
const strict = process.env.STRICT_LINK_CHECK === '1';
const timeoutMs = Number(process.env.LINK_CHECK_TIMEOUT_MS || 4500);
const concurrency = Number(process.env.LINK_CHECK_CONCURRENCY || 8);
const sources = readAllSources();
const manualVerifiedUrls = new Set(
  sources
    .filter(source => source.linkCheckMode === 'manual_verified')
    .map(source => source.url)
    .filter(Boolean)
);
const urls = [...new Set([...readAllItems().map(item => item.url), ...sources.map(source => source.url)].filter(Boolean))]
  .filter(url => !manualVerifiedUrls.has(url));
const failures = [];

function jsonFiles(name) {
  const files = [new URL(name, dataRoot)].filter(file => fs.existsSync(file));
  for (const entry of fs.readdirSync(dataRoot, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const path = new URL(`${entry.name}/${name}`, dataRoot);
    if (fs.existsSync(path)) files.push(path);
  }
  return files;
}

function readAllItems() {
  return jsonFiles('items.json').flatMap(file => JSON.parse(fs.readFileSync(file, 'utf8')));
}

function readAllSources() {
  return jsonFiles('sources.json').flatMap(file => {
    const value = JSON.parse(fs.readFileSync(file, 'utf8'));
    return Array.isArray(value.sourceFamilies) ? value.sourceFamilies : [];
  });
}

async function check(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      signal: controller.signal,
      headers: { 'user-agent': 'Just-DDL link-check (+https://github.com/Just-Agent)' },
    });
    if (!response.ok && response.status !== 403 && response.status !== 429) failures.push({ url, status: response.status });
  } catch (error) {
    failures.push({ url, status: 'error', error: error.message });
  } finally {
    clearTimeout(timer);
  }
}

for (let index = 0; index < urls.length; index += concurrency) {
  await Promise.all(urls.slice(index, index + concurrency).map(url => check(url)));
}
if (failures.length) {
  const message = JSON.stringify(failures, null, 2);
  if (strict) {
    console.error(message);
    process.exit(1);
  }
  console.warn('warning-only link-check failures:', message);
}
console.log(`checked ${urls.length} unique links; manualVerified=${manualVerifiedUrls.size}`);
