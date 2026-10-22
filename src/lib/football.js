// The FBS records board: the data, the words each sort goes by, the URL
// codec and the ranking. Pure (no window, no React) so the prerender, the
// share worker and the page all rank the same way.
import file from '../data/football.json';

/** the season the records run through */
export const THROUGH = file.through;
export const SOURCE_URL = file.source;
/** every current FBS program, as the Wikipedia table lists it */
export const TEAMS = file.teams;
export const teamBySlug = (slug) => TEAMS.find((t) => t.slug === slug) ?? null;

const int = (n) => n.toLocaleString('en-US');
/** .732, the way a baseball average reads */
export const pctText = (p) => (p == null ? '—' : p.toFixed(3).replace(/^0/, ''));
export const recordText = (t) => `${int(t.wins)}–${int(t.losses)}${t.ties ? `–${t.ties}` : ''}`;
export const bowlText = (t) => (t.bowlWins + t.bowlLosses + t.bowlTies === 0 ? 'no bowls' : `${t.bowlWins}–${t.bowlLosses}${t.bowlTies ? `–${t.bowlTies}` : ''}`);

/** what a program can be ranked by: the word in the sentence, the noun a claim uses, how its value prints */
/** what a program can be ranked by: the word in the sentence, the noun a claim uses, how its value prints, and the claim's verb phrase */
export const SORTS = {
  wins: { label: 'all-time wins', noun: 'all-time wins', fmt: int, says: (t, v) => `has ${int(v)} all-time wins (${recordText(t)})` },
  winPct: { label: 'win percentage', noun: 'win percentage', fmt: pctText, says: (t, v) => `has won ${pctText(v)} of its games (${recordText(t)})` },
  bowlWins: { label: 'bowl wins', noun: 'bowl wins', fmt: int, says: (t, v) => `has ${int(v)} bowl win${v === 1 ? '' : 's'} (${bowlText(t)})` },
  bowlPct: { label: 'bowl win percentage', noun: 'bowl win percentage', fmt: pctText, says: (t, v) => `has won ${pctText(v)} of its bowls (${bowlText(t)})` },
  claimedNatChamps: { label: 'claimed national titles', noun: 'claimed national titles', fmt: int, says: (t, v) => `claims ${int(v)} national title${v === 1 ? '' : 's'}` },
  totalNatChamps: { label: 'national titles, claimed or not', noun: 'national titles, claimed or not', fmt: int, says: (t, v) => `has ${int(v)} national title${v === 1 ? '' : 's'}, claimed or not` },
  years: { label: 'seasons played', noun: 'seasons played', fmt: int, says: (t, v) => `has played ${int(v)} seasons` },
  losses: { label: 'all-time losses', noun: 'all-time losses', fmt: int, says: (t, v) => `has ${int(v)} all-time losses (${recordText(t)})` },
};
export const SORT_KEYS = Object.keys(SORTS);

export const CONFERENCES = [...new Set(TEAMS.map((t) => t.conference))].sort();
export const confCount = (conf) => TEAMS.filter((t) => t.conference === conf).length;

export const DEFAULT = { sort: 'wins', conf: null, t: null };

/** ?sort=winPct&conf=SEC&t=alabama; anything the data doesn't know falls back to the default */
export function parseUrl(search) {
  const p = new URLSearchParams(search);
  const sort = p.get('sort');
  const conf = p.get('conf');
  const t = p.get('t');
  return {
    sort: sort && SORTS[sort] ? sort : DEFAULT.sort,
    conf: conf && CONFERENCES.includes(conf) ? conf : null,
    t: t && teamBySlug(t) ? t : null,
  };
}
/** the defaults are omitted, so equivalent addresses read the same */
export function toUrl(q) {
  const p = new URLSearchParams();
  if (q.sort !== DEFAULT.sort) p.set('sort', q.sort);
  if (q.conf) p.set('conf', q.conf);
  if (q.t) p.set('t', q.t);
  const s = p.toString();
  return s ? `?${s}` : '';
}
export const isShared = (q) => q.sort !== DEFAULT.sort || !!q.conf || !!q.t;

/**
 * The board: the conference's programs (all of them without one) ranked by
 * the sort, competition ranks (equal values share a rank), ties broken for
 * order only by name. A program with no value for the sort (no bowl games
 * under bowl win percentage) sits at the bottom with no rank.
 */
export function evaluate(q) {
  const pool = q.conf ? TEAMS.filter((t) => t.conference === q.conf) : TEAMS;
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
  return { rows, total: pool.length, sort: q.sort, conf: q.conf };
}
export const rankText = (r) => (r.rank == null ? '—' : `${r.tied ? 'T' : ''}${r.rank}`);
export const ordinal = (n) => `${n}${['th', 'st', 'nd', 'rd'][(n % 100 > 10 && n % 100 < 14) || n % 10 > 3 ? 0 : n % 10]}`;
