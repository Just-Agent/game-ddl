# steamgame-ddl Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `steamgame-ddl` to the existing `Just-Agent/game-ddl` topic-family repository as a Steam upcoming games countdown topic.

**Architecture:** Keep the existing topic-family shape. Add a focused Steam parser module with tests, then wire it into the existing crawler, public-data export, validator, link-check, page tabs, README, and workflow commit patterns.

**Tech Stack:** Node.js ESM scripts, JSON data exports, static `index.html`, GitHub Pages, Just-DDL public-surface validation.

---

### Task 1: Steam Parser Tests

**Files:**
- Create: `scripts/test-steam-source-utils.mjs`
- Modify: `package.json`

- [ ] **Step 1: Write failing tests**

```js
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

assert.deepEqual(parseSteamReleaseDateText('Coming soon'), {
  kind: 'placeholder',
  dateRange: 'Coming soon',
});

assert.deepEqual(parseSteamReleaseDateText('2026'), {
  kind: 'placeholder',
  dateRange: '2026',
});

const payload = JSON.stringify({
  results_html: `
    <a href="https://store.steampowered.com/app/1234560/Example_Game/?snr=1" data-ds-appid="1234560">
      <span class="title">Example Game</span>
      <div class="col search_released responsive_secondrow">Jul 15, 2026</div>
    </a>
    <a data-ds-appid="2345670" href="https://store.steampowered.com/app/2345670/Fuzzy_Game/">
      <span class="title">Fuzzy Game</span>
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

const items = buildSteamItems(rows, { today: '2026-06-18' });
assert.equal(items[0].id, 'steamgame-ddl-1234560');
assert.equal(items[0].deadline, '2026-07-15T23:59:59-07:00');
assert.equal(items[0].type, 'officialDeadline');
assert.equal(items[1].isDatePlaceholder, true);
assert.equal(items[1].deadline, undefined);
```

- [ ] **Step 2: Run tests to verify RED**

Run: `node scripts/test-steam-source-utils.mjs`

Expected: FAIL with `Cannot find module './steam-source-utils.mjs'`.

### Task 2: Steam Parser Implementation

**Files:**
- Create: `scripts/steam-source-utils.mjs`
- Modify: `package.json`

- [ ] **Step 1: Implement parser utilities**

Create `scripts/steam-source-utils.mjs` with exported helpers:

```js
export function parseSteamReleaseDateText(text) {}
export function parseSteamSearchPayload(payload, source) {}
export function buildSteamItems(rows, options = {}) {}
```

The implementation must parse Steam search-result anchors with `data-ds-appid`,
extract title and `search_released`, convert full dates into
`deadline: YYYY-MM-DDT23:59:59-07:00/-08:00`, and convert fuzzy dates into
`isDatePlaceholder: true`.

- [ ] **Step 2: Add test script**

Add `test:steam` to `package.json`:

```json
"test:steam": "node scripts/test-steam-source-utils.mjs"
```

- [ ] **Step 3: Run tests to verify GREEN**

Run: `npm run test:steam`

Expected: PASS.

### Task 3: Crawler Adapter And Data Export

**Files:**
- Modify: `scripts/crawl-sources.mjs`
- Create: `data/steamgame-ddl/items.json`
- Create: `data/steamgame-ddl/sources.json`

- [ ] **Step 1: Register Steam sources**

Create `data/steamgame-ddl/sources.json` with two source families:

```json
{
  "topicId": "steamgame-ddl",
  "sourceFamilies": [
    {
      "id": "steam-coming-soon",
      "name": "Steam Coming Soon",
      "url": "https://store.steampowered.com/search/?filter=comingsoon",
      "adapter": "steam-search",
      "rail": "date-first",
      "maxItems": 50,
      "expectedMarkers": ["Steam", "Coming Soon"]
    },
    {
      "id": "steam-popular-upcoming",
      "name": "Steam Popular Upcoming",
      "url": "https://store.steampowered.com/search/?filter=popularcomingsoon",
      "adapter": "steam-search",
      "rail": "popular-upcoming",
      "maxItems": 50,
      "expectedMarkers": ["Steam", "Popular Upcoming"]
    }
  ]
}
```

- [ ] **Step 2: Seed an empty item array**

Create `data/steamgame-ddl/items.json` as:

```json
[]
```

- [ ] **Step 3: Wire crawler adapter**

Import `buildSteamItems` and `parseSteamSearchPayload` from
`scripts/steam-source-utils.mjs`. When `source.adapter === 'steam-search'`,
parse the fetched Steam payload and return generated items.

- [ ] **Step 4: Preserve valid prior items on network failure**

If no Steam items are generated because Steam blocks or times out, leave existing
`data/steamgame-ddl/items.json` unchanged and still write the source check report.

### Task 4: Page, README, And Automation Patterns

**Files:**
- Modify: `index.html`
- Modify: `README.md`
- Modify: `.github/workflows/update-data.yml`
- Modify: `.github/workflows/deploy-pages.yml`

- [ ] **Step 1: Add topic tab**

Add `steamgame-ddl` to the `topics` object with name `Steam 新游`, tone `#16a34a`,
and a description for Steam official upcoming games.

- [ ] **Step 2: Load Steam public data**

Change the loader to fetch three arrays:

```js
const [events, versions, steamGames] = await Promise.all([
  loadJson('public-data/items.json'),
  loadJson('public-data/game-version-ddl/items.json'),
  loadJson('public-data/steamgame-ddl/items.json')
]);
```

- [ ] **Step 3: Add Steam style and label**

Add a `steam` style and make `labelOf(item)` return `Steam 新游` for
`item.topicId === 'steamgame-ddl'`.

- [ ] **Step 4: Update docs and workflow commit globs**

Mention `steamgame-ddl` in README topic tables, directory tree, source strategy,
and workflow commit file patterns so `data/*/*.json` and `public-data/*/*.json`
are included.

### Task 5: Validate, Commit, And Report

**Files:**
- All changed files.

- [ ] **Step 1: Run focused tests**

Run: `npm run test:steam`

Expected: PASS.

- [ ] **Step 2: Run crawl**

Run: `npm run crawl`

Expected: source checks complete; Steam timeout is allowed only if prior valid
data remains available.

- [ ] **Step 3: Run build**

Run: `npm run build`

Expected: forecast audit, validator, public export, and public validation pass.

- [ ] **Step 4: Run link-check**

Run: `npm run link-check`

Expected: command exits 0; warning-only failures are acceptable for Steam.

- [ ] **Step 5: Commit local implementation**

Run:

```bash
git add .
git commit -m "feat: add steamgame-ddl topic"
```

Expected: local commit on `codex/steamgame-ddl`.
