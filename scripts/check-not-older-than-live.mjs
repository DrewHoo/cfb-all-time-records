#!/usr/bin/env node
// The deploy's last check: the season counts about to ship hold everything
// the live board's do. It fails when src/data/current.json runs through an
// earlier game day than the live board's current.json, or was counted from an
// older Streak King payload: a branch merged with the file it was cut with.
// Once the board has a week, no deploy takes it back.
//
// To ship older counts on purpose, put "[older data]" in the commit message
// (the workflow sets ALLOW_OLDER_DATA from it). A live board that can't be
// read isn't checked: the committed file is still the newest main has.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const LIVE = 'https://drewhoover.com/cfb-all-time-records/current.json'

const mine = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/data/current.json'), 'utf8'))
let live
try {
  const res = await fetch(`${LIVE}?t=${Date.now()}`, { headers: { 'user-agent': 'cfb-all-time-records build (drewhoover.com)' } })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  live = await res.json()
} catch (e) {
  console.log(`not checked: the live board's current.json couldn't be read (${e.message})`)
  process.exit(0)
}

const older = []
if ((mine.through ?? '') < (live.through ?? '')) older.push(`it runs through ${mine.through}, and the live board through ${live.through}`)
if (mine.builtAt < live.builtAt) older.push(`it was counted from the payload built ${mine.builtAt}, and the live board's from ${live.builtAt}`)
if (!older.length) {
  console.log(`the counts (through ${mine.through}, payload ${mine.builtAt}) are no older than the live board's (through ${live.through}, payload ${live.builtAt})`)
  process.exit(0)
}
console.error(`This build would take the live board back: ${older.join('; ')}.`)
if (process.env.ALLOW_OLDER_DATA) {
  console.error('Shipping it anyway: the commit says [older data].')
  process.exit(0)
}
console.error('Pull main and run node scripts/build-current.mjs, or put "[older data]" in the commit message to ship it on purpose.')
process.exit(1)
