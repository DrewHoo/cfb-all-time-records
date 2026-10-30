# CFB All-Time Records

All 136 FBS football programs on one board, in the house style the drewhoover.com sports sites share: built with React + Vite, prerendered at build, deployed to GitHub Pages with a Cloudflare share worker in front.

**Live site:** https://drewhoover.com/cfb-all-time-records/

[![Ko-fi](https://img.shields.io/badge/Ko--fi-buy%20me%20a%20coffee-857a75)](https://ko-fi.com/drewhooverdotcom)

## The page

`src/FootballRecords.jsx`: the sentence picks the conference and the measure (all-time wins, win percentage, bowl wins, bowl win percentage, claimed or total national titles, seasons, losses), the rows rank by it with competition ranks, and a program opens inline under its row. `?sort=`, `?conf=` and `?t=<slug>` carry the board and the open program; the defaults are omitted so equivalent addresses read the same.

- `src/lib/football.js` — the data, the measures, the URL codec and the ranking; pure, shared by the page, the prerender, the card generator and the worker.
- `src/lib/share.js` — the one place the sentence, the claim, the tab title, the description and the card rows are worded.
- `src/components/` — the Radix `Picker`, the `SchoolPicker` finder (a vaul sheet on phones), the dateline icon bar, the notes and footer; `src/styles.css` carries the eight tokens and the type.

The championship grid that used to share this repo lives on as [collegiate-championships](https://drewhoover.com/collegiate-championships/) (1972 on, 33 sports); the worker sends the old `?s=` addresses there, and the board's old `/football.html` address to the root.

## Build

```bash
npm install
npm run dev        # http://localhost:5173/cfb-all-time-records/
npm run build      # vite build, then scripts/prerender.mjs bakes the markup, JSON-LD, the embeds and the sitemap into dist/
npm run preview    # serves dist/ at http://localhost:4173/cfb-all-time-records/
```

The prerender is what crawlers and unfurlers see; `src/main.jsx` hydrates onto it. Nothing reads `window` during render: the URL is applied once after mount, so the first client render matches the prerendered page.

## Share images

- `npm run gen:og` (on a Mac: the title is Georgia Bold from the system) draws `public/og.png` (1200×630) and `public/card.png` (1200×750, the 8:5 cover the index site's sports list shows) from the top of the default board, text as glyph outlines through opentype.js. Committed; re-run after a redesign or a data refresh worth committing.
- `workers/share/` is a Cloudflare Worker on `drewhoover.com/cfb-all-time-records/*` in front of Pages. For an address that says more than the root (`?sort=`, `?conf=`, `?t=`) it rewrites the `<head>` with the site's own words and points `og:image` at `share/og.png?…`, which it draws on demand with workers-og (the top of the board, the open program swapped in and lit) and caches at the edge. Crawler fetches are counted in Mixpanel as `share unfurl` and `share card`. Anything else, and anything that fails, passes through untouched.

```bash
npm run build && npm run preview       # the origin the worker proxies locally
npm run worker:dev                     # http://localhost:8787/cfb-all-time-records/share/og.png?sort=winPct&conf=SEC&t=alabama
npm run worker:deploy                  # by hand; deploy.yml does it after every push to main (CLOUDFLARE_API_TOKEN secret)
```

Bump `CARD_VERSION` in `workers/share/index.ts` whenever the card or the URL reading changes; it keys the edge cache.

## Data

Each program's record is the NCAA's count: vacated wins out, forfeits to the team awarded them, seasons below the top division in.

- `src/data/eras.json` (written by `node scripts/build-seasons.mjs`): each program's NCAA total through 2024, from Wikipedia's [FBS win-loss table](https://en.wikipedia.org/w/index.php?title=NCAA_Division_I_FBS_football_win%E2%80%93loss_records&oldid=1304394366) at its last revision before the 2025 season (CC BY-SA 4.0), and its record in every season from its first through 2024 and its bowls by season through 2025, so the board counts from any year (`node scripts/lib/eras.mjs` rewrites it from `data/seasons.json`). The table was updated only through week 3 of 2025 after that, so nothing reads it past 2024.
- `src/data/current.json` (`node scripts/build-current.mjs`): every season after 2024, counted from [College Football Streak King](https://drewhoover.com/cfb-streak-king/)'s games, and every bowl after 2025 (the payload's postseason games: bowls and the playoff, first-round campus games included, not conference title games, which agrees with the bowl page's 2025 rows for all 136 programs). The deploy workflow checks every day at 19:00 and 23:00 UTC, August through January, and rebuilds only when Streak King's payload `builtAt` differs from the live board's (`dist/current.json`), so the board follows Streak King's refreshes (Thursday, Friday and Sunday, and every day in December and January) through the postseason without a schedule of its own.
- `src/data/football.json`: each program's conference, ESPN id and slug from Wikipedia's [list of FBS football programs](https://en.wikipedia.org/wiki/List_of_NCAA_Division_I_FBS_football_programs), its bowl record from the [list of FBS bowl records](https://en.wikipedia.org/wiki/List_of_NCAA_Division_I_FBS_football_bowl_records) and its national titles, through the 2025 season. When the bowl page is read again and `through` moves, `current.json` stops counting that season's bowls by itself.

The season-by-season records behind the eras (`data/seasons.json`) join Streak King's games (every top-division season from 1936), each program's "List of … football seasons" on Wikipedia (`data/season-pages.json` pins the revision of each), and James Howell's all-time scores (early ties a list drops, and the bowls by season), under `data/season-rulings.json`: forfeits, vacated wins, missing seasons and seasons the NCAA doesn't count, each with its receipts. The build fails unless each program's seasons sum to its NCAA total within a few games, or a ruling says why not; what no season carries is `unplaced` and counts all time only. Run it by hand when a source changes:

```bash
node scripts/build-seasons.mjs --fetch          # the live Streak King payload; saved pages under data/build/ (not committed)
node scripts/build-current.mjs
```

It reads Howell's pages from a cfb-streak-king checkout beside this one (`--howell <dir>` to point elsewhere). `data/build/review.txt` lists every season where the list and the games disagree, with the list's footnotes, for writing a ruling.

The color marks in `public/logos-color/` are the same set Streak King carries. Win percentage counts a tie as half a win; claimed titles are the school's own count, unclaimed selections the seasons a recognized selector named it champion.

## Deployment

Pushes to `main` run `.github/workflows/deploy.yml`: build and prerender, publish `dist/` to GitHub Pages, then deploy the share worker. The Vite `base` is `/cfb-all-time-records/` in `vite.config.js`.
