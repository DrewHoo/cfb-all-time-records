// llms.txt (llmstxt.org): the site in plain markdown for a language model
// that reads it, the way a person reads the board: what it is, where the
// records come from, the one page, the other sports sites, and the citing
// ask. Said the way the page says it, nothing more. NBA Comparator's, in shape.
//
//   fs.writeFileSync(path.join(ROOT, 'dist', 'llms.txt'), llmsText({ ... }))

const REPO = 'https://github.com/DrewHoo/cfb-all-time-records'

/**
 * The llms.txt markdown.
 * @param {{
 *   site: string,         // the site's URL, with the trailing slash
 *   title: string,        // the root page's <title>
 *   description: string,  // the root page's meta description
 *   baseSeason: number,   // the season the titles and Wikipedia's bowls run through (F.BASE_SEASON)
 *   recordsThrough: number, // the season the NCAA's totals run through (F.RECORDS_THROUGH)
 *   season: number,       // the running season, layered on (F.SEASON)
 *   latest: string|null,  // its latest game, "October 24, 2026" (F.LATEST)
 *   programs: number,     // how many programs are on the board (F.TEAMS.length)
 *   sourceUrl: string,    // the Wikipedia win-loss table (F.RECORDS_SOURCE_URL)
 *   siblings: [key: string, href: string, name: string, line: string][],  // Notes.jsx SIBLINGS
 * }} o
 */
export function llmsText({ site, title, description, baseSeason, recordsThrough, season, latest, programs, sourceUrl, siblings }) {
  return `# ${title}

> ${description}

Every row is a program's record as the NCAA counts it: the total Wikipedia's [table of FBS win-loss records](${sourceUrl}) (CC BY-SA 4.0) gives through the ${recordsThrough} season${latest ? `, with every game since through ${latest} added from the games themselves` : ''}, its bowl record and the national championships it claims. The bowls are Wikipedia's through ${baseSeason}, with every bowl since counted from the games; a playoff game counts as a bowl, a conference title game doesn't. The titles are through ${baseSeason}. Vacated wins are out and forfeits count for the team awarded them; seasons below the top division count, as in the NCAA's totals. The ${programs} programs are this season's FBS members. The board at ${site} ranks them by wins, win percentage, losses, claimed national titles, national titles claimed or not or seasons played; all time, or from any year to any year (named starts at 1912, modern rules; 1936, the AP poll; 1978, Division I-A; 1998, the BCS; 2014, the playoff; and ends just before them), counted from each program's season-by-season record; wins, losses and win percentage over every game, the regular season (every game but the bowls and the playoff, so a conference title game counts) or the bowls alone; for all of FBS or one conference. A program opens inline under its row with its full record. The address carries the board (\`?sort=\`, \`?games=reg|bowl\`, \`?since=<year>\`, \`?until=<year>\`, \`?conf=\`) and the open program (\`?t=<slug>\`); the old \`?sort=bowlWins\` and \`?sort=bowlPct\` read as wins and win percentage over bowl games.

## Pages

- [${title}](${site}) — the board, the default view: every FBS program by all-time wins.
- [Method](${site}#method): where the records come from, what counts, what the words mean, and where a published number differs.
- [The repository](${REPO}): the data (every season, and the rulings with their sources), the ranking and the share worker.

## The other sports sites

${siblings.map(([, href, name, line, links]) => `- [${name}](${href})${links ? ':' : ' —'} ${line}${links ? ' ' + links.map((l) => `[${l.name}](${l.url})`).join(' | ') : ''}`).join('\n')}

## Citing

If a record from this page ends up in your article, broadcast, podcast or thread, please cite it: name the site and link to the view where sensible; the url encodes what the page shows into it.
`
}
