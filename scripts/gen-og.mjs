// The social preview images, drawn from the real data in the site's own
// visual language. Run: npm run gen:og (on a Mac: the title is Georgia Bold,
// read from the system; the script throws without it so a fallback never
// gets committed). Re-run after a redesign or a data refresh worth committing.
//   public/og.png           1200x630  the grid, og:image of the root
//   public/card.png         1200x750  the grid, the 8:5 cover for the index site's project card
//   public/og-football.png  1200x630  the records board, og:image of football.html
//
// Text is drawn as glyph outlines through opentype.js (pinned 1.3.4: 2.x
// emits NaN path data), so nothing depends on fontconfig: sharp's librsvg
// never finds Google fonts and would fall back to Helvetica. The OFL TTFs
// live in scripts/fonts/. Every meaningful glyph stays inside the centered
// 720px column (x 240–960): Reddit's compact feed center-crops the 1.91:1
// card to a near-square, and a safe-zone layout survives any crop.
import { readFileSync, existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'
import opentype from 'opentype.js'
import sharp from 'sharp'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const FONTS = resolve(ROOT, 'scripts', 'fonts')
const OUT = resolve(ROOT, 'public')
const GEORGIA_BOLD = process.env.GEORGIA_BOLD ?? '/System/Library/Fonts/Supplemental/Georgia Bold.ttf'
if (!existsSync(GEORGIA_BOLD)) throw new Error(`title font missing: ${GEORGIA_BOLD} (run gen:og on a Mac, or point GEORGIA_BOLD at a Georgia Bold TTF)`)
const font = (f) => opentype.parse(readFileSync(f).buffer.slice(0))
const FONT = {
  Title: font(GEORGIA_BOLD),
  Graduate: font(resolve(FONTS, 'Graduate-Regular.ttf')),
  Mono: font(resolve(FONTS, 'IBMPlexMono-Regular.ttf')),
  MonoBold: font(resolve(FONTS, 'IBMPlexMono-SemiBold.ttf')),
  Serif: font(resolve(FONTS, 'SourceSerif4-Regular.ttf')),
}
const BG = '#282127', INK = '#efe6d9', MUTED = '#bfb2a6', FAINT = '#857a75', LINE = '#453a42', CREAM = '#f3e2bc', RUST = '#c36c36'

const width = (str, name, size, spacing = 0) => FONT[name].getAdvanceWidth(str, size, { kerning: true, letterSpacing: spacing / size })
/** one run of text as a filled path; spacing is letter-spacing in px */
function text(str, { x, y, font: name, size, fill, anchor = 'start', spacing = 0 }) {
  const opts = { kerning: true, letterSpacing: spacing / size }
  const w = width(str, name, size, spacing)
  const x0 = anchor === 'middle' ? x - w / 2 : anchor === 'end' ? x - w : x
  return `<path d="${FONT[name].getPath(str, x0, y, size, opts).toPathData(2)}" fill="${fill}"/>`
}
/** shrink a run until it fits maxW */
const fit = (str, name, size, maxW) => { while (size > 10 && width(str, name, size) > maxW) size -= 1; return size }
const int = (n) => n.toLocaleString('en-US')

// the site's own model, through vite so the JSON imports and BASE_URL resolve
const vite = await createServer({ root: ROOT, server: { middlewareMode: true }, appType: 'custom', logLevel: 'warn' })
const C = await vite.ssrLoadModule('/src/lib/champs.js')
const F = await vite.ssrLoadModule('/src/lib/football.js')
const S = await vite.ssrLoadModule('/src/lib/share.js')
await vite.close()

/** a mono stamp (white with alpha) recolored to a solid, sized, as a data URI */
const stampCache = new Map()
async function stamp(school, size, rgb) {
  const key = `${school}|${size}|${rgb.join()}`
  if (stampCache.has(key)) return stampCache.get(key)
  const file = resolve(OUT, 'logos', 'mono', `${C.slugOf(school)}.png`)
  let uri = null
  if (existsSync(file)) {
    const { data, info } = await sharp(file).resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
    for (let i = 0; i < data.length; i += 4) { data[i] = rgb[0]; data[i + 1] = rgb[1]; data[i + 2] = rgb[2] }
    const png = await sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } }).png().toBuffer()
    uri = `data:image/png;base64,${png.toString('base64')}`
  }
  stampCache.set(key, uri)
  return uri
}
const colorLogo = (espn) => `data:image/png;base64,${readFileSync(resolve(OUT, 'logos-color', `${espn}.png`)).toString('base64')}`

const frame = (W, H, inner) => `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs><radialGradient id="lamp" cx="${W / 2}" cy="-126" r="${W * 0.55}" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="${CREAM}" stop-opacity="0.13"/><stop offset="0.65" stop-color="${CREAM}" stop-opacity="0"/></radialGradient></defs>
  <rect width="${W}" height="${H}" fill="${BG}"/><rect width="${W}" height="${H}" fill="url(#lamp)"/>
  ${inner}
</svg>`

// --- the grid: the newest complete years across every sport, the leader lit ---
async function renderGrid(W, H) {
  const lead = C.leaderboard[0]
  const cols = C.sortedSports.length
  const cell = 22
  const yearW = 40
  const boardW = yearW + cols * cell // 700
  const x0 = (W - boardW) / 2
  const headY = 190
  const rowsN = Math.floor((H - headY - 70) / cell)
  // the newest years with a full row of champions (the running year is partial)
  const years = C.descendingYears.filter((y) => C.sortedSports.filter((s) => C.champsOf(s.key, y).length).length >= cols * 0.8).slice(0, rowsN)
  const parts = []
  parts.push(text('NCAA DIVISION I CHAMPIONSHIPS', { x: W / 2, y: 60, font: 'MonoBold', size: 16, fill: RUST, anchor: 'middle', spacing: 4 }))
  parts.push(text(`Every champion since ${C.FIRST}`, { x: W / 2, y: 116, font: 'Title', size: 46, fill: CREAM, anchor: 'middle' }))
  parts.push(text(`${cols} sports in one grid. ${lead.school} leads with ${lead.total} titles; ${int(C.leaderboard.length)} schools have won at least one.`, { x: W / 2, y: 152, font: 'Serif', size: fit(`${cols} sports in one grid. ${lead.school} leads with ${lead.total} titles; ${int(C.leaderboard.length)} schools have won at least one.`, 'Serif', 21, 720), fill: MUTED, anchor: 'middle' }))
  const faint = [0x9a, 0x8e, 0x88]
  const lit = [0xf3, 0xe2, 0xbc]
  for (let r = 0; r < years.length; r++) {
    const y = headY + r * cell
    const yr = years[r]
    parts.push(text(String(yr), { x: x0 + yearW - 8, y: y + cell - 6, font: 'Mono', size: 11, fill: yr % 10 === 0 ? INK : FAINT, anchor: 'end' }))
    parts.push(`<line x1="${x0}" y1="${y + cell}" x2="${x0 + boardW}" y2="${y + cell}" stroke="${LINE}" stroke-width="1" stroke-dasharray="1 2"/>`)
    for (let c = 0; c < cols; c++) {
      const champs = C.champsOf(C.sortedSports[c].key, yr)
      if (!champs.length) continue
      const school = champs[0]
      const hero = school === lead.school
      const uri = await stamp(school, 16, hero ? lit : faint)
      if (!uri) continue
      parts.push(`<image href="${uri}" x="${x0 + yearW + c * cell + 3}" y="${y + 3}" width="16" height="16"${hero ? '' : ' opacity="0.6"'}/>`)
    }
  }
  const titles = C.leaderboard.reduce((n, r) => n + r.total, 0)
  parts.push(text(`${C.FIRST}–${C.LAST} · ${int(titles)} TITLES · ${int(C.leaderboard.length)} SCHOOLS · DREWHOOVER.COM`, { x: W / 2, y: H - 30, font: 'Mono', size: 14, fill: FAINT, anchor: 'middle', spacing: 2 }))
  return frame(W, H, parts.join('\n'))
}

// --- the records board: the top of the default board ---
function renderFootball(W, H) {
  const q = F.DEFAULT
  const board = F.evaluate(q)
  const rows = S.footballCardRows(board, q, 6)
  const parts = []
  parts.push(text('COLLEGE FOOTBALL ALL-TIME RECORDS', { x: W / 2, y: 60, font: 'MonoBold', size: 16, fill: RUST, anchor: 'middle', spacing: 4 }))
  parts.push(text(`All ${int(F.TEAMS.length)} FBS programs, ranked`, { x: W / 2, y: 116, font: 'Title', size: 46, fill: CREAM, anchor: 'middle' }))
  parts.push(text(`By ${F.SORTS[q.sort].label}, every game through ${F.THROUGH}. Win-loss, bowls and national titles for every program.`, { x: W / 2, y: 152, font: 'Serif', size: 21, fill: MUTED, anchor: 'middle' }))
  const x0 = 240
  const rowH = 62
  let y = 182
  for (const r of rows) {
    const team = F.TEAMS.find((t) => t.name === r.name)
    parts.push(text(r.rank, { x: x0 + 34, y: y + 38, font: 'Mono', size: 15, fill: r.rank === '1' ? CREAM : FAINT, anchor: 'end', spacing: 1 }))
    parts.push(`<image href="${colorLogo(team.espn)}" x="${x0 + 50}" y="${y + 12}" width="38" height="38"/>`)
    parts.push(text(r.name, { x: x0 + 102, y: y + 30, font: 'Serif', size: 25, fill: INK }))
    parts.push(text(r.span.toUpperCase(), { x: x0 + 102, y: y + 49, font: 'Mono', size: 12, fill: FAINT, spacing: 1 }))
    parts.push(text(r.value, { x: x0 + 720, y: y + 42, font: 'Graduate', size: 32, fill: CREAM, anchor: 'end' }))
    parts.push(`<line x1="${x0}" y1="${y + rowH}" x2="${x0 + 720}" y2="${y + rowH}" stroke="${LINE}" stroke-width="1" stroke-dasharray="3 3"/>`)
    y += rowH
  }
  if (y + 18 > H - 50) throw new Error('football card: rows run past the footer')
  parts.push(text(`${int(F.TEAMS.length)} PROGRAMS · THROUGH ${F.THROUGH} · DREWHOOVER.COM`, { x: W / 2, y: H - 30, font: 'Mono', size: 14, fill: FAINT, anchor: 'middle', spacing: 2 }))
  return frame(W, H, parts.join('\n'))
}

// density 72 renders the SVG at its own size (96 would scale it by 4/3)
const png = (svg) => sharp(Buffer.from(svg), { density: 72 }).png({ compressionLevel: 9, palette: true, colors: 192 })
for (const [file, W, H] of [['og.png', 1200, 630], ['card.png', 1200, 750]]) {
  const info = await png(await renderGrid(W, H)).toFile(resolve(OUT, file))
  console.log(`${file}: ${info.width}x${info.height}, ${(info.size / 1024).toFixed(0)}KB`)
}
const info = await png(renderFootball(1200, 630)).toFile(resolve(OUT, 'og-football.png'))
console.log(`og-football.png: ${info.width}x${info.height}, ${(info.size / 1024).toFixed(0)}KB`)
