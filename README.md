# CFB All-Time Records

Two pages of NCAA Division I history in the house style the drewhoover.com sports sites share, built with React + Vite, prerendered at build, deployed to GitHub Pages with a Cloudflare share worker in front.

**Live site:** https://drewhoover.com/cfb-all-time-records/

[![Ko-fi](https://img.shields.io/badge/Ko--fi-buy%20me%20a%20coffee-857a75)](https://ko-fi.com/drewhooverdotcom)

## What's here

- **Championship grid** (`/`, `src/ChampionshipGrid.jsx`) — every NCAA Division I national champion in 30 sports from 1990 on, one school mark per title. The board rests monochrome; a school picked or hovered lights every title it has won in its own colors. A leaderboard beside it ranks every school by titles. `?s=School` (repeatable) carries the picked schools.
- **FBS all-time records** (`/football.html`, `src/FootballRecords.jsx`) — all 136 current FBS programs ranked by the measure in the sentence (all-time wins, win percentage, bowl wins, bowl win percentage, claimed or total national titles, seasons, losses), by conference. A program opens inline under its row. `?sort=`, `?conf=` and `?t=<slug>` carry the board and the open program.

Both pages share `src/styles.css` (the eight tokens, Georgia Bold titles, Graduate numbers, Source Serif words, Plex Mono labels), `src/components/` (the Radix `Picker`, the `SchoolPicker` finder with a vaul sheet on phones, the dateline icon bar, the notes and footer) and the pure modules in `src/lib/` (`champs.js`, `football.js`, the URL codecs, and `share.js`, the one place the titles, descriptions, share text and card rows are worded).

## Build

```bash
npm install
npm run dev        # http://localhost:5173/cfb-all-time-records/
npm run build      # vite build, then scripts/prerender.mjs bakes both pages' markup, JSON-LD, the embeds and the sitemap into dist/
npm run preview    # serves dist/ at http://localhost:4173/cfb-all-time-records/
```

The prerender is what crawlers and unfurlers see; `main.jsx` and `football-main.jsx` hydrate onto it. Nothing reads `window` during render: the URL is applied once after mount, so the first client render matches the prerendered page.

## Share images

- `npm run gen:og` (on a Mac: the title is Georgia Bold from the system) draws `public/og.png` (the grid, 1200×630), `public/card.png` (the grid at 8:5, the index site's project card) and `public/og-football.png` (the top of the records board) from the real data, text as glyph outlines through opentype.js. Committed; re-run after a redesign or a data refresh worth committing.
- `workers/share/` is a Cloudflare Worker on `drewhoover.com/cfb-all-time-records/*` in front of Pages. For an address that says more than the root (`?s=`, `?sort=`, `?conf=`, `?t=`) it rewrites the `<head>` with the site's own words and points `og:image` at `share/og.png?…`, which it draws on demand with workers-og (a school's titles by sport, several schools side by side, or the top of a ranked board with the open program lit) and caches at the edge. Crawler fetches are counted in Mixpanel as `share unfurl` and `share card`. Anything else, and anything that fails, passes through untouched.

```bash
npm run build && npm run preview       # the origin the worker proxies locally
npm run worker:dev                     # http://localhost:8787/cfb-all-time-records/share/og.png?s=Stanford
npm run worker:deploy                  # by hand; deploy.yml does it after every push to main (needs the CLOUDFLARE_API_TOKEN secret)
```

Bump `CARD_VERSION` in `workers/share/index.ts` whenever the card or the URL reading changes; it keys the edge cache.

## Data

### Championship grid

Scraped from Wikipedia by `scripts/fetch-data.mjs` into `src/championshipData.scraped.json`, which `src/championshipData.js` (the sport list, the school map with ESPN ids and colors) imports. To refresh:

```bash
node scripts/fetch-data.mjs
```

The scraper parses `<table class="wikitable">` elements on each sport's page, expanding `rowspan`/`colspan`, merging multi-era tables, normalizing names through a shared rename map; football collapses the consensus-champions table to one winner per year (CFP > BCS > AP > Coaches). Adding a sport is one entry in `SOURCES`. `scripts/diff_scraped.mjs`, `scripts/reconcile.mjs` and `scripts/gen_champs.mjs` diff, reconcile and regenerate after a re-scrape.

The resting marks are one-color stamps baked by `npm run gen:mono` into `public/logos/mono/` (ink density from darkness or saturation, ported from Hostile Territory), with `src/monoLogos.json` listing which exist. Run it after adding a school. The sport-header icons are Fluent Emoji High Contrast (MIT, `public/icons/LICENSE`).

### FBS records

`src/data/football.json`: Wikipedia's [list of FBS football programs](https://en.wikipedia.org/wiki/List_of_NCAA_Division_I_FBS_football_programs) (CC BY-SA 4.0) through the 2025 season, with each program's ESPN id and slug. The color marks in `public/logos-color/` are the same set Streak King carries.

## Deployment

Pushes to `main` run `.github/workflows/deploy.yml`: build and prerender, publish `dist/` to GitHub Pages, then deploy the share worker. The Vite `base` is `/cfb-all-time-records/` in `vite.config.js`.
