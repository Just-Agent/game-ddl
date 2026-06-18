const monthMap = new Map([
  ['jan', '01'],
  ['january', '01'],
  ['feb', '02'],
  ['february', '02'],
  ['mar', '03'],
  ['march', '03'],
  ['apr', '04'],
  ['april', '04'],
  ['may', '05'],
  ['jun', '06'],
  ['june', '06'],
  ['jul', '07'],
  ['july', '07'],
  ['aug', '08'],
  ['august', '08'],
  ['sep', '09'],
  ['sept', '09'],
  ['september', '09'],
  ['oct', '10'],
  ['october', '10'],
  ['nov', '11'],
  ['november', '11'],
  ['dec', '12'],
  ['december', '12'],
]);

const htmlEntities = new Map([
  ['amp', '&'],
  ['lt', '<'],
  ['gt', '>'],
  ['quot', '"'],
  ['apos', "'"],
  ['nbsp', ' '],
]);

function decodeHtml(value = '') {
  return String(value)
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&([a-z]+);/gi, (match, name) => htmlEntities.get(name.toLowerCase()) ?? match);
}

function stripTags(value = '') {
  return decodeHtml(String(value).replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();
}

function attributeValue(tag, name) {
  const pattern = new RegExp(`${name}=["']([^"']+)["']`, 'i');
  return tag.match(pattern)?.[1] || '';
}

function normalizeAppUrl(url, appId) {
  const decoded = decodeHtml(url);
  try {
    const value = new URL(decoded);
    value.search = '';
    value.hash = '';
    return value.toString();
  } catch {
    return `https://store.steampowered.com/app/${appId}/`;
  }
}

function canonicalAppUrl(appId) {
  return `https://store.steampowered.com/app/${appId}/`;
}

function validDate(year, month, day) {
  const iso = `${year}-${month}-${String(day).padStart(2, '0')}`;
  const parsed = new Date(`${iso}T00:00:00Z`);
  if (!Number.isFinite(parsed.getTime())) return '';
  return parsed.toISOString().slice(0, 10) === iso ? iso : '';
}

function pacificOffset(date) {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Los_Angeles',
    timeZoneName: 'shortOffset',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const label = formatter
    .formatToParts(new Date(`${date}T12:00:00Z`))
    .find((part) => part.type === 'timeZoneName')?.value || 'GMT-8';
  const match = label.match(/GMT([+-])(\d{1,2})(?::(\d{2}))?/);
  if (!match) return '-08:00';
  const [, sign, hour, minute = '00'] = match;
  return `${sign}${String(hour).padStart(2, '0')}:${minute}`;
}

export function parseSteamReleaseDateText(text) {
  const dateRange = stripTags(text);
  if (!dateRange) return { kind: 'placeholder', dateRange: 'Coming soon' };

  const monthFirst = dateRange.match(/^([A-Za-z]+)\s+(\d{1,2}),\s*(\d{4})$/);
  if (monthFirst) {
    const [, monthName, day, year] = monthFirst;
    const month = monthMap.get(monthName.toLowerCase());
    const date = month ? validDate(year, month, day) : '';
    if (date) return { kind: 'fullDate', date, dateRange };
  }

  const dayFirst = dateRange.match(/^(\d{1,2})\s+([A-Za-z]+),?\s*(\d{4})$/);
  if (dayFirst) {
    const [, day, monthName, year] = dayFirst;
    const month = monthMap.get(monthName.toLowerCase());
    const date = month ? validDate(year, month, day) : '';
    if (date) return { kind: 'fullDate', date, dateRange };
  }

  return { kind: 'placeholder', dateRange };
}

function payloadHtml(payload) {
  const text = String(payload || '');
  try {
    const parsed = JSON.parse(text);
    if (typeof parsed.results_html === 'string') return parsed.results_html;
    if (typeof parsed.html === 'string') return parsed.html;
  } catch {
    return text;
  }
  return text;
}

export function parseSteamSearchPayload(payload, source) {
  const html = payloadHtml(payload);
  const rows = [];
  const anchorPattern = /<a\b([^>]*)>([\s\S]*?)<\/a>/gi;

  for (const match of html.matchAll(anchorPattern)) {
    const [, attrs, body] = match;
    const appAttr = attributeValue(attrs, 'data-ds-appid');
    const appId = String(appAttr).split(',').find((value) => /^\d+$/.test(value.trim()))?.trim();
    const href = attributeValue(attrs, 'href');
    if (!appId || !href) continue;

    const title = stripTags(body.match(/<span\b[^>]*class=["'][^"']*\btitle\b[^"']*["'][^>]*>([\s\S]*?)<\/span>/i)?.[1] || '');
    if (!title) continue;

    const releaseText = stripTags(body.match(/<[^>]*class=["'][^"']*\bsearch_released\b[^"']*["'][^>]*>([\s\S]*?)<\/[^>]+>/i)?.[1] || '');
    rows.push({
      appId,
      title,
      url: normalizeAppUrl(href, appId),
      canonicalUrl: canonicalAppUrl(appId),
      releaseText: releaseText || 'Coming soon',
      sourceId: source.id,
      source: source.name,
      sourceUrl: source.url,
      rail: source.rail || 'date-first',
    });
  }

  return rows;
}

function buildSteamItem(row, options = {}) {
  const parsedDate = parseSteamReleaseDateText(row.releaseText);
  const rails = [...new Set(row.rails || [row.rail].filter(Boolean))];
  const tags = ['steam', 'pc game', 'upcoming', ...rails].filter(Boolean);
  const base = {
    topicId: 'steamgame-ddl',
    id: `steamgame-ddl-${row.appId}`,
    title: String(row.title || '').replace(/\s+/g, ' ').trim(),
    dateRange: parsedDate.dateRange,
    location: 'Steam',
    isOnline: true,
    tags,
    url: normalizeAppUrl(row.url || canonicalAppUrl(row.appId), row.appId),
    source: row.source,
    sourceUrl: row.sourceUrl,
    canonicalUrl: row.canonicalUrl || canonicalAppUrl(row.appId),
    subtopic: 'steam',
    subtopicName: 'Steam',
    steamAppId: row.appId,
    steamRails: rails,
  };

  if (parsedDate.kind !== 'fullDate') {
    return {
      ...base,
      status: 'upcoming',
      type: 'placeholder',
      isDatePlaceholder: true,
      stage: rails.includes('popular-upcoming') ? 'Steam popular upcoming' : 'Steam upcoming',
      description: `${row.title} 已出现在 Steam 预发布列表，但 Steam 尚未公布精确到日的发行日期。`,
      sourceLabel: rails.includes('popular-upcoming') ? 'Steam 热门预发布' : 'Steam 预发布',
    };
  }

  const today = options.today || new Date().toISOString().slice(0, 10);
  const hasEnded = parsedDate.date < today;
  return {
    ...base,
    ...(hasEnded ? { date: parsedDate.date } : { deadline: `${parsedDate.date}T23:59:59${pacificOffset(parsedDate.date)}` }),
    status: hasEnded ? 'ended' : 'upcoming',
    stage: hasEnded ? 'Steam release' : 'Steam release',
    type: hasEnded ? 'officialRelease' : 'officialDeadline',
    description: hasEnded
      ? `${row.title} 的 Steam 官方发行日期已过。该记录用于保持 Steam 新游轨道的历史上下文。`
      : `${row.title} 的 Steam 商店页显示了精确发行日期；具体解锁时间、地区差异和购买信息请以 Steam 官方页面为准。`,
    sourceLabel: 'Steam 官方日期',
  };
}

function preferRow(left, right) {
  if (!left) return right;
  if (!right) return left;
  const leftDate = parseSteamReleaseDateText(left.releaseText);
  const rightDate = parseSteamReleaseDateText(right.releaseText);
  if (leftDate.kind === 'fullDate' && rightDate.kind !== 'fullDate') return left;
  if (rightDate.kind === 'fullDate' && leftDate.kind !== 'fullDate') return right;
  return left;
}

export function buildSteamItems(rows, options = {}) {
  const grouped = new Map();

  for (const row of rows) {
    const existing = grouped.get(row.appId);
    if (!existing) {
      grouped.set(row.appId, { ...row, rails: [row.rail].filter(Boolean) });
      continue;
    }
    const preferred = preferRow(existing, row);
    grouped.set(row.appId, {
      ...preferred,
      rails: [...new Set([...(existing.rails || []), row.rail].filter(Boolean))],
    });
  }

  return [...grouped.values()]
    .map((row) => buildSteamItem(row, options))
    .sort((a, b) => {
      const aDate = Date.parse(a.deadline || a.date || '9999-12-31');
      const bDate = Date.parse(b.deadline || b.date || '9999-12-31');
      return aDate - bDate || a.title.localeCompare(b.title);
    });
}
