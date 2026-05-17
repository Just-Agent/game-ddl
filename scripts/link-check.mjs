import fs from 'node:fs';

const items = JSON.parse(fs.readFileSync(new URL('../data/items.json', import.meta.url), 'utf8'));
const sources = JSON.parse(fs.readFileSync(new URL('../data/sources.json', import.meta.url), 'utf8'));
const strict = process.env.STRICT_LINK_CHECK === '1';
const timeoutMs = Number(process.env.LINK_CHECK_TIMEOUT_MS || 4500);
const concurrency = Number(process.env.LINK_CHECK_CONCURRENCY || 8);
const urls = [...new Set([...items.map(item => item.url), ...sources.sourceFamilies.map(source => source.url)].filter(Boolean))];
const failures = [];

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
console.log(`checked ${urls.length} unique links`);
