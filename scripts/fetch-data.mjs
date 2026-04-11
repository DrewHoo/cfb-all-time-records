#!/usr/bin/env node
// Championship data fetcher.
//
// Pulls championship data from public sources and emits a JSON file
// the React app can import. New sources are added by appending to the
// SOURCES array below — no other code changes required.
//
// Usage:
//   node scripts/fetch-data.mjs
//
// Output:
//   src/championshipData.scraped.json

import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import * as cheerio from 'cheerio';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_PATH = resolve(__dirname, '..', 'src', 'championshipData.scraped.json');

// --- Source definitions -----------------------------------------------------
//
// Each entry:
//   sport:     SPORTS key in championshipData.js
//   name:      human label (logs only)
//   url:       page to fetch
//   parser:    'csv' | 'wikipediaTable'
//   minYear:   earliest year to include (default 1990)
//   rename:    { 'Wikipedia Name': 'SCHOOLS-map name' } normalization
//
// wikipediaTable-specific:
//   yearCol:   header text to locate the year column (default /year|season/i)
//   winnerCol: header text to locate the winner column (default /winner|champion/i)
//   tableMatch: optional regex to match the table's caption or nearby heading
//               when multiple wikitables on a page could qualify
//
// csv-specific:
//   yearCol:   exact CSV header name for year
//   winnerCol: exact CSV header name for winner

// Shared rename map used by nearly every Wikipedia source to normalize
// Wikipedia's preferred team names to the keys used in SCHOOLS.
const WIKI_RENAMES = {
  'Connecticut': 'UConn',
  'Southern California': 'USC',
  'Miami (Florida)': 'Miami (FL)',
  'Miami': 'Miami (FL)',
  'Mississippi': 'Ole Miss',
  'NC State': 'NC State',
  "Saint John's": "St. John's",
  "St. John's (NY)": "St. John's",
  'BYU': 'BYU',
  'Brigham Young': 'BYU',
  'UNLV': 'UNLV',
  'Nevada-Las Vegas': 'UNLV',
  'UMass': 'UMass',
  'Massachusetts': 'UMass',
  'UCLA': 'UCLA',
  'USC': 'USC',
};

const SOURCES = [
  {
    sport: 'mxc',
    name: "Men's Cross Country (GitHub CSV)",
    url: 'https://raw.githubusercontent.com/timfulton1/ncaa_cross_viz/master/01_data/team_champs.csv',
    parser: 'csv',
    yearCol: 'YEAR',
    winnerCol: 'CHAMPION',
    minYear: 1990,
    rename: {
      'Iowa St.': 'Iowa State',
    },
  },
  {
    sport: 'mbb',
    name: "Men's Basketball",
    url: 'https://en.wikipedia.org/wiki/List_of_NCAA_Division_I_men%27s_basketball_champions',
    parser: 'wikipediaTable',
    yearCol: 'Year',
    winnerCol: 'Winning team',
    minYear: 1990,
    rename: WIKI_RENAMES,
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

// Cleans a cell's visible text: strips footnote markers, collapses
// whitespace, drops trailing "*" / "†" decorations.
function cellText($, el) {
  const $el = $(el).clone();
  $el.find('sup, .reference, style, script').remove();
  return $el
    .text()
    .replace(/\s+/g, ' ')
    .replace(/\[[^\]]*\]/g, '')
    .trim()
    .replace(/^[*†‡§]+|[*†‡§]+$/g, '')
    .trim();
}

function normalizeHeader(s) {
  return s.replace(/\s+/g, ' ').trim().toLowerCase();
}

function findHeaderIdx(headers, target) {
  if (target instanceof RegExp) {
    return headers.findIndex((h) => target.test(h));
  }
  const t = normalizeHeader(target);
  let idx = headers.indexOf(t);
  if (idx !== -1) return idx;
  return headers.findIndex((h) => h.includes(t));
}

// Parse a <table> into a 2D array of cell objects, expanding rowspan/colspan
// so every logical row has the same number of columns. This is critical for
// Wikipedia champion tables that use rowspan to merge multi-year repeat
// winners (e.g. venue cells spanning several seasons).
function expandTable($, table) {
  const grid = [];
  const rows = $(table).find('tr').toArray();
  const occupied = []; // occupied[rowIdx] = Set<colIdx>
  for (let r = 0; r < rows.length; r++) {
    occupied[r] = occupied[r] || new Set();
    const row = [];
    const cells = $(rows[r]).find('th, td').toArray();
    let c = 0;
    for (const cell of cells) {
      while (occupied[r].has(c)) c++;
      const rowspan = parseInt($(cell).attr('rowspan') || '1', 10);
      const colspan = parseInt($(cell).attr('colspan') || '1', 10);
      const text = cellText($, cell);
      for (let dr = 0; dr < rowspan; dr++) {
        for (let dc = 0; dc < colspan; dc++) {
          const rr = r + dr;
          const cc = c + dc;
          occupied[rr] = occupied[rr] || new Set();
          occupied[rr].add(cc);
          grid[rr] = grid[rr] || [];
          grid[rr][cc] = text;
        }
      }
      c += colspan;
    }
  }
  return grid;
}

// Extract a year number from a cell value like "2019", "2018–19", "2020†",
// "1983*". Returns the later year for ranges (season-end convention), which
// matches the tournament year used throughout championshipData.js.
function extractYear(s) {
  if (!s) return null;
  const m = s.match(/(\d{4})(?:\s*[–\-]\s*(\d{2,4}))?/);
  if (!m) return null;
  const y1 = parseInt(m[1], 10);
  if (!m[2]) return y1;
  let y2 = parseInt(m[2], 10);
  if (y2 < 100) y2 = Math.floor(y1 / 100) * 100 + y2;
  if (y2 < y1) y2 += 100;
  return y2;
}

// Extract a clean school name from a winner cell. Strips trailing footnote
// markers, qualifiers like "(vacated)", and collapses "Team A / Team B" or
// "Team A & Team B" co-champions to the first team (rare; we note these).
function extractWinner(s) {
  if (!s) return null;
  // Drop explanatory cells that clearly aren't team names. Wikipedia writes
  // full sentences into the winner cell when a championship was cancelled.
  if (/cancel|pandemic|not held|covid|suspend/i.test(s)) return null;
  let out = s
    .replace(/\(.*?\)/g, '')
    .replace(/\s*\/.*/, '')
    .replace(/\s*&.*/, '')
    .replace(/\bvacated\b/i, '')
    .replace(/\bshared\b/i, '')
    .trim()
    .replace(/^[*†‡§]+|[*†‡§]+$/g, '')
    .trim();
  if (!out) return null;
  // Real school names are short. If we somehow kept a sentence, drop it.
  if (out.length > 35 || out.split(/\s+/).length > 5) return null;
  return out;
}

function parseWikipediaTable(html, opts = {}) {
  const {
    yearCol = /year|season/i,
    winnerCol = /winning team|winner|champion/i,
    minYear = 1990,
    maxYear = new Date().getFullYear(),
    rename = {},
    tableMatch,
  } = opts;

  const $ = cheerio.load(html);
  const tables = $('table.wikitable').toArray();
  if (!tables.length) throw new Error('no wikitable found on page');

  // Find the best matching table. A table matches if it has both a year
  // column and a winner column in its header row, and (if tableMatch is set)
  // its caption matches.
  let chosen = null;
  let chosenHeaders = null;
  for (const t of tables) {
    const grid = expandTable($, t);
    if (!grid.length) continue;
    const headers = grid[0].map((h) => normalizeHeader(h || ''));
    const yi = findHeaderIdx(headers, yearCol);
    const wi = findHeaderIdx(headers, winnerCol);
    if (yi === -1 || wi === -1) continue;
    if (tableMatch) {
      const caption = $(t).find('caption').text();
      if (!tableMatch.test(caption)) continue;
    }
    chosen = grid;
    chosenHeaders = headers;
    break;
  }
  if (!chosen) throw new Error('no wikitable with matching year/winner columns');

  const yi = findHeaderIdx(chosenHeaders, yearCol);
  const wi = findHeaderIdx(chosenHeaders, winnerCol);

  const out = {};
  for (let r = 1; r < chosen.length; r++) {
    const row = chosen[r];
    if (!row) continue;
    const year = extractYear(row[yi] || '');
    const winnerRaw = extractWinner(row[wi] || '');
    if (!year || !winnerRaw) continue;
    if (year < minYear || year > maxYear) continue;
    const winner = rename[winnerRaw] || winnerRaw;
    out[year] = winner;
  }
  return out;
}

// --- Main -------------------------------------------------------------------

function httpGet(url) {
  return execFileSync(
    'curl',
    [
      '-sSL',
      '--fail',
      '--max-time',
      '30',
      '-A',
      'cfb-all-time-records-scraper/1.0 (+github.com/anthropic)',
      url,
    ],
    { encoding: 'utf8', maxBuffer: 40 * 1024 * 1024 },
  );
}

async function main() {
  const results = {};
  for (const src of SOURCES) {
    process.stdout.write(`Fetching ${src.sport.padEnd(10)} (${src.name})... `);
    try {
      const text = httpGet(src.url);
      let data;
      if (src.parser === 'csv') {
        data = parseCsv(text, src);
      } else if (src.parser === 'wikipediaTable') {
        data = parseWikipediaTable(text, src);
      } else {
        throw new Error(`unknown parser: ${src.parser}`);
      }
      results[src.sport] = data;
      const years = Object.keys(data).sort();
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
