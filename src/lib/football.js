// The FBS records board: the data, the words each sort goes by, the URL
// codec and the ranking. Pure (no window, no React) so the prerender, the
// share worker and the page all rank the same way.
import file from '../data/football.json';
import eras from '../data/eras.json';
import current from '../data/current.json';

/** the season the titles and Wikipedia's bowl page run through; every bowl since is counted from the games */
export const BASE_SEASON = file.through;
export const SOURCE_URL = file.source;
export const BOWL_SOURCE_URL = file.bowlSource;
/** the NCAA's totals through RECORDS_THROUGH: Wikipedia's win-loss table at its revision before the next season */
export const RECORDS_SOURCE_URL = file.recordsSource;
/** the season the NCAA's totals run through; every season since is counted from the games */
export const RECORDS_THROUGH = eras.through;
/** the running season, from Streak King's games (scripts/build-current.mjs) */
export const SEASON = current.season;
/** the running season's latest game, "October 24, 2026"; null before its first */
export const LATEST = current.through
  ? new Date(`${current.through}T12:00:00Z`).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
  : null;
/** what the wins and losses run through: "October 24, 2026", or the last finished season before the running season's first game */
export const THROUGH = LATEST ?? String(SEASON - 1);
/** the running season's own record, by slug */
export const seasonOf = (t) => { const [w, l, ti] = current.teams[t.slug]?.[SEASON] ?? [0, 0, 0]; return { w, l, t: ti }; };

/** where an era can start, and what changed that year */
export const ERAS = [
  { year: 1912, hint: 'modern rules' },
  { year: 1936, hint: 'AP poll' },
  { year: 1978, hint: 'Division I-A' },
  { year: 1998, hint: 'BCS' },
  { year: 2014, hint: 'playoff' },
];
export const ERA_YEARS = ERAS.map((e) => e.year);

const pct = (w, l, t) => (w + l + t ? Math.round(((w + t / 2) / (w + l + t)) * 1000) / 1000 : null);
/**
 * A program's numbers from an era's first season on (all time without one):
 * the NCAA's total through 2024 or the era's seasons, plus every season since
 * from the games (a season with a game played is a season played); the bowls
 * through the bowl page's season plus every postseason game since; the titles
 * through the bowl page's season.
 */
function view(t, since) {
  const e = eras.teams[t.slug];
  const [w0, l0, t0, y0, bw, bl, bt] = since ? e.eras[since] : [...e.base, t.bowlWins, t.bowlLosses, t.bowlTies];
  let wins = w0, losses = l0, ties = t0, years = y0, bowlWins = bw, bowlLosses = bl, bowlTies = bt;
  for (const y of current.seasons) {
    const [w, l, ti] = current.teams[t.slug][y];
    if (w + l + ti === 0) continue;
    wins += w; losses += l; ties += ti; years++;
  }
  for (const y of current.bowlSeasons ?? []) {
    const [w, l, ti] = current.bowls[t.slug][y];
    bowlWins += w; bowlLosses += l; bowlTies += ti;
  }
  const after = (ys) => (since ? ys.filter((y) => y >= since) : ys);
  const claimedYears = after(t.claimedYears), unclaimedYears = after(t.unclaimedYears);
  return {
    ...t, since,
    wins, losses, ties, years, winPct: pct(wins, losses, ties),
    bowlWins, bowlLosses, bowlTies, bowlPct: pct(bowlWins, bowlLosses, bowlTies),
    claimedYears, unclaimedYears,
    claimedNatChamps: claimedYears.length, unclaimedNatChamps: unclaimedYears.length, totalNatChamps: claimedYears.length + unclaimedYears.length,
  };
}
/** every current FBS program, all time */
export const TEAMS = file.teams.map((t) => view(t, null));
const BY_ERA = new Map([[null, TEAMS], ...ERA_YEARS.map((y) => [y, file.teams.map((t) => view(t, y))])]);
/** the programs as an era counts them */
export const teamsSince = (since) => BY_ERA.get(since ?? null);
export const teamBySlug = (slug, since = null) => teamsSince(since).find((t) => t.slug === slug) ?? null;

const int = (n) => n.toLocaleString('en-US');
/** .732, the way a baseball average reads */
export const pctText = (p) => (p == null ? '—' : p.toFixed(3).replace(/^0/, ''));
export const recordText = (t) => `${int(t.wins)}–${int(t.losses)}${t.ties ? `–${t.ties}` : ''}`;
/** this season's record so far, "4–3" */
export const seasonText = (t) => { const c = seasonOf(t); return `${c.w}–${c.l}${c.t ? `–${c.t}` : ''}`; };
export const bowlText = (t) => (t.bowlWins + t.bowlLosses + t.bowlTies === 0 ? 'no bowls' : `${t.bowlWins}–${t.bowlLosses}${t.bowlTies ? `–${t.bowlTies}` : ''}`);

/** " since 1978", or nothing all time */
export const eraText = (since) => (since ? ` since ${since}` : '');
/** "all time", "since 1978": the era picker's word */
export const eraLabel = (since) => (since ? `since ${since}` : 'all time');
/**
 * What a program can be ranked by: the word in the sentence's picker, the
 * noun a claim uses (all time, "all-time wins"; in an era, "wins since 1978"),
 * how its value prints, and the claim's verb phrase.
 */
export const SORTS = {
  wins: { label: 'wins', allTime: 'all-time wins', fmt: int, says: (t, v) => `has ${int(v)} ${t.since ? `wins since ${t.since}` : 'all-time wins'} (${recordText(t)})` },
  winPct: { label: 'win percentage', fmt: pctText, says: (t, v) => `has won ${pctText(v)} of its games${eraText(t.since)} (${recordText(t)})` },
  bowlWins: { label: 'bowl wins', fmt: int, says: (t, v) => `has ${int(v)} bowl win${v === 1 ? '' : 's'}${eraText(t.since)} (${bowlText(t)})` },
  bowlPct: { label: 'bowl win percentage', fmt: pctText, says: (t, v) => `has won ${pctText(v)} of its bowls${eraText(t.since)} (${bowlText(t)})` },
  claimedNatChamps: { label: 'claimed national titles', fmt: int, says: (t, v) => `claims ${int(v)} national title${v === 1 ? '' : 's'}${eraText(t.since)}` },
  totalNatChamps: { label: 'national titles, claimed or not', fmt: int, says: (t, v) => `has ${int(v)} national title${v === 1 ? '' : 's'}${eraText(t.since)}, claimed or not` },
  years: { label: 'seasons played', fmt: int, says: (t, v) => `has played ${int(v)} seasons${eraText(t.since)}` },
  losses: { label: 'losses', allTime: 'all-time losses', fmt: int, says: (t, v) => `has ${int(v)} ${t.since ? `losses since ${t.since}` : 'all-time losses'} (${recordText(t)})` },
};
export const SORT_KEYS = Object.keys(SORTS);
/** the measure in words: "all-time wins", "wins since 1978", "win percentage since 1978" */
export const measure = (sort, since) => (since ? `${SORTS[sort].label} since ${since}` : SORTS[sort].allTime ?? SORTS[sort].label);

export const CONFERENCES = [...new Set(TEAMS.map((t) => t.conference))].sort();
export const confCount = (conf) => TEAMS.filter((t) => t.conference === conf).length;

export const DEFAULT = { sort: 'wins', conf: null, since: null, t: null };

/** ?sort=winPct&since=1978&conf=SEC&t=alabama; anything the data doesn't know falls back to the default */
export function parseUrl(search) {
  const p = new URLSearchParams(search);
  const sort = p.get('sort');
  const conf = p.get('conf');
  const since = Number(p.get('since'));
  const t = p.get('t');
  return {
    sort: sort && SORTS[sort] ? sort : DEFAULT.sort,
    conf: conf && CONFERENCES.includes(conf) ? conf : null,
    since: ERA_YEARS.includes(since) ? since : null,
    t: t && teamBySlug(t) ? t : null,
  };
}
/** the defaults are omitted, so equivalent addresses read the same */
export function toUrl(q) {
  const p = new URLSearchParams();
  if (q.sort !== DEFAULT.sort) p.set('sort', q.sort);
  if (q.since) p.set('since', String(q.since));
  if (q.conf) p.set('conf', q.conf);
  if (q.t) p.set('t', q.t);
  const s = p.toString();
  return s ? `?${s}` : '';
}
export const isShared = (q) => q.sort !== DEFAULT.sort || !!q.conf || !!q.since || !!q.t;

/**
 * The board: the conference's programs (all of them without one) ranked by
 * the sort, competition ranks (equal values share a rank), ties broken for
 * order only by name. A program with no value for the sort (no bowl games
 * under bowl win percentage) sits at the bottom with no rank.
 */
export function evaluate(q) {
  const all = teamsSince(q.since);
  const pool = q.conf ? all.filter((t) => t.conference === q.conf) : all;
  const val = (t) => t[q.sort];
  const sorted = [...pool].sort((a, b) => {
    const av = val(a), bv = val(b);
    if (av == null && bv == null) return a.name.localeCompare(b.name);
    if (av == null) return 1;
    if (bv == null) return -1;
    return bv - av || a.name.localeCompare(b.name);
  });
  const rows = [];
  let rank = 0;
  sorted.forEach((team, i) => {
    const value = val(team);
    if (value == null) { rows.push({ team, rank: null, tied: false, value: null }); return; }
    if (i === 0 || value !== val(sorted[i - 1])) rank = i + 1;
    const tied = (i > 0 && val(sorted[i - 1]) === value) || (i + 1 < sorted.length && val(sorted[i + 1]) === value);
    rows.push({ team, rank, tied, value });
  });
  return { rows, total: pool.length, sort: q.sort, conf: q.conf, since: q.since ?? null };
}
export const rankText = (r) => (r.rank == null ? '—' : `${r.tied ? 'T' : ''}${r.rank}`);
export const ordinal = (n) => `${n}${['th', 'st', 'nd', 'rd'][(n % 100 > 10 && n % 100 < 14) || n % 10 > 3 ? 0 : n % 10]}`;
