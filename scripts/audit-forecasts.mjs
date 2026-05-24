#!/usr/bin/env node
import fs from 'node:fs';

const dataRoot = new URL('../data/', import.meta.url);
const errors = [];

function itemFiles(dir = dataRoot) {
  const files = [];
  if (!fs.existsSync(dir)) return files;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const child = new URL(`${entry.name}${entry.isDirectory() ? '/' : ''}`, dir);
    if (entry.isDirectory()) files.push(...itemFiles(child));
    if (entry.isFile() && entry.name === 'items.json') files.push(child);
  }
  return files;
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function isoDate(value) {
  if (!value) return '';
  const match = String(value).match(/^(\d{4}-\d{2}-\d{2})/);
  if (match) return match[1];
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString().slice(0, 10) : '';
}

function addDays(iso, days) {
  const date = new Date(`${iso}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function dayDiff(a, b) {
  return Math.round((new Date(`${b}T00:00:00Z`) - new Date(`${a}T00:00:00Z`)) / 86400000);
}

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

function mean(values) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function sameArray(a = [], b = []) {
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

function officialDate(item) {
  return isoDate(item.date || item.deadline || item.lastOfficialDate);
}

function validateForecast(file, items, forecast) {
  const byId = new Map(items.map((item) => [item.id, item]));
  const label = `${file.pathname}:${forecast.id}`;
  if (!forecast.isDatePlaceholder) errors.push(`${label} must use isDatePlaceholder`);
  if (forecast.deadline) errors.push(`${label} must not expose a fake deadline`);
  if (!Array.isArray(forecast.basisEvents) || forecast.basisEvents.length < 2) {
    errors.push(`${label} must include at least two basisEvents`);
    return;
  }

  const basis = forecast.basisEvents.map((id) => ({ id, item: byId.get(id) }));
  const missing = basis.filter(({ item }) => !item).map(({ id }) => id);
  if (missing.length) errors.push(`${label} missing basisEvents: ${missing.join(', ')}`);

  const datedBasis = basis
    .filter(({ item }) => item)
    .map(({ id, item }) => ({ id, date: officialDate(item) }))
    .filter(({ date }) => date);
  if (datedBasis.length !== forecast.basisEvents.length) {
    errors.push(`${label} has basisEvents without official dates`);
    return;
  }

  const sortedDates = [...new Set(datedBasis.map(({ date }) => date))].sort();
  if (sortedDates.length < 2) {
    errors.push(`${label} needs at least two distinct official dates`);
    return;
  }

  const intervals = [];
  for (let index = 1; index < sortedDates.length; index += 1) {
    intervals.push(dayDiff(sortedDates[index - 1], sortedDates[index]));
  }

  const lastOfficialDate = sortedDates.at(-1);
  if (forecast.lastOfficialDate !== lastOfficialDate) {
    errors.push(`${label} lastOfficialDate ${forecast.lastOfficialDate} does not match basis ${lastOfficialDate}`);
  }
  if (!forecast.estimatedNextWindow?.start || !forecast.estimatedNextWindow?.end) {
    errors.push(`${label} must include estimatedNextWindow`);
  } else {
    const start = isoDate(forecast.estimatedNextWindow.start);
    const end = isoDate(forecast.estimatedNextWindow.end);
    if (!start || !end || start > end) errors.push(`${label} has invalid estimatedNextWindow`);
    if (start && lastOfficialDate && start <= lastOfficialDate) {
      errors.push(`${label} forecast window must start after last official date`);
    }
  }
  if (!['low', 'medium', 'high'].includes(String(forecast.confidence || ''))) {
    errors.push(`${label} must include confidence`);
  }
  if (!forecast.forecastBasis) errors.push(`${label} must include forecastBasis`);
  if (!forecast.releaseCadence) {
    errors.push(`${label} must include releaseCadence`);
    return;
  }

  const cadence = forecast.releaseCadence;
  if (cadence.sampleSize !== sortedDates.length) errors.push(`${label} releaseCadence.sampleSize mismatch`);
  if (cadence.intervals && !sameArray(cadence.intervals, intervals)) errors.push(`${label} releaseCadence.intervals mismatch`);
  if (cadence.medianDays !== median(intervals)) errors.push(`${label} releaseCadence.medianDays mismatch`);
  if (Math.abs(Number(cadence.meanDays) - mean(intervals)) > 1) errors.push(`${label} releaseCadence.meanDays mismatch`);
  if (cadence.minDays !== Math.min(...intervals)) errors.push(`${label} releaseCadence.minDays mismatch`);
  if (cadence.maxDays !== Math.max(...intervals)) errors.push(`${label} releaseCadence.maxDays mismatch`);

  const algorithm = String(cadence.algorithmVersion || '');
  if (algorithm === 'just-ddl-cadence-v1') {
    const toleranceDays = Math.max(14, Math.round(median(intervals) * 0.2));
    const lowerInterval = intervals.length < 2
      ? Math.max(1, median(intervals) - toleranceDays)
      : Math.max(Math.min(...intervals), median(intervals) - toleranceDays);
    const upperInterval = intervals.length < 2
      ? median(intervals) + toleranceDays
      : Math.max(lowerInterval, Math.min(Math.max(...intervals), median(intervals) + toleranceDays));
    const expected = {
      start: addDays(lastOfficialDate, lowerInterval),
      end: addDays(lastOfficialDate, upperInterval)
    };
    if (forecast.estimatedNextWindow.start !== expected.start || forecast.estimatedNextWindow.end !== expected.end) {
      errors.push(`${label} deterministic forecast window mismatch`);
    }
  } else if (algorithm.includes('seasonal')) {
    if (!cadence.seasonalWindow) errors.push(`${label} seasonal forecast must document seasonalWindow`);
  } else if (algorithm.includes('year-break')) {
    if (!cadence.yearBreakWindow) errors.push(`${label} year-break forecast must document yearBreakWindow`);
  } else {
    errors.push(`${label} unknown forecast algorithm ${algorithm || '(missing)'}`);
  }
}

let forecastCount = 0;
for (const file of itemFiles()) {
  const items = readJson(file);
  if (!Array.isArray(items)) continue;
  for (const item of items) {
    if (item.type === 'forecastWindow' || item.estimatedNextWindow) {
      forecastCount += 1;
      validateForecast(file, items, item);
    }
  }
}

if (forecastCount === 0) errors.push('no forecast windows found');

if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}

console.log(`audited ${forecastCount} forecast windows`);
