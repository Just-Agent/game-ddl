import fs from 'node:fs';

const dataRoot = new URL('../data/', import.meta.url);
const required = ['id', 'title', 'dateRange', 'location', 'tags', 'url', 'status', 'source'];
const ids = new Set();
const errors = [];
let total = 0;

function itemFiles() {
  const files = [new URL('items.json', dataRoot)];
  for (const entry of fs.readdirSync(dataRoot, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const path = new URL(`${entry.name}/items.json`, dataRoot);
    if (fs.existsSync(path)) files.push(path);
  }
  return files;
}

for (const file of itemFiles()) {
  const items = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (!Array.isArray(items)) errors.push(`${file.pathname} must be an array`);
  total += Array.isArray(items) ? items.length : 0;
  for (const [index, item] of (Array.isArray(items) ? items : []).entries()) {
    for (const key of required) {
      if (item[key] === undefined || item[key] === null || item[key] === '') errors.push(`${file.pathname} item ${index} missing ${key}`);
    }
    if (ids.has(item.id)) errors.push(`duplicate id ${item.id}`);
    ids.add(item.id);
    const isHistory = item.type === 'historyEvent' || item.type === 'officialRelease';
    const isForecast = item.type === 'forecastWindow' || Boolean(item.estimatedNextWindow);
    if (isHistory) {
      if (!item.date || !Number.isFinite(new Date(item.date).getTime())) errors.push(`${item.id} history item must include valid date`);
    } else if (isForecast) {
      if (!item.isDatePlaceholder) errors.push(`${item.id} forecast item must set isDatePlaceholder`);
      if (!item.estimatedNextWindow?.start || !item.estimatedNextWindow?.end) errors.push(`${item.id} forecast item must include estimatedNextWindow`);
      if (item.estimatedNextWindow?.start && !Number.isFinite(new Date(item.estimatedNextWindow.start).getTime())) errors.push(`${item.id} has invalid estimatedNextWindow.start`);
      if (item.estimatedNextWindow?.end && !Number.isFinite(new Date(item.estimatedNextWindow.end).getTime())) errors.push(`${item.id} has invalid estimatedNextWindow.end`);
      if (!item.lastOfficialDate || !Number.isFinite(new Date(item.lastOfficialDate).getTime())) errors.push(`${item.id} forecast item must include lastOfficialDate`);
      if (!Array.isArray(item.basisEvents) || item.basisEvents.length < 2) errors.push(`${item.id} forecast item must include at least two basisEvents`);
      if (!item.forecastBasis) errors.push(`${item.id} forecast item must include forecastBasis`);
      if (!['low', 'medium', 'high'].includes(String(item.confidence || ''))) errors.push(`${item.id} forecast item must include confidence`);
    } else if (!item.deadline && !item.isDatePlaceholder) {
      errors.push(`${item.id} missing deadline, date, forecast window, or isDatePlaceholder`);
    }
    if (item.deadline && !Number.isFinite(new Date(item.deadline).getTime())) errors.push(`${item.id} has invalid deadline`);
    try { new URL(item.url); } catch { errors.push(`${item.id} has invalid url`); }
    if (item.sourceUrl) {
      try { new URL(item.sourceUrl); } catch { errors.push(`${item.id} has invalid sourceUrl`); }
    }
    if (item.canonicalUrl) {
      try { new URL(item.canonicalUrl); } catch { errors.push(`${item.id} has invalid canonicalUrl`); }
    }
    if (!Array.isArray(item.tags) || item.tags.length === 0) errors.push(`${item.id} must include tags`);
  }
}

if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}
console.log(`validated ${total} DDL items across ${itemFiles().length} data exports`);
