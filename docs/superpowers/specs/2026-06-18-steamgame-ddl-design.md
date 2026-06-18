# steamgame-ddl design

Date: 2026-06-18
Repository: `Just-Agent/game-ddl`
Branch: `codex/steamgame-ddl`
Status: design approved for specification by the user

## Summary

`steamgame-ddl` will become the third public topic exported by the existing
`game-ddl` topic-family repository. It tracks upcoming Steam game releases with
two user-facing rails:

- date-first upcoming releases from Steam's official "Coming Soon" search page.
- popular upcoming releases from Steam's official "Popular Upcoming" search page.

The topic is not a new repository. It keeps the existing `game-ddl` Pages URL and
adds a separate Hub topic card with `topicId: "steamgame-ddl"`,
`clusterId: "game-ddl"`, and `sourceMode: "cluster"`.

## User Value

The page should answer two questions quickly:

- Which Steam games have official release dates coming soon?
- Which Steam upcoming games are worth watching even when the exact date is not
  announced yet?

The topic should feel like a countdown surface, not a storefront clone. It links
users back to the official Steam app page for purchase, wishlist, rating, region,
and age-gate details.

## Scope

The first production slice includes:

- A new raw data directory: `data/steamgame-ddl/`.
- A new public export directory: `public-data/steamgame-ddl/`.
- A Steam source adapter in the existing crawler.
- Validation for precise dates versus placeholders.
- Link checking for Steam search pages and app pages, warning-only where Steam
  blocks automation.
- A third topic tab in `index.html`: `Steam 新游`.
- README, topic map, and workflow documentation updates.
- Hub registration follow-up in the `just-ddl` repository once the topic export
  validates locally.

This slice does not add user accounts, purchase tracking, regional price
tracking, review-score history, or non-Steam storefronts.

## Source Strategy

Official sources only enter production data:

- Date-first rail:
  `https://store.steampowered.com/search/?filter=comingsoon`
- Popular-upcoming rail:
  `https://store.steampowered.com/search/?filter=popularcomingsoon`
- Per-game detail pages:
  `https://store.steampowered.com/app/<steam_app_id>/...`

Steam list pages are used for discovery and ordering. Each emitted item should
link to the official Steam app page and retain the list source that introduced
the item. If the list page is temporarily unreachable, the crawler keeps the
last known valid data and records the source check result in `data/crawl-report.json`.

## Date Semantics

Only official Steam dates with a full calendar day become countdowns.

- Full dates become future official deadlines when the date is still upcoming.
- Past full dates become history/release records only when retained for context.
- Month-only, year-only, season-only, `Coming soon`, `To be announced`, and
  equivalent values set `isDatePlaceholder: true`.
- Placeholder records must not include a synthetic `deadline`.
- Placeholder cards display "待官方公告" or an equivalent user-facing message.
- No Steam popularity rank or list order becomes a claim about Just-DDL user
  behavior.

The first implementation uses the Steam page's displayed calendar day as the
source date. It avoids UTC conversion that can shift local dates.

## Data Shape

`data/steamgame-ddl/items.json` remains an array of DDL items matching the
existing topic-family validator shape. New records use stable ids based on the
Steam app id:

```json
{
  "id": "steamgame-ddl-1234560",
  "topicId": "steamgame-ddl",
  "title": "Example Game",
  "deadline": "2026-07-15T23:59:59-07:00",
  "dateRange": "Jul 15, 2026",
  "location": "Steam",
  "isOnline": true,
  "status": "upcoming",
  "stage": "Steam release",
  "type": "officialDeadline",
  "source": "Steam Coming Soon",
  "sourceUrl": "https://store.steampowered.com/search/?filter=comingsoon",
  "url": "https://store.steampowered.com/app/1234560/example_game/",
  "canonicalUrl": "https://store.steampowered.com/app/1234560/",
  "subtopic": "steam",
  "subtopicName": "Steam",
  "tags": ["steam", "pc game", "upcoming"]
}
```

Placeholder records replace `deadline` with `isDatePlaceholder: true` and keep
the original display date in `dateRange`.

`data/steamgame-ddl/sources.json` records the two Steam list pages, source names,
expected markers, adapter ids, and coverage labels. Public export strips any
crawler-only notes before Pages, Hub, or miniprogram data consume the topic.

## Crawler Design

The Steam adapter should be conservative:

1. Fetch each Steam list page with a short timeout and a clear Just-DDL user
   agent.
2. Parse app ids, app titles, app URLs, displayed release dates, and list origin.
3. Deduplicate by Steam app id.
4. Merge the two rails so date-first entries and popular entries can coexist.
5. Prefer full-date countdown items over placeholders for the same app id.
6. Preserve prior valid records if Steam blocks or times out.
7. Cap the first slice at 50 date-first entries and 50 popular-upcoming entries
   before dedupe.

The crawler should not scrape purchase prices, user reviews, account-only data,
or regional personalization.

## UI Design

The existing `game-ddl` page keeps one family page and gains a third topic tab:

- `电竞赛事`
- `游戏版本`
- `Steam 新游`

Steam cards use the same card component and countdown semantics as the current
page. The card label should be transparent:

- `Steam 新游` for the topic.
- `Steam release` for precise release dates.
- `待官方公告` for placeholders.
- `Steam 热门预发布` only for items discovered from the popular-upcoming rail.

The UI must not expose crawler fields, raw errors, parser names, API endpoints,
maintenance cadence, or internal source health messages.

## Validation And Build

The implementation is acceptable only when these local commands pass in the
feature worktree:

```bash
npm run crawl
npm run build
npm run link-check
```

Expected checks:

- `validate-data.mjs` accepts `data/steamgame-ddl/items.json`.
- `export-public-data.mjs` emits `public-data/steamgame-ddl/items.json` and
  `public-data/steamgame-ddl/sources.json`.
- `validate-public-data.mjs` confirms public exports keep user-facing fields and
  remove private maintenance fields.
- `audit-forecasts.mjs` remains compatible with the new topic, even though
  `steamgame-ddl` does not need forecast windows in the first slice.
- `link-check.mjs` includes the new Steam URLs while remaining warning-only for
  Steam automation failures.

## Hub Follow-Up

After the topic repo validates, the Hub repository should register
`steamgame-ddl` as a separate topic card that points to:

- repository: `Just-Agent/game-ddl`
- site: `https://just-agent.github.io/game-ddl/#steamgame-ddl`
- data URL: `https://just-agent.github.io/game-ddl/public-data/steamgame-ddl/items.json`
- source URL: `https://just-agent.github.io/game-ddl/public-data/steamgame-ddl/sources.json`
- source mode: `cluster`
- cluster id: `game-ddl`

The Hub change should be validated with its public-surface, time-semantics, and
build gates before it is considered ready.

## Git And Rollout

The current primary checkout has unrelated dirty files and is diverged from
`origin/main`. Work happens in the isolated worktree branch
`codex/steamgame-ddl` so existing local changes remain untouched.

This design and subsequent implementation should be committed locally only.
Pushing to GitHub requires a separate explicit user instruction.

## Acceptance Criteria

- `steamgame-ddl` appears as a third topic tab on the family page.
- Full Steam release dates produce real countdown cards.
- Ambiguous Steam release text produces placeholders, not fake deadlines.
- The crawler can refresh data or retain previous valid data when Steam is
  temporarily unreachable.
- Raw `data/` may contain maintenance details, but `public-data/` does not.
- Existing `game-ddl` and `game-version-ddl` items still render correctly.
- Local validation commands pass before the feature is reported as complete.
