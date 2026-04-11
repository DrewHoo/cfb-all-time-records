# CFB All-Time Records

Two interactive views of NCAA Division I college sports history, built with React + Vite and deployed to GitHub Pages.

**Live site:** https://drewhoo.github.io/cfb-all-time-records/

## What's here

- **Championship grid** (`index.html`) — every NCAA Division I national champion in 23 sports from 1990 to present, as a hoverable grid of team logos. Hover any cell to highlight every other championship won by that school across all sports and years.
- **Football records table** (`football.html`) — all-time win/loss records, bowl records, and national titles for all 136 current FBS programs through the 2025 season.

## Data sources

### Championship grid

Championship data is scraped from Wikipedia by `scripts/fetch-data.mjs` and written to `src/championshipData.scraped.json`, which `src/championshipData.js` imports at build time. To refresh the data:

```bash
node scripts/fetch-data.mjs
```

The scraper uses cheerio to parse `<table class="wikitable">` elements on each sport's Wikipedia page, expanding `rowspan`/`colspan` so multi-row headers resolve correctly, merging data from multi-era tables (tennis, golf, swimming) on the same page, and normalizing team names via a shared rename map. Football is handled by a dedicated parser that collapses the NCAA FBS consensus champions table — which lists one row per (year, selector) pair — into a single winner per year, preferring CFP > BCS > AP > Coaches. A handful of GitHub-hosted CSVs are used where Wikipedia coverage is spotty (currently just Men's Cross Country).

Adding a new sport is a matter of appending one entry to the `SOURCES` array in `scripts/fetch-data.mjs` — URL, parser type (`wikipediaTable`, `footballConsensus`, or `csv`), and optional `yearCol` / `winnerCol` / `rename` hints — and re-running the scraper.

Three helper scripts sit alongside the main scraper:

- `scripts/diff_scraped.mjs` — diffs the scraped JSON against whatever is currently in `championshipData.js`, useful after a re-scrape to see what changed upstream on Wikipedia.
- `scripts/reconcile.mjs` — merges scraped and memory data and reports any schools referenced in the merged result that are missing from the `SCHOOLS` map in `championshipData.js`.
- `scripts/gen_champs.mjs` — regenerates the `CHAMPIONSHIPS` block in `championshipData.js` after a re-scrape.

### Football records table

Sourced from Wikipedia through the 2025 season; data lives in `src/App.jsx`.

## Local development

```bash
npm install
npm run dev
```

Dev server opens at `http://localhost:5173/cfb-all-time-records/`.

## Deployment

Pushes to `main` trigger `.github/workflows/deploy.yml`, which runs `npm run build` and publishes `./dist` to GitHub Pages. The Vite `base` is set to `/cfb-all-time-records/` in `vite.config.js` — if you fork this, update that to match your repo name.
