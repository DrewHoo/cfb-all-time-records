// The share card: a board drawn as a 1200x630 PNG through workers-og
// (satori + resvg wired for workerd). The design follows scripts/gen-og.mjs:
// the dark room, a rust wordmark, Graduate counts, serif names, mono small
// print. Fonts ride in the bundle (OFL; the same faces the site uses).
import { ImageResponse } from 'workers-og';
import graduate from './fonts/Graduate-Regular.ttf';
import mono from './fonts/IBMPlexMono-Regular.ttf';
import monoBold from './fonts/IBMPlexMono-SemiBold.ttf';
import serif from './fonts/SourceSerif4-Regular.ttf';

const BG = '#282127', INK = '#efe6d9', MUTED = '#bfb2a6', FAINT = '#857a75', LINE = '#453a42', CREAM = '#f3e2bc', RUST = '#c36c36';

export interface CardRow {
  rank: string;
  name: string;
  /** mono small print under the name */
  span: string;
  value: string;
  /** the open row: lit */
  hi: boolean;
  /** a data URI, drawn before the name */
  logo?: string | null;
}
export interface Card {
  /** "COLLEGE FOOTBALL ALL-TIME RECORDS" */
  wordmark: string;
  /** "FBS PROGRAMS BY ALL-TIME WINS" */
  heading: string;
  /** a data URI beside the heading (a school's mark) */
  headLogo?: string | null;
  /** the whole sentence */
  words: string;
  rows: CardRow[];
  /** "136 PROGRAMS · THROUGH 2025 · DREWHOOVER.COM" */
  footer: string;
}

// satori reads the text as-is, entities included, so only the characters
// that would open a tag or close an attribute are escaped
const esc = (s: string) => s.replace(/</g, '&lt;').replace(/"/g, '&quot;');

// the heading is one line inside the 720px column: Graduate runs about 0.62em
// a character, so a long one drops its size rather than wrapping
export const headingSize = (heading: string): number => Math.max(20, Math.min(34, Math.floor(720 / (0.62 * Math.max(1, heading.length)))));

export function renderCard(card: Card): Response {
  const rowH = card.rows.length > 6 ? 52 : 62;
  const rows = card.rows.map((r) => `
    <div style="display:flex; flex-direction:row; align-items:center; gap:14px; height:${rowH}px; padding:0 10px; margin:0 -10px; border-bottom:1px dashed ${LINE}; ${r.hi ? `background-color: rgba(243,226,188,0.08); border-radius:6px;` : ''}">
      <div style="display:flex; justify-content:flex-end; width:40px; font-family:'IBM Plex Mono'; font-size:15px; letter-spacing:1px; color:${r.rank === '1' ? CREAM : FAINT};">${esc(r.rank)}</div>
      ${r.logo ? `<img src="${r.logo}" width="36" height="36" style="width:36px; height:36px; object-fit:contain;" />` : '<div style="display:flex; width:0px;"></div>'}
      <div style="display:flex; flex-direction:column; flex-grow:1; width:${r.logo ? 440 : 490}px;">
        <div style="display:flex; font-family:'Source Serif 4'; font-size:${rowH > 55 ? 25 : 21}px; color:${INK}; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${esc(r.name)}</div>
        <div style="display:flex; font-family:'IBM Plex Mono'; font-size:12px; letter-spacing:1px; color:${FAINT}; margin-top:1px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${esc(r.span.toUpperCase())}</div>
      </div>
      <div style="display:flex; justify-content:flex-end; width:150px; font-family:'Graduate'; font-size:32px; color:${CREAM};">${esc(r.value)}</div>
    </div>`).join('');

  // every meaningful glyph stays inside the centered 720px column: Reddit's
  // compact feed center-crops the 1.91:1 card to a near-square thumbnail
  const html = `
  <div style="display:flex; flex-direction:column; align-items:center; width:1200px; height:630px; background-color:${BG}; padding:40px 0 32px;
              background-image: radial-gradient(circle at 600px -126px, rgba(243,226,188,0.13) 0%, rgba(243,226,188,0) 65%);">
    <div style="display:flex; font-family:'IBM Plex Mono'; font-weight:600; font-size:16px; letter-spacing:4px; color:${RUST};">${esc(card.wordmark.toUpperCase())}</div>
    <div style="display:flex; flex-direction:row; align-items:center; gap:14px; margin-top:10px; max-width:720px;">
      ${card.headLogo ? `<img src="${card.headLogo}" width="44" height="44" style="width:44px; height:44px; object-fit:contain;" />` : ''}
      <div style="display:flex; font-family:'Graduate'; font-size:${headingSize(card.heading)}px; color:${CREAM}; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${esc(card.heading.toUpperCase())}</div>
    </div>
    <div style="display:flex; font-family:'Source Serif 4'; font-size:21px; color:${MUTED}; margin-top:2px; max-width:720px; text-align:center;">${esc(card.words)}</div>
    <div style="display:flex; flex-direction:column; margin-top:12px; flex-grow:1; width:720px;">${rows}</div>
    <div style="display:flex; font-family:'IBM Plex Mono'; font-size:14px; letter-spacing:2px; color:${FAINT}; margin-top:10px;">${esc(card.footer.toUpperCase())}</div>
  </div>`;

  return new ImageResponse(html, {
    width: 1200,
    height: 630,
    fonts: [
      { name: 'Graduate', data: graduate as ArrayBuffer, weight: 400, style: 'normal' },
      { name: 'IBM Plex Mono', data: mono as ArrayBuffer, weight: 400, style: 'normal' },
      { name: 'IBM Plex Mono', data: monoBold as ArrayBuffer, weight: 600, style: 'normal' },
      { name: 'Source Serif 4', data: serif as ArrayBuffer, weight: 400, style: 'normal' },
    ],
  });
}
