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
/** where a board can stop short of today, and what came next */
export const ENDS = [
  { year: 2013, hint: 'before the playoff' },
  { year: 1997, hint: 'before the BCS' },
  { year: 1977, hint: 'before Division I-A' },
  { year: 1935, hint: 'before the AP poll' },
];
/** the first season any program played, and the latest a board can count from: any year between, typed in */
export const FIRST_SEASON = Math.min(...Object.values(eras.teams).map((e) => e.first));
export const isSince = (y) => Number.isInteger(y) && y > FIRST_SEASON && y <= SEASON;
/** the latest season with a game played; a board can stop at any season before it */
export const LAST_PLAYED = LATEST ? SEASON : SEASON - 1;
export const isUntil = (y) => Number.isInteger(y) && y > FIRST_SEASON && y < LAST_PLAYED;

/** which games count: every game, the regular season (every game but the bowls and the playoff), or the bowls and the playoff */
export const GAMES = {
  all: { label: 'every game', noun: '', games: 'games' },
  reg: { label: 'regular-season games', hint: 'no bowls or playoff', noun: 'regular-season ', games: 'regular-season games' },
  bowl: { label: 'bowl games', hint: 'the playoff too', noun: 'bowl ', games: 'bowls' },
};
export const GAME_KEYS = Object.keys(GAMES);
/** the sorts the games choice changes; the titles and the seasons count every game */
export const gamesApply = (sort) => sort === 'wins' || sort === 'winPct' || sort === 'losses';
const gamesOf = (q) => (gamesApply(q.sort) ? q.games ?? 'all' : 'all');

const pct = (w, l, t) => (w + l + t ? Math.round(((w + t / 2) / (w + l + t)) * 1000) / 1000 : null);
const rec = ([w, l, t]) => ({ wins: w, losses: l, ties: t, winPct: pct(w, l, t) });
const add = (a, r) => { a[0] += r[0]; a[1] += r[1]; a[2] += r[2]; };
const less = (a, b) => a.map((n, i) => Math.max(0, n - b[i]));
const inSpan = (y, since, until) => (!since || y >= since) && (!until || y <= until);
/**
 * A program's numbers from since through until (all time without either),
 * counting the games chosen. All time: the NCAA's total through 2024 plus
 * every season since from the games (a season with a game played is a season
 * played), and the bowls through the bowl page's season plus every postseason
 * game since. With a year: the program's seasons in the span, and its bowls by
 * season. The regular season is the record less the bowls, season by season
 * (never below zero where the NCAA vacated a bowl win the bowl list keeps).
 * The titles run through the bowl page's season.
 */
function view(t, since, until, games) {
  const e = eras.teams[t.slug], cur = current.teams[t.slug];
  const all = [0, 0, 0], bowl = [0, 0, 0], reg = [0, 0, 0];
  let years = 0;
  if (!since && !until) {
    add(all, e.base); years = e.base[3];
    add(bowl, [t.bowlWins, t.bowlLosses, t.bowlTies]);
    for (const y of current.seasons) { const r = cur[y]; if (r[0] + r[1] + r[2]) { add(all, r); years++; } }
    for (const y of current.bowlSeasons ?? []) add(bowl, current.bowls[t.slug][y]);
    add(reg, less(all, bowl));
  } else {
    const season = (y, r) => {
      if (!r || !inSpan(y, since, until)) return;
      const b = e.bowls[y] ?? current.bowls?.[t.slug]?.[y] ?? [0, 0, 0];
      add(all, r); add(bowl, b); add(reg, less(r, b)); years++;
    };
    e.seasons.forEach((r, i) => season(e.first + i, r));
    for (const y of current.seasons) { const r = cur[y]; if (r[0] + r[1] + r[2]) season(y, r); }
  }
  const claimedYears = t.claimedYears.filter((y) => inSpan(y, since, until));
  const unclaimedYears = t.unclaimedYears.filter((y) => inSpan(y, since, until));
  const b = rec(bowl);
  return {
    ...t, since, until, games,
    ...rec({ all, reg, bowl }[games]), years,
    every: rec(all),
    bowlWins: b.wins, bowlLosses: b.losses, bowlTies: b.ties, bowlPct: b.winPct,
    claimedYears, unclaimedYears,
    claimedNatChamps: claimedYears.length, unclaimedNatChamps: unclaimedYears.length, totalNatChamps: claimedYears.length + unclaimedYears.length,
  };
}
/** every current FBS program, all time, every game */
export const TEAMS = file.teams.map((t) => view(t, null, null, 'all'));
const VIEWS = new Map([['null null all', TEAMS]]);
/** the programs as a board counts them: its span and its games (worked out once each) */
export const teamsFor = ({ since = null, until = null, games = 'all' } = {}) => {
  const key = `${since} ${until} ${games}`;
  if (!VIEWS.has(key)) VIEWS.set(key, file.teams.map((t) => view(t, since, until, games)));
  return VIEWS.get(key);
};
export const teamBySlug = (slug, q) => teamsFor(q).find((t) => t.slug === slug) ?? null;

const int = (n) => n.toLocaleString('en-US');
/** .732, the way a baseball average reads */
export const pctText = (p) => (p == null ? '—' : p.toFixed(3).replace(/^0/, ''));
export const recordText = (t) => `${int(t.wins)}–${int(t.losses)}${t.ties ? `–${t.ties}` : ''}`;
/** this season's record so far, "4–3" */
export const seasonText = (t) => { const c = seasonOf(t); return `${c.w}–${c.l}${c.t ? `–${c.t}` : ''}`; };
export const bowlText = (t) => (t.bowlWins + t.bowlLosses + t.bowlTies === 0 ? 'no bowls' : `${t.bowlWins}–${t.bowlLosses}${t.bowlTies ? `–${t.bowlTies}` : ''}`);

/** " since 1978", " from 1950 through 1990", " in 1990", " through 1997", or nothing all time */
export const spanText = (since, until) =>
  since && until ? (since === until ? ` in ${since}` : ` from ${since} through ${until}`) : since ? ` since ${since}` : until ? ` through ${until}` : '';
/** "all time", "since 1978": the start picker's word */
export const eraLabel = (since) => (since ? `since ${since}` : 'all time');
/** "through October 24, 2026", "through 1997": the end picker's word */
export const endLabel = (until) => `through ${until ?? THROUGH}`;
/**
 * What a program can be ranked by: the word in the sentence's picker, whether
 * all time says "all-time" before it, and the claim's verb phrase (m is the
 * measure in words, "regular-season wins since 1978").
 */
export const SORTS = {
  wins: { label: 'wins', allTime: true, fmt: int, says: (t, v, m) => `has ${int(v)} ${m} (${recordText(t)})` },
  winPct: { label: 'win percentage', fmt: pctText, says: (t, v) => `has won ${pctText(v)} of its ${GAMES[t.games].games}${spanText(t.since, t.until)} (${recordText(t)})` },
  claimedNatChamps: { label: 'claimed national titles', fmt: int, says: (t, v) => `claims ${int(v)} national title${v === 1 ? '' : 's'}${spanText(t.since, t.until)}` },
  totalNatChamps: { label: 'national titles, claimed or not', fmt: int, says: (t, v) => `has ${int(v)} national title${v === 1 ? '' : 's'}${spanText(t.since, t.until)}, claimed or not` },
  years: { label: 'seasons played', fmt: int, says: (t, v) => `has played ${int(v)} season${v === 1 ? '' : 's'}${spanText(t.since, t.until)}` },
  losses: { label: 'losses', allTime: true, fmt: int, says: (t, v, m) => `has ${int(v)} ${m} (${recordText(t)})` },
};
export const SORT_KEYS = Object.keys(SORTS);
/** the old bowl sorts, now the games choice: ?sort=bowlWins reads as wins in bowl games */
const OLD_SORTS = { bowlWins: ['wins', 'bowl'], bowlPct: ['winPct', 'bowl'] };
/** the measure in words: "all-time wins", "regular-season wins since 1978", "bowl win percentage from 1950 through 1990" */
export const measure = (q) => {
  const s = SORTS[q.sort], span = spanText(q.since, q.until), noun = `${GAMES[gamesOf(q)].noun}${s.label}`;
  return span ? `${noun}${span}` : s.allTime ? `all-time ${noun}` : noun;
};

export const CONFERENCES = [...new Set(TEAMS.map((t) => t.conference))].sort();
export const confCount = (conf) => TEAMS.filter((t) => t.conference === conf).length;

export const DEFAULT = { sort: 'wins', games: 'all', conf: null, since: null, until: null, t: null };

/**
 * ?sort=winPct&games=reg&since=1978&until=1997&conf=SEC&t=alabama. since is
 * any year after the first season through this one, until any year from
 * since up to the latest season played (which is the same as none); the old
 * bowl sorts read as the games choice; anything else the data doesn't know
 * falls back to the default.
 */
export function parseUrl(search) {
  const p = new URLSearchParams(search);
  let sort = p.get('sort'), games = p.get('games');
  if (OLD_SORTS[sort]) [sort, games] = OLD_SORTS[sort];
  const conf = p.get('conf');
  const since = Number(p.get('since')), until = Number(p.get('until'));
  const t = p.get('t');
  const q = {
    sort: sort && SORTS[sort] ? sort : DEFAULT.sort,
    conf: conf && CONFERENCES.includes(conf) ? conf : null,
    since: isSince(since) ? since : null,
    t: t && teamBySlug(t) ? t : null,
  };
  q.until = isUntil(until) && (!q.since || until >= q.since) ? until : null;
  q.games = gamesApply(q.sort) && GAMES[games] ? games : 'all';
  return q;
}
/** the defaults are omitted, so equivalent addresses read the same */
export function toUrl(q) {
  const p = new URLSearchParams();
  if (q.sort !== DEFAULT.sort) p.set('sort', q.sort);
  if (gamesOf(q) !== 'all') p.set('games', gamesOf(q));
  if (q.since) p.set('since', String(q.since));
  if (q.until) p.set('until', String(q.until));
  if (q.conf) p.set('conf', q.conf);
  if (q.t) p.set('t', q.t);
  const s = p.toString();
  return s ? `?${s}` : '';
}
export const isShared = (q) => toUrl(q) !== '';

/**
 * The board: the conference's programs (all of them without one) ranked by
 * the sort, competition ranks (equal values share a rank), ties broken for
 * order only by name. A program with no value for the sort (no bowl games
 * under bowl win percentage) sits at the bottom with no rank.
 */
export function evaluate(q) {
  const games = gamesOf(q);
  const all = teamsFor({ since: q.since, until: q.until, games });
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
  return { rows, total: pool.length, sort: q.sort, games, conf: q.conf, since: q.since ?? null, until: q.until ?? null };
}
export const rankText = (r) => (r.rank == null ? '—' : `${r.tied ? 'T' : ''}${r.rank}`);
export const ordinal = (n) => `${n}${['th', 'st', 'nd', 'rd'][(n % 100 > 10 && n % 100 < 14) || n % 10 > 3 ? 0 : n % 10]}`;
