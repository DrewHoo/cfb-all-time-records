#!/usr/bin/env node
// Championship data fetcher.
//
// Pulls championship data from public sources and emits a JSON file
// the React app can import. Designed so new sources can be added by
// appending to the SOURCES array below — no other code changes.
//
// Usage:
//   node scripts/fetch-data.mjs
//
// Output:
//   src/championshipData.scraped.json
//
// Notes:
//   - Currently only GitHub raw content is reachable from the web sandbox.
//     Wikipedia, sports-reference.com, ncaa.com etc. are all blocked.
//   - When running on a local machine (non-sandboxed), you can add
//     Wikipedia pages directly (see wikipediaTable parser below).

import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_PATH = resolve(__dirname, '..', 'src', 'championshipData.scraped.json');

// --- Source definitions -----------------------------------------------------

const SOURCES = [
  {
    sport: 'mxc', // matches a key in SPORTS in championshipData.js
    name: "Men's Cross Country",
    url: 'https://raw.githubusercontent.com/timfulton1/ncaa_cross_viz/master/01_data/team_champs.csv',
    parser: 'csv',
    yearCol: 'YEAR',
    winnerCol: 'CHAMPION',
    minYear: 1990,
    rename: {
      // Normalize to names matching SCHOOLS in championshipData.js
      'Iowa St.': 'Iowa State',
    },
  },
];

// --- Parsers ----------------------------------------------------------------

function parseCsvLine(line) {
  const fields = [];
  let cur = '';
  let inQuote = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      inQuote = !inQuote;
    } else if (c === ',' && !inQuote) {
      fields.push(cur);
      cur = '';
    } else {
      cur += c;
    }
  }
  fields.push(cur);
  return fields.map((f) => f.trim());
}

function parseCsv(text, { yearCol, winnerCol, minYear = 0, rename = {} }) {
  const lines = text.trim().split(/\r?\n/);
  const header = parseCsvLine(lines[0]);
  const yearIdx = header.indexOf(yearCol);
  const winIdx = header.indexOf(winnerCol);
  if (yearIdx === -1 || winIdx === -1) {
    throw new Error(`CSV missing columns: yearCol=${yearCol}, winnerCol=${winnerCol}`);
  }
  const out = {};
  for (const line of lines.slice(1)) {
    if (!line) continue;
    const fields = parseCsvLine(line);
    const year = Number(fields[yearIdx]);
    let winner = fields[winIdx];
    if (!year || !winner) continue;
    if (year < minYear) continue;
    winner = rename[winner] || winner;
    out[year] = winner;
  }
  return out;
}

// --- Main -------------------------------------------------------------------

// Uses curl instead of Node fetch so it transparently uses whatever
// http proxy the environment already has configured.
function httpGet(url) {
  return execFileSync('curl', ['-sSL', '--fail', '--max-time', '20',
    '-A', 'cfb-all-time-records-scraper/1.0', url], {
    encoding: 'utf8',
    maxBuffer: 20 * 1024 * 1024,
  });
}

async function main() {
  const results = {};
  for (const src of SOURCES) {
    process.stdout.write(`Fetching ${src.sport} (${src.name})... `);
    try {
      const text = httpGet(src.url);
      let data;
      if (src.parser === 'csv') {
        data = parseCsv(text, src);
      } else {
        throw new Error(`Unknown parser: ${src.parser}`);
      }
      results[src.sport] = data;
      const years = Object.keys(data);
      console.log(`OK (${years.length} years, ${years[0]}–${years.at(-1)})`);
    } catch (err) {
      console.log(`FAIL (${err.message})`);
    }
  }

  mkdirSync(dirname(OUT_PATH), { recursive: true });
  writeFileSync(OUT_PATH, JSON.stringify(results, null, 2) + '\n');
  console.log(`\nWrote ${OUT_PATH}`);
  console.log(`${Object.keys(results).length} sport(s) successfully scraped.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
