// The words a shared address carries, for both pages: the sentence, the
// share button's text, the tab title, the description, the card's rows.
// Pure, so the page, the prerender and the share worker say the same thing.
import * as F from './football.js';
import * as C from './champs.js';

export const GRID_SITE = 'NCAA Division I Championships';
export const FOOTBALL_SITE = 'College Football All-Time Records';

const int = (n) => n.toLocaleString('en-US');
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const list = (xs) => (xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`);

// ---- the championship grid ----

export const gridSentence = () => `Every NCAA Division I national champion since ${C.FIRST}, ${C.SPORTS.length} sports in one grid.`;

/** "Stanford has won 48 NCAA Division I national titles since 1990, 21 men's and 27 women's, the most of any school." */
export function schoolClaim(school) {
  const t = C.titles[school];
  if (!t) return `${school} has won no NCAA Division I national title since ${C.FIRST}.`;
  const r = C.rankOf(school);
  const place = r?.rank === 1 ? (r.tied ? ', tied for the most of any school' : ', the most of any school') : r ? `, ${r.tied ? 'tied ' : ''}${F.ordinal(r.rank)} of ${int(C.leaderboard.length)} schools` : '';
  return `${school} has won ${int(t.total)} NCAA Division I national title${t.total === 1 ? '' : 's'} since ${C.FIRST}, ${t.male} men's and ${t.female} women's${place}.`;
}

/** the share button's text: the open school's claim, the comparison, or the sentence */
export function gridShareText(q) {
  if (q.s.length === 0) return gridSentence();
  if (q.s.length === 1) return schoolClaim(q.s[0]);
  return `${list(q.s.map((s) => `${s} ${C.titles[s]?.total ?? 0}`))}: NCAA Division I national titles since ${C.FIRST}.`;
}

export function gridTitle(q) {
  if (q.s.length === 0) return `NCAA Division I champions since ${C.FIRST}: ${C.SPORTS.length} sports in one grid`;
  if (q.s.length === 1) {
    const t = C.titles[q.s[0]];
    return `${q.s[0]} national championships since ${C.FIRST}: ${t?.total ?? 0} NCAA titles in ${Object.keys(t?.sports ?? {}).length} sports`;
  }
  return `${q.s.join(' vs ')}: NCAA Division I championships since ${C.FIRST}`;
}

export function gridDescription(q) {
  const lead = C.leaderboard[0];
  if (q.s.length === 0) return `${gridSentence()} ${lead.school} leads with ${lead.total}; ${int(C.leaderboard.length)} schools have won at least one. Pick a school to trace every title it has won.`;
  if (q.s.length === 1) {
    const top = C.topSports(q.s[0]).map(([name, n]) => `${name} ${n}`).join(', ');
    return `${schoolClaim(q.s[0])}${top ? ` Most in ${top}.` : ''} Every title on a grid of ${C.SPORTS.length} sports and ${C.LAST - C.FIRST + 1} years.`;
  }
  return `${gridShareText(q)} Every title the schools have won, on a grid of ${C.SPORTS.length} sports since ${C.FIRST}.`;
}

/** the card's rows for a selection: the schools compared, or one school's sports */
export function gridCardRows(q) {
  if (q.s.length === 1) {
    const s = q.s[0];
    return C.topSports(s, 6).map(([name, n], i) => ({ rank: String(i + 1), name, span: C.titles[s].list.filter((x) => x.sport === name).map((x) => x.year).sort().join(' '), value: int(n), hi: false, school: s }));
  }
  return q.s.map((s) => {
    const t = C.titles[s];
    const r = C.rankOf(s);
    return { rank: r ? F.rankText(r) : '—', name: s, span: t ? `${t.male} men's · ${t.female} women's · ${Object.keys(t.sports).length} sports` : 'no titles', value: int(t?.total ?? 0), hi: false, school: s };
  });
}

// ---- the football records ----

const confWords = (q) => (q.conf ? `${q.conf}` : `All ${int(F.TEAMS.length)}`);
export const footballSentence = (q) => `${confWords(q)} FBS programs ranked by ${F.SORTS[q.sort].label}, every game through ${F.THROUGH}.`;

/** "Michigan has 1,021 all-time wins, 1st of 136 FBS programs, through 2025." */
export function footballClaim(row, board) {
  const s = F.SORTS[board.sort];
  const where = board.conf ? `${board.conf} programs` : 'FBS programs';
  const have = row.value == null ? `has no ${s.noun} to rank by` : s.says(row.team, row.value);
  const place = row.rank == null ? '' : `, ${row.tied ? 'tied ' : ''}${F.ordinal(row.rank)} of ${int(board.total)} ${where}`;
  return `${row.team.name} ${have}${place}, through ${F.THROUGH}.`;
}

const openRow = (board, q) => (q.t ? board.rows.find((r) => r.team.slug === q.t) ?? null : null);

export function footballShareText(q, board) {
  const row = openRow(board, q);
  return row ? footballClaim(row, board) : footballSentence(q);
}

export function footballTitle(q, board) {
  const row = openRow(board, q);
  if (row) return `${row.team.name} all-time football record: ${F.recordText(row.team)}, ${row.rank == null ? 'unranked' : `${row.tied ? 'tied ' : ''}${F.ordinal(row.rank)}`} in ${F.SORTS[q.sort].noun} of ${int(board.total)} ${q.conf ? `${q.conf} ` : 'FBS '}programs`;
  if (!F.isShared(q)) return `All ${int(F.TEAMS.length)} FBS football programs ranked by all-time wins, through ${F.THROUGH}`;
  return `${confWords(q)} FBS football programs ranked by ${F.SORTS[q.sort].label}, through ${F.THROUGH}`;
}

export function footballDescription(q, board) {
  const row = openRow(board, q);
  const parts = [];
  if (row) {
    parts.push(footballClaim(row, board));
    parts.push(`Bowl record ${F.bowlText(row.team)}, ${row.team.claimedNatChamps} claimed national title${row.team.claimedNatChamps === 1 ? '' : 's'}${row.team.unclaimedNatChamps ? ` and ${row.team.unclaimedNatChamps} unclaimed` : ''}, ${row.team.years} seasons.`);
  } else if (board.rows[0]?.value != null) {
    parts.push(`${board.rows[0].team.name} leads with ${F.SORTS[q.sort].fmt(board.rows[0].value)}.`);
  }
  parts.push(`${footballSentence(q)} Win-loss records, bowl records and national championships for every program, from Wikipedia.`);
  return parts.join(' ');
}

/** the card's rows: the top of the board, with the open program's row in place of the last when it is further down */
export function footballCardRows(board, q, n = 6) {
  const top = board.rows.slice(0, n);
  const open = openRow(board, q);
  if (open && !top.includes(open)) top.splice(Math.max(0, Math.min(top.length, n - 1)), top.length >= n ? 1 : 0, open);
  const s = F.SORTS[q.sort];
  return top.map((r) => ({
    rank: F.rankText(r),
    name: r.team.name,
    span: `${r.team.conference} · ${F.recordText(r.team)} ${F.pctText(r.team.winPct)}`,
    value: r.value == null ? '—' : s.fmt(r.value),
    hi: r === open,
    espn: r.team.espn,
  }));
}
export const footballCardHeading = (q) => `${q.conf ? q.conf : 'FBS'} programs by ${F.SORTS[q.sort].label}`;
