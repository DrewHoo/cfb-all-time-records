// The running season's games, layered onto Wikipedia's table (through the
// last finished season) by src/lib/football.js. Reads College Football Streak
// King's published payload, its weekly refresh of every game (cfbfastR's
// schedules, with CollegeFootballData's finals for a game cfbfastR hasn't
// marked yet), and writes src/data/current.json: each program's wins, losses
// and ties this season and the date of the latest game. Bowls and national
// titles stay Wikipedia's until the season is over and the table is read again.
//
//   node scripts/build-current.mjs              the live payload
//   node scripts/build-current.mjs <file>       a local copy (a cfb-streak-king checkout's src/data/payload.json)
//
// The deploy workflow runs it on its schedule; a push builds the committed file.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const URL_ = 'https://drewhoover.com/cfb-streak-king/share/payload.json'
const base = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/data/football.json'), 'utf8'))
const SEASON = base.through + 1

const src = process.argv[2]
const p = src
  ? JSON.parse(fs.readFileSync(src, 'utf8'))
  : await fetch(URL_, { headers: { 'user-agent': 'cfb-all-time-records build (drewhoover.com)' } }).then((r) => {
      if (!r.ok) throw new Error(`build-current: ${URL_} answered ${r.status}`)
      return r.json()
    })

const g = p.games
const index = new Map(p.teams.map((t, i) => [t.espn, i]))
const teams = {}
let latest = 0
for (const t of base.teams) {
  if (!index.has(t.espn)) throw new Error(`build-current: no Streak King team has ESPN id ${t.espn} (${t.name})`)
  teams[t.slug] = { w: 0, l: 0, t: 0 }
}
const slugOf = new Map(base.teams.map((t) => [index.get(t.espn), t.slug]))
for (let k = 0; k < g.se.length; k++) {
  if (g.se[k] !== SEASON) continue
  latest = Math.max(latest, g.ep[k])
  for (const [me, mine, theirs] of [[g.hi[k], g.hs[k], g.as[k]], [g.ai[k], g.as[k], g.hs[k]]]) {
    const r = teams[slugOf.get(me)]
    if (r) r[mine > theirs ? 'w' : mine < theirs ? 'l' : 't']++
  }
}

const through = latest ? new Date(latest * 86400000).toISOString().slice(0, 10) : null
const played = Object.values(teams).filter((r) => r.w + r.l + r.t).length
fs.writeFileSync(
  path.join(ROOT, 'src/data/current.json'),
  JSON.stringify({ season: SEASON, through, source: URL_, builtAt: p.builtAt, teams }) + '\n',
)
console.log(`current: ${SEASON} through ${through ?? 'no games yet'}, ${played} of ${base.teams.length} programs have played, from Streak King's payload built ${p.builtAt}`)
