# 电竞赛事 DDL

> Just-DDL Network 独立专题仓库。默认中文展示，英文版本后续由 Hub 手动切换。

英雄联盟、王者荣耀、VALORANT、Dota 2、CS2 与电竞世界杯等赛事赛历和报名/开赛节点。

## 专题数据

- Hub: https://just-agent.github.io/just-ddl/#/topic/game-ddl
- Pages: https://just-agent.github.io/game-ddl/
- Repository: https://github.com/Just-Agent/game-ddl
- 当前条目: 16
- 来源族: 9

## 子专题

- CS2: 3 条
- VALORANT: 1 条
- 王者荣耀: 4 条
- Dota 2: 2 条
- 英雄联盟: 5 条
- 综合电竞: 1 条

## 数据链路

- `data/items.json`: 已发布 DDL 条目，每条含倒计时 deadline、来源 URL、子专题字段。
- `data/sources.json`: 官方/主办方/权威聚合来源清单。
- `scripts/crawl-sources.mjs`: source-specific crawler，会按来源类型执行不同 adapter 并写入 crawl report。
- `scripts/validate-data.mjs`: 校验必填字段、重复 id、deadline 与 URL 格式。
- `scripts/link-check.mjs`: 链接检查，默认 warning-only；设置 `STRICT_LINK_CHECK=1` 后切换严格模式。
- `.github/workflows/update-data.yml`: Node 24 定时 crawler + validator + link-check，成功后主动通知 Hub 同步。
- `.github/workflows/deploy-pages.yml`: GitHub Pages 静态发布。

## 来源

- BLAST / PGL Event Listing: https://blast.tv/cs/tournaments/pgl-singapore-major-2026
- ESL Pro Tour: https://pro.eslgaming.com/tour/csgo/cologne
- Esports Nations Cup: https://esportsnationscup.com/en/press-releases/enc-adds-honor-of-kings-to-the-games-lineup
- Esports World Cup: https://esportsworldcup.com/en/news/ewc26-confirms-the-return-of-20-games
- Esports World Cup: https://www.esportsworldcup.com/en/news/cs2-locked-in-for-ewc-2026-2027
- LoL Esports: https://lolesports.com/en-US/news/lcs-spring-finals-heads-to-asu-at-mullett-arena
- LoL Esports: https://lolesports.com/en-US/news/msi-and-worlds-updates
- THESPIKE.GG Event Listing: https://www.thespike.gg/events/valorant-champions-tour-2026-masters-london-2026/4148
- Valve / Dota 2: https://cdn.cloudflare.steamstatic.com/apps/dota2/assets/RFP_TI_2026.pdf

## 贡献

新增条目请优先提交官方/主办方链接；暂时没有详情页时，可以先登记权威聚合来源，并在 description 中说明“精确赛程发布后拆分”。

微信小程序版本即将上线，敬请期待。
