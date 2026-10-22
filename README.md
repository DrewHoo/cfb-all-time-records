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

`src/data/football.json`: Wikipedia's [list of FBS football programs](https://en.wikipedia.org/wiki/List_of_NCAA_Division_I_FBS_football_programs) (CC BY-SA 4.0) through the 2025 season, with each program's ESPN id and slug. The color marks in `public/logos-color/` are the same set Streak King carries. Win percentage counts a tie as half a win; claimed titles are the school's own count, unclaimed selections the seasons a recognized selector named it champion.

## Deployment

Pushes to `main` run `.github/workflows/deploy.yml`: build and prerender, publish `dist/` to GitHub Pages, then deploy the share worker. The Vite `base` is `/cfb-all-time-records/` in `vite.config.js`.
