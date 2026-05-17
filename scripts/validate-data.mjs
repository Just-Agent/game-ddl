import fs from 'node:fs';

const items = JSON.parse(fs.readFileSync(new URL('../data/items.json', import.meta.url), 'utf8'));
const required = ['id', 'title', 'deadline', 'dateRange', 'location', 'tags', 'url', 'status', 'source'];
const ids = new Set();
const errors = [];

for (const [index, item] of items.entries()) {
  for (const key of required) {
    if (item[key] === undefined || item[key] === null || item[key] === '') errors.push(`item ${index} missing ${key}`);
  }
  if (ids.has(item.id)) errors.push(`duplicate id ${item.id}`);
  ids.add(item.id);
  if (!Number.isFinite(new Date(item.deadline).getTime())) errors.push(`${item.id} has invalid deadline`);
  try { new URL(item.url); } catch { errors.push(`${item.id} has invalid url`); }
  if (item.sourceUrl) {
    try { new URL(item.sourceUrl); } catch { errors.push(`${item.id} has invalid sourceUrl`); }
  }
  if (!Array.isArray(item.tags) || item.tags.length === 0) errors.push(`${item.id} must include tags`);
}

if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}
console.log(`validated ${items.length} DDL items`);
