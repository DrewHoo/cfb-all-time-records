// src/data/eras.json, what the page reads: each program's NCAA total through
// `through`, and its record in every season from its first to `through` (null
// for a season it didn't play) and its bowls by season through `bowlsThrough`,
// so src/lib/football.js can count from any year. scripts/build-seasons.mjs
// writes it after its gate; `node scripts/lib/eras.mjs` writes it again from
// the committed data/seasons.json.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')

export function writeEras({ through, bowlsThrough, teams }) {
  const out = {}
  for (const [slug, o] of Object.entries(teams)) {
    const first = Math.min(...Object.keys(o.seasons).map(Number))
    const seasons = []
    for (let y = first; y <= through; y++) seasons.push(o.seasons[y] ?? null)
    out[slug] = { base: o.base, first, seasons, bowls: o.bowls }
  }
  const note = "scripts/lib/eras.mjs writes it: base is the NCAA's wins, losses, ties and seasons through `through`; seasons is each program's wins, losses and ties in every season from `first` to `through` (null for one it didn't play); bowls is its bowl wins, losses and ties by season through `bowlsThrough`."
  fs.writeFileSync(path.join(ROOT, 'src/data/eras.json'), JSON.stringify({ note, through: Number(through), bowlsThrough: Number(bowlsThrough), teams: out }) + '\n')
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  writeEras(JSON.parse(fs.readFileSync(path.join(ROOT, 'data/seasons.json'), 'utf8')))
  console.log('eras: wrote src/data/eras.json from data/seasons.json')
}
