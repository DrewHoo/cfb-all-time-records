// Each program's season-by-season record, so the board can count from a
// year on. Writes data/seasons.json (every season) and src/data/eras.json
// (what the page reads) from these sources and one layer:
//
//   the NCAA's totals through 2024   Wikipedia's FBS win-loss table at the last
//                                    revision before the 2025 season
//                                    (data/build/ncaa-2024.html); the table was
//                                    updated only through week 3 of 2025 after it
//   the games, 1936 on               College Football Streak King's payload, every
//                                    game of a top-division season (on-field)
//   Howell's scores, before 1936     James Howell's all-time scores (jhowell.net),
//                                    each top-division season's total, read from the
//                                    copy cfb-streak-king keeps (data/raw/jhowell), for an
//                                    early season whose ties the list drops
//   the season lists                 each program's "List of … football seasons"
//                                    on Wikipedia, for everything else: seasons
//                                    before 1936, and seasons below the top division
//   data/season-rulings.json         the NCAA's own changes to a season (forfeits,
//                                    vacated wins), seasons a list leaves out, and
//                                    seasons the NCAA doesn't count (junior college,
//                                    rugby), each with its receipts
//
// The gate: each program's seasons through 2024 must sum to the NCAA's total
// within a few games. What's left is a difference in early games the sources
// count differently (the NCAA leaves out most games against non-college
// teams) that no season can be pinned to; it's written as `unplaced` and
// counts in the all-time figures only.
//
//   node scripts/build-seasons.mjs                 the live payload, saved pages
//   node scripts/build-seasons.mjs <payload.json>  a local payload
//   node scripts/build-seasons.mjs --fetch         also download any page not saved
//   --howell <dir>                                 Howell's pages (default ../cfb-streak-king/data/raw/jhowell)
//
// Pages are saved under data/build/ (not committed); data/season-pages.json pins
// the revision each list was read at, so a re-fetch reads the same text.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseHTML } from 'linkedom'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const BUILD = path.join(ROOT, 'data/build')
const UA = { headers: { 'user-agent': 'cfb-all-time-records build (https://drewhoover.com/cfb-all-time-records/)' } }
const PAYLOAD = 'https://drewhoover.com/cfb-streak-king/share/payload.json'
const THROUGH = 2024
/** where an era can start: modern rules (1912), the AP poll (1936), Division I-A (1978), the BCS (1998), the playoff (2014) */
const BOUNDARIES = [1912, 1936, 1978, 1998, 2014]
/** the bowls run a season further: the bowl page is current through the 2025 season's bowls */
const BOWLS_THROUGH = 2025
const SK_FIRST = 1936
/** the most the seasons may miss the NCAA's total by, per count, before the build stops */
const SLACK = 4

const args = process.argv.slice(2)
const fetchMissing = args.includes('--fetch')
const flag = (name, dflt) => { const k = args.indexOf(name); return k >= 0 ? args[k + 1] : dflt }
// a cfb-streak-king checkout beside this one (from a worktree under .claude/worktrees, beside the main checkout)
const HOWELL = flag('--howell', [path.resolve(ROOT, '../cfb-streak-king/data/raw/jhowell'), path.resolve(ROOT, '../../../../cfb-streak-king/data/raw/jhowell')].find((d) => fs.existsSync(d)))
if (!HOWELL) throw new Error('build-seasons: no cfb-streak-king checkout beside this one; pass --howell <dir>')
const payloadArg = args.find((a, k) => !a.startsWith('--') && args[k - 1] !== '--howell')
const read = (p) => JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8'))
const file = read('src/data/football.json')
const pages = read('data/season-pages.json')
const rulings = read('data/season-rulings.json')

// ---- the saved pages ----
async function page(slug) {
  const f = path.join(BUILD, 'pages', `${slug}.html`)
  if (fs.existsSync(f)) return fs.readFileSync(f, 'utf8')
  if (!fetchMissing) throw new Error(`build-seasons: no saved page for ${slug} (run with --fetch)`)
  const { title, revid } = pages.pages[slug]
  const r = await fetch(`https://en.wikipedia.org/api/rest_v1/page/html/${encodeURIComponent(title.replaceAll(' ', '_'))}/${revid}`, UA)
  if (!r.ok) throw new Error(`build-seasons: ${title} answered ${r.status}`)
  const html = await r.text()
  fs.mkdirSync(path.dirname(f), { recursive: true })
  fs.writeFileSync(f, html)
  await new Promise((z) => setTimeout(z, 400))
  return html
}

// ---- the season lists ----
const clean = (s) => s.replace(/\[[^\]]*\]/g, '').replace(/\s+/g, ' ').trim()
/** a table as a grid, rowspans and colspans filled in; rows with no cells don't count */
function grid(table) {
  const rows = [...table.querySelectorAll('tr')].filter((tr) => tr.closest('table') === table && [...tr.children].some((e) => e.tagName === 'TD' || e.tagName === 'TH'))
  const g = []
  rows.forEach((tr, r) => {
    g[r] = g[r] ?? []
    let c = 0
    for (const cell of [...tr.children].filter((e) => e.tagName === 'TD' || e.tagName === 'TH')) {
      while (g[r][c] !== undefined) c++
      const rs = +cell.getAttribute('rowspan') || 1
      const cs = +cell.getAttribute('colspan') || 1
      const v = { text: clean(cell.textContent), th: cell.tagName === 'TH' }
      for (let i = 0; i < rs; i++) for (let j = 0; j < cs; j++) { g[r + i] = g[r + i] ?? []; g[r + i][c + j] = v }
      c += cs
    }
  })
  return g
}
const YEAR = /^(1[89]\d\d|20[0-2]\d)\s*[*†‡§^#~+]*$/
const REC = /(\d+)\s*[–—-]\s*(\d+)(?:\s*[–—-]\s*(\d+))?/
const norm = (x) => (x ?? '').replace(/[^a-z]/g, '')
/** one table's seasons: the year column, and the overall record as one cell or as W, L, T columns */
function tableSeasons(g) {
  const first = g.findIndex((row) => row?.slice(0, 2).some((v) => v && YEAR.test(v.text)))
  if (first < 1) return null
  const width = Math.max(...g.slice(0, first + 1).map((r) => r?.length ?? 0))
  const labels = []
  for (let k = 0; k < width; k++) {
    const seen = []
    for (let r = 0; r < first; r++) {
      if (new Set(g[r] ?? []).size <= 1) continue // a full-width caption row
      const v = g[r]?.[k]
      if (v?.th && !seen.includes(v)) seen.push(v)
    }
    labels[k] = seen.map((v) => v.text.toLowerCase())
  }
  const L = (k) => labels[k].join(' / ')
  const yc = labels.findIndex((l) => l.some((x) => /^(season|year)s?$/.test(x)))
  if (yc < 0) return null
  const leaf = (k) => norm(labels[k].at(-1))
  const parent = (k) => labels[k].slice(0, -1).join(' / ')
  const groups = new Map()
  for (let k = 0; k < width; k++) {
    const kind = /^(w|win|wins|won)$/.test(leaf(k)) ? 'w' : /^(l|loss|losses|lost)$/.test(leaf(k)) ? 'l' : /^(t|tie|ties|tied)$/.test(leaf(k)) ? 't' : null
    if (!kind) continue
    const gr = groups.get(parent(k)) ?? {}
    if (gr[kind] == null) gr[kind] = k
    groups.set(parent(k), gr)
  }
  const cands = [...groups].filter(([, gr]) => gr.w != null && gr.l != null)
  const pick = cands.find(([p]) => /overall/.test(p))
    ?? cands.find(([p]) => !/conf|division|league/.test(p) && /season|record|result/.test(p))
    ?? cands.find(([p]) => !/conf|division|league|bowl|postseason/.test(p))
  let oc = pick ? { w: pick[1].w, l: pick[1].l, t: pick[1].t ?? null } : null
  if (!oc) {
    const k = labels.findIndex((l, k) => k !== yc && !/bowl|postseason|rank|poll/.test(L(k)) && l.some((x) => /overall|record|^w[–-]l([–-]t)?$/.test(x) && !/conf|league|division/.test(x)))
    if (k >= 0) oc = k
  }
  if (oc == null) return null
  const part = new Map()
  for (let r = first; r < g.length; r++) {
    const row = g[r]
    if (!row?.[yc]) continue
    const m = row[yc].text.match(YEAR)
    if (!m) continue
    const y = +m[1]
    let w, l, t
    if (typeof oc === 'number') {
      let x = row[oc]?.text.match(/^\s*(\d+)\s*[–—-]\s*(\d+)(?:\s*[–—-]\s*(\d+))?/)
      if (!x) x = row.find((v, k) => k > yc && v && /^\d+\s*[–—-]\s*\d+(\s*[–—-]\s*\d+)?\s*[*†‡]*$/.test(v.text))?.text.match(REC)
      if (!x) continue
      ;[w, l, t] = [+x[1], +x[2], +(x[3] ?? 0)]
    } else {
      w = parseInt(row[oc.w]?.text); l = parseInt(row[oc.l]?.text); t = oc.t != null ? parseInt(row[oc.t]?.text) || 0 : 0
      if (!Number.isFinite(w) || !Number.isFinite(l)) continue
    }
    const p = part.get(y) ?? [0, 0, 0]
    part.set(y, [p[0] + w, p[1] + l, p[2] + t]) // a season split across two rows (a coach change) adds up
  }
  return part
}
/** a page's seasons: the largest season table first, then any others for the seasons it lacks */
function listSeasons(html) {
  const { document } = parseHTML(html)
  const parts = [...document.querySelectorAll('table')].filter((t) => !t.querySelector('table')).map((t) => tableSeasons(grid(t))).filter((p) => p && p.size >= 3)
  parts.sort((a, b) => b.size - a.size)
  const seasons = {}
  for (const p of parts) for (const [y, s] of p) if (!(y in seasons)) seasons[y] = s
  return seasons
}

// ---- the NCAA's totals through 2024 ----
function ncaaTable(html) {
  const { document } = parseHTML(html)
  const t = [...document.querySelectorAll('table')].find((t) => /Michigan/.test(t.textContent))
  const rows = [...t.querySelectorAll('tr')].slice(1).map((r) => [...r.children].map((c) => clean(c.textContent)))
  return (name) => {
    const r = rows.find((r) => r.includes(name))
    if (!r) return null
    const [w, l, ti, years] = r.filter((c) => /^[\d,]+$/.test(c)).map((c) => +c.replace(/,/g, ''))
    return { w, l, t: ti, years }
  }
}

// ---- Howell's scores ----
/** a Howell team page's season totals, top-division seasons only (byconf.htm's spans) */
const byconf = fs.readFileSync(path.join(HOWELL, 'byconf.htm'), 'latin1')
const spans = new Map([...byconf.matchAll(/<a href="([^"#]+\.htm)">([\s\S]*?)<\/a>/g)].map((m) => {
  const nm = /\(([\d\s,\-present]+)\)\s*$/.exec(m[2].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim())
  return [m[1], nm ? nm[1].split(',').map((p) => { const r = p.trim().split('-'); return [+r[0], r[1] === 'present' ? 9999 : +(r[1] ?? r[0])] }) : []]
}))
// Streak King's rule: the note names a bowl, a title game or the playoff; conference title games
// and the preseason Kickoff and Pigskin Classics are not postseason
const isBowl = (note) => /\bbowl\b|championship game|bcs championship|playoff|hall of fame classic/i.test(note) && !/conference|kickoff|pigskin/i.test(note)
/** a Howell team page's bowl games by season, from the note cell that names the game */
function howellBowls(fileName) {
  const html = fs.readFileSync(path.join(HOWELL, 'teams', fileName), 'latin1')
  const out = {}
  const parts = html.split(/<a name=["']?(\d{4})["']?>/)
  for (let k = 1; k < parts.length; k += 2) {
    const y = +parts[k]
    for (const tr of parts[k + 1].split(/<tr>/i).slice(1)) {
      const td = [...tr.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map((m) => m[1].replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim())
      if (td.length < 8 || !/^[WLT]$/.test(td[3]) || !isBowl(td.at(-1))) continue
      const r = (out[y] ??= [0, 0, 0])
      r['WLT'.indexOf(td[3])]++
    }
  }
  return out
}
function howellSeasons(fileName) {
  const html = fs.readFileSync(path.join(HOWELL, 'teams', fileName), 'latin1')
  const major = spans.get(fileName) ?? []
  const out = {}
  const parts = html.split(/<a name=["']?(\d{4})["']?>/)
  for (let k = 1; k < parts.length; k += 2) {
    const y = +parts[k]
    if (!major.some(([a, b]) => y >= a && y <= b)) continue
    const txt = parts[k + 1].replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ')
    const m = txt.match(/^\s*\d{4}-[^\n]*\n[\s\S]*?\n\s*(\d+)-(\d+)(?:-(\d+))?\s+\d+\s+\d+\s*\n/)
    if (m) out[y] = [+m[1], +m[2], +(m[3] ?? 0)]
  }
  return out
}

// ---- the games ----
const payload = payloadArg
  ? JSON.parse(fs.readFileSync(payloadArg, 'utf8'))
  : await fetch(PAYLOAD, UA).then((r) => { if (!r.ok) throw new Error(`build-seasons: ${PAYLOAD} answered ${r.status}`); return r.json() })
function payloadSeasons() {
  const g = payload.games
  const out = new Map(payload.teams.map((t, i) => [i, {}]))
  for (let k = 0; k < g.se.length; k++) {
    if (g.hs[k] == null || g.as[k] == null) continue
    for (const [me, ms, os] of [[g.hi[k], g.hs[k], g.as[k]], [g.ai[k], g.as[k], g.hs[k]]]) {
      const r = (out.get(me)[g.se[k]] ??= [0, 0, 0])
      r[ms > os ? 0 : ms < os ? 1 : 2]++
    }
  }
  return out
}

// ---- join ----
const games = payloadSeasons()
const byEspn = new Map(payload.teams.map((t, i) => [t.espn, i]))
const ncaa = ncaaTable(fs.readFileSync(path.join(BUILD, 'ncaa-2024.html'), 'utf8'))
const wiki = {}
const out = {}
const report = []
const bowlReport = []
const used = new Set()
let failed = false
const fail = (msg) => { console.error(`  ✗ ${msg}`); failed = true }
const same = (a, b) => a[0] === b[0] && a[1] === b[1] && a[2] === b[2]
const sum = (seasons) => Object.values(seasons).reduce((a, s) => [a[0] + s[0], a[1] + s[1], a[2] + s[2]], [0, 0, 0])

for (const t of file.teams) {
  const list = listSeasons(await page(t.slug))
  wiki[t.slug] = { title: pages.pages[t.slug].title, revid: pages.pages[t.slug].revid, seasons: list }
  const i = byEspn.get(t.espn)
  if (i == null) throw new Error(`build-seasons: no Streak King team has ESPN id ${t.espn} (${t.name})`)
  const sk = payload.teams[i]
  const major = (y) => sk.major.some(([a, b]) => y >= a && y <= b)
  const seasons = {}
  const forks = []
  const picked = {}
  const howell = howellSeasons(pages.pages[t.slug].howell)
  const years = new Set([...Object.keys(list), ...Object.keys(games.get(i)), ...Object.keys(howell)].map(Number))
  const n = (r) => (r ? r[0] + r[1] + r[2] : 0)
  for (const y of [...years].sort((a, b) => a - b)) {
    if (y > THROUGH) continue
    // a transition season Streak King counts as top-division can carry only the games against
    // top-division teams, so the games (or Howell's total) win only when they're at least as
    // many as the list's; a list season with no games is no season
    const fromGames = y >= SK_FIRST && major(y) && n(games.get(i)[y]) >= n(list[y]) ? games.get(i)[y] : null
    // Howell counts early games against non-college teams the NCAA leaves out, so before 1936 the
    // list stands, unless it lacks the season or drops ties Howell has (same wins and losses)
    const h = howell[y]
    const fromHowell = !fromGames && y < SK_FIRST && h && (n(list[y]) && (list[y][0] === h[0] && list[y][1] === h[1] && list[y][2] < h[2])) ? h : null
    const pick = fromGames ?? fromHowell ?? (n(list[y]) ? list[y] : null)
    if (!pick) continue
    seasons[y] = pick
    if (pick !== list[y] && list[y] && !same(list[y], pick)) { forks.push(y); picked[y] = `${fromGames ? 'games' : 'howell'} ${pick.join('-')}` }
  }
  // the rulings for this program, applied over the joined seasons; one that changes nothing is stale
  for (const [n, r] of rulings.rulings.entries()) {
    if (r.team !== t.slug) continue
    used.add(n)
    const span = r.seasons ?? [r.season, r.season]
    if (r.uncounted) {
      const hit = Object.keys(seasons).map(Number).filter((y) => y >= span[0] && y <= span[1])
      if (!hit.length) fail(`${t.slug} ${span.join('–')}: an uncounted ruling with no season in it`)
      for (const y of hit) delete seasons[y]
    } else if (r.record) {
      if (seasons[r.season] && same(seasons[r.season], r.record)) fail(`${t.slug} ${r.season}: the ruling's record is already the season's (stale)`)
      seasons[r.season] = r.record
    }
  }
  // a fork the rulings settled is no longer one
  const open = forks.filter((y) => !rulings.rulings.some((r) => r.team === t.slug && (r.season === y || (r.seasons && y >= r.seasons[0] && y <= r.seasons[1]))))

  const base0 = ncaa(t.name) ?? rulings.base?.[t.slug]
  if (!base0) throw new Error(`build-seasons: no NCAA total through ${THROUGH} for ${t.name}`)
  // an NCAA action after the table's revision (vacated wins announced since) moves the total too
  const base = { ...base0 }
  for (const c of rulings.since ?? []) if (c.team === t.slug) { base.w += c.w ?? 0; base.l += c.l ?? 0; base.t += c.t ?? 0 }
  const total = sum(seasons)
  const unplaced = [base.w - total[0], base.l - total[1], base.t - total[2]]
  const yearsOff = base.years - Object.keys(seasons).length
  report.push({ slug: t.slug, unplaced, yearsOff, open, picked, list, html: open.length ? await page(t.slug) : null })
  const ruled = (rulings.unplaced ?? []).find((u) => u.team === t.slug)
  if (ruled) used.add(`u:${t.slug}`)
  if (unplaced.some((d) => Math.abs(d) > SLACK) && !ruled) fail(`${t.slug}: the seasons miss the NCAA's ${base.w}–${base.l}–${base.t} by ${unplaced.join('/')}`)
  // bowls by season, Howell's count, over the bowl rulings; the rest of the bowl page's total is unplaced too
  const bowls = {}
  for (const [y, r] of Object.entries(howellBowls(pages.pages[t.slug].howell))) if (+y <= BOWLS_THROUGH) bowls[y] = r
  for (const [n, r] of rulings.rulings.entries()) {
    if (r.team !== t.slug || !r.bowls) continue
    used.add(n)
    if (bowls[r.season] && same(bowls[r.season], r.bowls)) fail(`${t.slug} ${r.season}: the bowl ruling is already the season's (stale)`)
    if (r.bowls.every((x) => !x)) delete bowls[r.season]
    else bowls[r.season] = r.bowls
  }
  const bt = sum(bowls)
  const bowlsUnplaced = [t.bowlWins - bt[0], t.bowlLosses - bt[1], t.bowlTies - bt[2]]
  bowlReport.push({ slug: t.slug, bowlsUnplaced })
  out[t.slug] = { base: [base.w, base.l, base.t, base.years], seasons, unplaced, bowls, bowlsUnplaced }
}
for (const [n, r] of rulings.rulings.entries()) if (!used.has(n)) fail(`ruling ${n} (${r.team}) names no program`)
for (const u of rulings.unplaced ?? []) if (!used.has(`u:${u.team}`)) fail(`the unplaced ruling for ${u.team} names no program`)

const bowlsOff = bowlReport.filter((r) => r.bowlsUnplaced.some((d) => d))
console.log(`build-seasons: ${bowlReport.length - bowlsOff.length} of ${bowlReport.length} programs' bowls sum to the bowl page's total`)
for (const r of bowlsOff) console.log(`  ${r.slug.padEnd(22)} bowls unplaced ${r.bowlsUnplaced.join('/')}`)
const placed = report.filter((r) => r.unplaced.every((d) => d === 0)).length
console.log(`build-seasons: ${placed} of ${report.length} programs sum to the NCAA's total exactly`)
for (const r of report) {
  if (r.unplaced.some((d) => d) || r.yearsOff || r.open.length) console.log(`  ${r.slug.padEnd(22)} unplaced ${r.unplaced.join('/').padEnd(10)} seasons ${r.yearsOff >= 0 ? '+' : ''}${-r.yearsOff}${r.open.length ? `  list≠ ${r.open.join(' ')}` : ''}`)
}
// the review table: each open fork with the list's row and the footnotes on it, the
// candidates for a ruling's receipts (data/build/review.txt)
const review = []
for (const r of report) {
  if (!r.open.length && r.unplaced.every((d) => !d)) continue
  review.push(`== ${r.slug}  unplaced ${r.unplaced.join('/')}  seasons ${-r.yearsOff}`)
  if (!r.html) continue
  const { document } = parseHTML(r.html)
  const notes = new Map([...document.querySelectorAll('li[id]')].map((li) => [li.id, clean(li.textContent)]))
  for (const y of r.open) {
    review.push(`  ${y}  list ${r.list[y].join('-')}  ${r.picked[y]}`)
    const row = [...document.querySelectorAll('tr')].find((tr) => tr.children[0] && new RegExp(`^\\s*${y}\\b`).test(tr.children[0].textContent))
    if (!row) continue
    review.push(`    row: ${clean(row.textContent).slice(0, 160)}`)
    for (const id of new Set([...row.querySelectorAll('a[href*="#cite_note"]')].map((a) => a.getAttribute('href').split('#')[1]))) review.push(`    note: ${(notes.get(id) ?? '?').slice(0, 400)}`)
  }
}
fs.mkdirSync(BUILD, { recursive: true })
fs.writeFileSync(path.join(BUILD, 'review.txt'), review.join('\n') + '\n')
fs.writeFileSync(path.join(ROOT, 'data/seasons-wiki.json'), JSON.stringify({ note: 'Each program\'s season list as parsed, before the games and the rulings; scripts/build-seasons.mjs writes it.', teams: wiki }) + '\n')
if (failed) { console.error('build-seasons: the gate failed; nothing written'); process.exit(1) }
// every season, for anyone checking a number (not bundled)
fs.writeFileSync(path.join(ROOT, 'data/seasons.json'), JSON.stringify({ note: "Each program's record by season through 2024 and its bowls through 2025, as scripts/build-seasons.mjs joins them; `unplaced` is the part of the NCAA's total no season carries.", through: THROUGH, bowlsThrough: BOWLS_THROUGH, teams: out }) + '\n')
// what the page reads: the NCAA's total through 2024, and each era's sums
const eras = {}
for (const [slug, o] of Object.entries(out)) {
  const e = {}
  for (const b of BOUNDARIES) {
    const r = [0, 0, 0, 0, 0, 0, 0]
    for (const [y, s] of Object.entries(o.seasons)) if (+y >= b) { r[0] += s[0]; r[1] += s[1]; r[2] += s[2]; r[3]++ }
    for (const [y, s] of Object.entries(o.bowls)) if (+y >= b) { r[4] += s[0]; r[5] += s[1]; r[6] += s[2] }
    e[b] = r
  }
  eras[slug] = { base: o.base, eras: e }
}
fs.writeFileSync(path.join(ROOT, 'src/data/eras.json'), JSON.stringify({ note: 'scripts/build-seasons.mjs writes it: base is the NCAA\'s wins, losses, ties and seasons through `through`; each era is wins, losses, ties, seasons through `through`, and bowl wins, losses, ties through `bowlsThrough`, from its year on.', through: THROUGH, bowlsThrough: BOWLS_THROUGH, boundaries: BOUNDARIES, teams: eras }) + '\n')
console.log('build-seasons: wrote data/seasons.json and src/data/eras.json')
