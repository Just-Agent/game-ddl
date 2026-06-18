import fs from 'node:fs';
import { buildSteamItems, parseSteamSearchPayload } from './steam-source-utils.mjs';

const dataRoot = new URL('../data/', import.meta.url);
const reportPath = new URL('../data/crawl-report.json', import.meta.url);
const timeoutMs = Number(process.env.CRAWL_TIMEOUT_MS || 4500);
const concurrency = Number(process.env.CRAWL_CONCURRENCY || 6);

const adapterHints = {
  'nba-playoffs': ['NBA', 'Finals', 'Schedule'],
  'fiba-event': ['FIBA', 'World Cup'],
  'bwf-calendar': ['BWF', 'Tournament', 'Calendar'],
  'ittf-calendar': ['ITTF', 'Events'],
  'wtt-events': ['WTT', 'Events'],
  'race-calendar': ['Marathon', 'Athletics', 'Race'],
  'matchroom-pool': ['Matchroom', 'Pool'],
  'apa-pool': ['APA', 'Pool'],
  'snooker-event': ['Snooker', 'Open'],
  'pickleball-tour': ['Pickleball', 'PPA', 'MLP'],
  'lol-esports': ['LoL Esports', 'MSI', 'Worlds'],
  'honor-of-kings-enc': ['Honor of Kings', 'Esports Nations Cup'],
  'esports-world-cup': ['Esports World Cup', '2026'],
  'esl-cs2': ['ESL', 'IEM', 'Cologne'],
  'valve-dota2': ['Dota', 'The International'],
  'event-listing': ['Event', '2026'],
  'riot-lol-patch-schedule': ['League of Legends', 'Patch Schedule', '26.11'],
  'riot-tft-patch-schedule': ['Teamfight Tactics', 'Patch Schedule', 'TFT17.4'],
  'steam-search': ['Steam', 'app', 'Coming Soon'],
};

const monthMap = new Map([
  ['january', '01'],
  ['february', '02'],
  ['march', '03'],
  ['april', '04'],
  ['may', '05'],
  ['june', '06'],
  ['july', '07'],
  ['august', '08'],
  ['september', '09'],
  ['october', '10'],
  ['november', '11'],
  ['december', '12'],
]);

function jsonFiles(name) {
  const files = [new URL(name, dataRoot)].filter(file => fs.existsSync(file));
  for (const entry of fs.readdirSync(dataRoot, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const path = new URL(`${entry.name}/${name}`, dataRoot);
    if (fs.existsSync(path)) files.push(path);
  }
  return files;
}

function readJson(path, fallback) {
  if (!fs.existsSync(path)) return fallback;
  return JSON.parse(fs.readFileSync(path, 'utf8'));
}

function readDataSets() {
  return jsonFiles('sources.json').map(sourcesPath => {
    const pathParts = sourcesPath.pathname.replaceAll('\\', '/').split('/');
    const fileParent = pathParts.at(-2);
    const isRoot = fileParent === 'data';
    const topicId = isRoot ? 'game-ddl' : fileParent;
    return {
      topicId,
      sourcesPath,
      itemsPath: isRoot ? new URL('items.json', dataRoot) : new URL(`${fileParent}/items.json`, dataRoot),
      sources: readJson(sourcesPath, { sourceFamilies: [] }),
      items: readJson(isRoot ? new URL('items.json', dataRoot) : new URL(`${fileParent}/items.json`, dataRoot), []),
    };
  });
}

async function fetchSource(source) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(source.crawlUrl || source.url, {
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        'accept-language': 'en-US,en;q=0.9',
        'user-agent': 'Mozilla/5.0 Just-DDL game-ddl crawler (+https://github.com/Just-Agent/game-ddl)',
      },
    });
    const contentType = response.headers.get('content-type') || '';
    const text = contentType.includes('pdf') ? '' : await response.text().catch(() => '');
    return { response, contentType, text };
  } finally {
    clearTimeout(timer);
  }
}

function scanMarkers(source, text) {
  const haystack = text.toLowerCase();
  const markers = [...new Set([...(adapterHints[source.adapter] || []), ...(source.expectedMarkers || [])])]
    .filter(marker => String(marker).trim().length > 2)
    .slice(0, 18);
  return markers.filter(marker => haystack.includes(String(marker).toLowerCase()));
}

function pacificOffset(date) {
  const value = Date.parse(`${date}T00:00:00Z`);
  const dstStart = Date.parse('2026-03-08T00:00:00Z');
  const dstEnd = Date.parse('2026-11-01T00:00:00Z');
  return value >= dstStart && value < dstEnd ? '-07:00' : '-08:00';
}

function dateFromParts(monthName, day, year) {
  const month = monthMap.get(String(monthName).toLowerCase());
  if (!month) return '';
  return `${year}-${month}-${String(day).padStart(2, '0')}`;
}

function formatDateRange(monthName, day, year) {
  const date = dateFromParts(monthName, day, year);
  const weekday = new Date(`${date}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' });
  return `${monthName} ${Number(day)}, ${year} (${weekday}) (Pacific Time)`;
}

function parseRiotPatchSchedule(source, text) {
  const pattern = source.adapter === 'riot-tft-patch-schedule'
    ? /\b(TFT\d{2}\.\d)\s+([A-Za-z]+)\s+(\d{1,2}),\s+(2026)\b/g
    : /\b(26\.\d{2})\s+([A-Za-z]+)\s+(\d{1,2}),\s+(2026)\b/g;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const seen = new Set();
  const items = [];
  for (const match of text.matchAll(pattern)) {
    const [, patch, monthName, day, year] = match;
    const date = dateFromParts(monthName, day, year);
    if (!date || seen.has(patch)) continue;
    seen.add(patch);
    const patchSlug = patch.toLowerCase().replaceAll('.', '-');
    const gameName = source.gameName || 'Game';
    const subtopic = source.subtopic || 'game-version';
    const hasEnded = Date.parse(`${date}T23:59:59`) < today.getTime();
    const baseItem = {
      topicId: source.topicId || 'game-version-ddl',
      id: `${source.itemPrefix}-${patchSlug}-${date}`,
      title: `${gameName} Patch ${patch}`,
      dateRange: formatDateRange(monthName, day, year),
      location: 'Online',
      isOnline: true,
      tags: source.tags || ['game update', 'patch'],
      url: source.url,
      source: source.name,
      sourceUrl: source.url,
      canonicalUrl: `${source.url}#${patchSlug}`,
      subtopic,
      subtopicName: source.subtopicName || gameName,
    };
    items.push({
      ...baseItem,
      ...(hasEnded ? { date } : { deadline: `${date}T23:59:59${pacificOffset(date)}` }),
      status: hasEnded ? 'ended' : 'upcoming',
      description: hasEnded
        ? `Riot 官方 2026 ${gameName} patch schedule 中的 Patch ${patch} 已发布节点。该节点用于版本节奏分析，不作为未来倒计时。`
        : `Riot 官方 2026 ${gameName} patch schedule 中的 Patch ${patch} 计划发布日期。具体上线时间以官方客户端与公告为准。`,
      stage: hasEnded ? 'Official patch release' : 'Version release',
      type: hasEnded ? 'officialRelease' : 'release',
      sourceLabel: hasEnded ? '官方历史节点' : '官方版本表',
    });
  }
  return items.sort((a, b) => {
    const left = Date.parse(a.date || a.deadline);
    const right = Date.parse(b.date || b.deadline);
    return left - right;
  }).slice(0, source.maxItems || 32);
}

async function checkSource(source, topicItems) {
  try {
    const { response, contentType, text } = await fetchSource(source);
    const title = (text.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1] || '').replace(/\s+/g, ' ').trim().slice(0, 180);
    const matchedMarkers = scanMarkers(source, text);
    const relatedItems = topicItems.filter(item => (source.relatedItems || []).includes(item.id));
    const generatedItems = ['riot-lol-patch-schedule', 'riot-tft-patch-schedule'].includes(source.adapter)
      ? parseRiotPatchSchedule(source, text)
      : [];
    const generatedSteamRows = source.adapter === 'steam-search'
      ? parseSteamSearchPayload(text, source).slice(0, source.maxItems || 50)
      : [];
    return {
      id: source.id,
      name: source.name,
      url: source.url,
      adapter: source.adapter,
      ok: response.ok,
      status: response.status,
      finalUrl: response.url,
      contentType,
      title,
      matchedMarkers,
      relatedItemCount: relatedItems.length,
      generatedItemCount: generatedItems.length + generatedSteamRows.length,
      generatedItems,
      generatedSteamRows,
      checkedAt: new Date().toISOString(),
    };
  } catch (error) {
    return {
      id: source.id,
      name: source.name,
      url: source.url,
      adapter: source.adapter,
      ok: false,
      status: 'error',
      error: error.message,
      checkedAt: new Date().toISOString(),
    };
  }
}

const checks = [];
const dataSets = readDataSets();
for (const dataSet of dataSets) {
  const sourceChecks = [];
  const sourceFamilies = Array.isArray(dataSet.sources.sourceFamilies) ? dataSet.sources.sourceFamilies : [];
  for (let index = 0; index < sourceFamilies.length; index += concurrency) {
    sourceChecks.push(...await Promise.all(sourceFamilies.slice(index, index + concurrency).map(source => checkSource(source, dataSet.items))));
  }
  const generatedSteamRows = sourceChecks.flatMap(check => check.generatedSteamRows || []);
  const generatedItems = [
    ...sourceChecks.flatMap(check => check.generatedItems || []),
    ...(generatedSteamRows.length ? buildSteamItems(generatedSteamRows) : []),
  ];
  if (generatedItems.length) {
    const generatedSourceNames = new Set(
      sourceChecks
        .filter(check => (check.generatedItems || []).length || (check.generatedSteamRows || []).length)
        .map(check => check.name)
    );
    const preservedItems = dataSet.items.filter(item => {
      if (item.type === 'forecastWindow' || item.isDatePlaceholder) return true;
      return !generatedSourceNames.has(item.source);
    });
    fs.writeFileSync(dataSet.itemsPath, JSON.stringify([...generatedItems, ...preservedItems], null, 2) + '\n', 'utf8');
  }
  dataSet.sources.generatedAt = new Date().toISOString();
  dataSet.sources.sourceFamilies = sourceFamilies.map(source => ({ ...source, lastCheckedAt: dataSet.sources.generatedAt }));
  fs.writeFileSync(dataSet.sourcesPath, JSON.stringify(dataSet.sources, null, 2) + '\n', 'utf8');
  checks.push(...sourceChecks.map(({ generatedItems: _generatedItems, generatedSteamRows: _generatedSteamRows, ...check }) => ({ topicId: dataSet.topicId, ...check })));
}
fs.writeFileSync(reportPath, JSON.stringify({ generatedAt: new Date().toISOString(), dataSets: dataSets.map(set => set.topicId), checks }, null, 2) + '\n', 'utf8');
console.log('game-ddl crawler checked ' + checks.length + ' source adapters across ' + dataSets.length + ' data exports');
process.exit(0);
