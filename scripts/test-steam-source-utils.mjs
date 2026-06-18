#!/usr/bin/env node
import assert from 'node:assert/strict';
import {
  buildSteamItems,
  parseSteamReleaseDateText,
  parseSteamSearchPayload,
} from './steam-source-utils.mjs';

assert.deepEqual(parseSteamReleaseDateText('Jul 15, 2026'), {
  kind: 'fullDate',
  date: '2026-07-15',
  dateRange: 'Jul 15, 2026',
});

assert.deepEqual(parseSteamReleaseDateText('15 Jul, 2026'), {
  kind: 'fullDate',
  date: '2026-07-15',
  dateRange: '15 Jul, 2026',
});

assert.deepEqual(parseSteamReleaseDateText('Coming soon'), {
  kind: 'placeholder',
  dateRange: 'Coming soon',
});

assert.deepEqual(parseSteamReleaseDateText('2026'), {
  kind: 'placeholder',
  dateRange: '2026',
});

assert.deepEqual(parseSteamReleaseDateText('Q3 2026'), {
  kind: 'placeholder',
  dateRange: 'Q3 2026',
});

const payload = JSON.stringify({
  results_html: `
    <a href="https://store.steampowered.com/app/1234560/Example_Game/?snr=1" data-ds-appid="1234560">
      <span class="title">Example Game</span>
      <div class="col search_released responsive_secondrow">Jul 15, 2026</div>
    </a>
    <a data-ds-appid="2345670" href="https://store.steampowered.com/app/2345670/Fuzzy_Game/">
      <span class="title">Fuzzy &amp; Game</span>
      <div class="col search_released responsive_secondrow">Coming soon</div>
    </a>
  `,
});

const rows = parseSteamSearchPayload(payload, {
  id: 'steam-coming-soon',
  name: 'Steam Coming Soon',
  url: 'https://store.steampowered.com/search/?filter=comingsoon',
  rail: 'date-first',
});

assert.equal(rows.length, 2);
assert.equal(rows[0].appId, '1234560');
assert.equal(rows[0].title, 'Example Game');
assert.equal(rows[0].releaseText, 'Jul 15, 2026');
assert.equal(rows[1].title, 'Fuzzy & Game');

const items = buildSteamItems(rows, { today: '2026-06-18' });
assert.equal(items[0].id, 'steamgame-ddl-1234560');
assert.equal(items[0].deadline, '2026-07-15T23:59:59-07:00');
assert.equal(items[0].type, 'officialDeadline');
assert.equal(items[0].stage, 'Steam release');
assert.deepEqual(items[0].tags, ['steam', 'pc game', 'upcoming', 'date-first']);
assert.equal(items[1].isDatePlaceholder, true);
assert.equal(items[1].deadline, undefined);
assert.equal(items[1].sourceLabel, 'Steam 预发布');

const merged = buildSteamItems([
  {
    appId: '9999990',
    title: 'Shared Game',
    url: 'https://store.steampowered.com/app/9999990/Shared_Game/',
    releaseText: 'Coming soon',
    sourceId: 'steam-popular-upcoming',
    source: 'Steam Popular Upcoming',
    sourceUrl: 'https://store.steampowered.com/search/?filter=popularcomingsoon',
    rail: 'popular-upcoming',
  },
  {
    appId: '9999990',
    title: 'Shared Game',
    url: 'https://store.steampowered.com/app/9999990/Shared_Game/',
    releaseText: 'Aug 4, 2026',
    sourceId: 'steam-coming-soon',
    source: 'Steam Coming Soon',
    sourceUrl: 'https://store.steampowered.com/search/?filter=comingsoon',
    rail: 'date-first',
  },
], { today: '2026-06-18' });

assert.equal(merged.length, 1);
assert.equal(merged[0].deadline, '2026-08-04T23:59:59-07:00');
assert.deepEqual(merged[0].steamRails, ['popular-upcoming', 'date-first']);

console.log('steam source utilities tests passed');
