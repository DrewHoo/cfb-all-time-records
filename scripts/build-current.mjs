// Every season since the NCAA's total stops (src/data/eras.json, through
// 2024), counted from the games, which src/lib/football.js adds to the total
// and to each era. Reads College Football Streak King's published payload,
// its weekly refresh of every game (cfbfastR's schedules, with
// CollegeFootballData's finals for a game cfbfastR hasn't marked yet), and
// writes src/data/current.json: each program's wins, losses and ties in each
// of those seasons, the running season, and the date of its latest game.
// Bowls and national titles stay Wikipedia's (src/data/football.json) until
// the bowl page is read again.
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
const FROM = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/data/eras.json'), 'utf8')).through + 1

const src = process.argv[2]
const p = src
  ? JSON.parse(fs.readFileSync(src, 'utf8'))
  : await fetch(URL_, { headers: { 'user-agent': 'cfb-all-time-records build (drewhoover.com)' } }).then((r) => {
      if (!r.ok) throw new Error(`build-current: ${URL_} answered ${r.status}`)
      return r.json()
    })

const g = p.games
const index = new Map(p.teams.map((t, i) => [t.espn, i]))
for (const t of base.teams) if (!index.has(t.espn)) throw new Error(`build-current: no Streak King team has ESPN id ${t.espn} (${t.name})`)
const slugOf = new Map(base.teams.map((t) => [index.get(t.espn), t.slug]))
// the running season is the latest one with a game on the schedule
let SEASON = FROM
for (let k = 0; k < g.se.length; k++) SEASON = Math.max(SEASON, g.se[k])
const seasons = []
for (let y = FROM; y <= SEASON; y++) seasons.push(y)
const teams = Object.fromEntries(base.teams.map((t) => [t.slug, Object.fromEntries(seasons.map((y) => [y, [0, 0, 0]]))]))
let latest = 0
for (let k = 0; k < g.se.length; k++) {
  if (g.se[k] < FROM || g.hs[k] == null || g.as[k] == null) continue
  if (g.se[k] === SEASON) latest = Math.max(latest, g.ep[k])
  for (const [me, mine, theirs] of [[g.hi[k], g.hs[k], g.as[k]], [g.ai[k], g.as[k], g.hs[k]]]) {
    const r = teams[slugOf.get(me)]?.[g.se[k]]
    if (r) r[mine > theirs ? 0 : mine < theirs ? 1 : 2]++
  }
}

const through = latest ? new Date(latest * 86400000).toISOString().slice(0, 10) : null
const played = Object.values(teams).filter((r) => r[SEASON].some((n) => n)).length
fs.writeFileSync(
  path.join(ROOT, 'src/data/current.json'),
  JSON.stringify({ season: SEASON, seasons, through, source: URL_, builtAt: p.builtAt, teams }) + '\n',
)
console.log(`current: ${seasons.join(', ')}; ${SEASON} through ${through ?? 'no games yet'}, ${played} of ${base.teams.length} programs have played, from Streak King's payload built ${p.builtAt}`)
