import fs from 'node:fs';

const sourcesPath = new URL('../data/sources.json', import.meta.url);
const itemsPath = new URL('../data/items.json', import.meta.url);
const reportPath = new URL('../data/crawl-report.json', import.meta.url);
const sources = JSON.parse(fs.readFileSync(sourcesPath, 'utf8'));
const items = JSON.parse(fs.readFileSync(itemsPath, 'utf8'));
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
};

async function fetchSource(source) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(source.url, {
      redirect: 'follow',
      signal: controller.signal,
      headers: { 'user-agent': 'Just-DDL game-ddl crawler (+https://github.com/Just-Agent/game-ddl)' },
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

async function checkSource(source) {
  try {
    const { response, contentType, text } = await fetchSource(source);
    const title = (text.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1] || '').replace(/\s+/g, ' ').trim().slice(0, 180);
    const matchedMarkers = scanMarkers(source, text);
    const relatedItems = items.filter(item => (source.relatedItems || []).includes(item.id));
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
for (let index = 0; index < sources.sourceFamilies.length; index += concurrency) {
  checks.push(...await Promise.all(sources.sourceFamilies.slice(index, index + concurrency).map(source => checkSource(source))));
}
sources.generatedAt = new Date().toISOString();
sources.sourceFamilies = sources.sourceFamilies.map(source => ({ ...source, lastCheckedAt: sources.generatedAt }));
fs.writeFileSync(sourcesPath, JSON.stringify(sources, null, 2) + '\n', 'utf8');
fs.writeFileSync(reportPath, JSON.stringify({ generatedAt: sources.generatedAt, checks }, null, 2) + '\n', 'utf8');
console.log('game-ddl crawler checked ' + checks.length + ' source adapters');
process.exit(0);
