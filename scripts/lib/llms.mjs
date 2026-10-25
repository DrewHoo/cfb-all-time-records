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
 *   baseSeason: number,   // the last finished season Wikipedia's table runs through (F.BASE_SEASON)
 *   season: number,       // the running season, layered on (F.SEASON)
 *   latest: string|null,  // its latest game, "October 24, 2026" (F.LATEST)
 *   programs: number,     // how many programs are on the board (F.TEAMS.length)
 *   sourceUrl: string,    // the Wikipedia table (F.SOURCE_URL)
 *   siblings: [key: string, href: string, name: string, line: string][],  // Notes.jsx SIBLINGS
 * }} o
 */
export function llmsText({ site, title, description, baseSeason, season, latest, programs, sourceUrl, siblings }) {
  return `# ${title}

> ${description}

Every row is a program's all-time record as Wikipedia's [list of FBS football programs](${sourceUrl}) (CC BY-SA 4.0) tallies it through the ${baseSeason} season${latest ? `, with every ${season} game through ${latest} added` : ''}: wins, losses and ties in every game the program has played, its bowl record, and the national championships it claims. The bowls and the titles are through ${baseSeason} until the ${season} season is over. The ${programs} programs are this season's FBS members. The board at ${site} ranks them by all-time wins, win percentage, bowl wins, bowl win percentage, claimed national titles, national titles claimed or not, seasons played or all-time losses, for all of FBS or one conference; a program opens inline under its row with its full record. The address carries the board (\`?sort=\`, \`?conf=\`) and the open program (\`?t=<slug>\`).

## Pages

- [${title}](${site}) — the board, the default view: every FBS program by all-time wins.
- [Method](${site}#method): where the records come from, what counts, what the words mean, and where a published number differs.
- [The repository](${REPO}): the data, the ranking and the share worker.

## The other sports sites

${siblings.map(([, href, name, line, links]) => `- [${name}](${href})${links ? ':' : ' —'} ${line}${links ? ' ' + links.map((l) => `[${l.name}](${l.url})`).join(' | ') : ''}`).join('\n')}

## Citing

If a record from this page ends up in your article, broadcast, podcast or thread, please cite it: name the site and link to the view where sensible; the url encodes what the page shows into it.
`
}
