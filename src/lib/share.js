// The words a shared address carries: the sentence, the
// share button's text, the tab title, the description, the card's rows.
// Pure, so the page, the prerender and the share worker say the same thing.
import * as F from './football.js';

export const FOOTBALL_SITE = 'College Football All-Time Records';

const int = (n) => n.toLocaleString('en-US');

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
