// What to read next: Putting Up Numbers' claims about the program the reader
// has open. The index site's back-bar embed (data-read-next="cfb") fetches and
// shuffles them and draws the top bar; the block under the board shows the
// first five of the same order as sentences. The prerender bakes the sport's
// list into the page for a crawler and for a reader the embed never reaches.
// puttingupnumbers' specs/read-next-across-sites.spec.md.
import PUN_SLUGS from './punSlugs.json';
import { track } from './analytics.js';

export const PUN_ORIGIN = 'https://puttingupnumbers.com';
/** the block's length, and the fewest it shows */
const BLOCK = 5;
const FEWEST = 3;

/** PUN's slug for one of our programs: ours, but Texas A&M's (punSlugs.json) */
export const punSlug = (slug) => PUN_SLUGS[slug] ?? slug;

/** the subject the embed reads off <html>: the open program, or none (then it uses the last one any sports site set) */
export function setSubject(slug) {
  const el = document.documentElement;
  if (slug) el.setAttribute('data-dh-subject', `team:${punSlug(slug)}`);
  else el.removeAttribute('data-dh-subject');
}

let baked = [];
/** the list the prerender baked into the page: set by the prerender before it renders, and by main.jsx from the page before it hydrates */
export const setBaked = (links) => { baked = links; };
export const bakedLinks = () => baked;

/** the embed's order, when it has drawn enough */
export const drawnLinks = () => {
  const d = typeof window === 'undefined' ? null : window.dhReadNext;
  return d && d.links.length >= FEWEST ? d.links.slice(0, BLOCK) : null;
};

const from = () => window.location.pathname.split('/')[1] || 'index';

/** a tap on the block, counted (and remembered, so the draw drops it for 30 days) by the embed, or here when it never loaded */
export function tapLink(l, slot) {
  if (window.dhReadNext) window.dhReadNext.tap(l, slot, 'block');
  else track('readnext', { from: from(), to: l.href, id: l.id, kind: l.kind, sport: l.sport, slot, where: 'block' });
}
/** the block came on screen */
export function blockShown(links) {
  const ids = links.map((l) => l.id);
  if (window.dhReadNext) window.dhReadNext.shown('block', ids);
  else track('readnext shown', { from: from(), subject: null, ids, where: 'block' });
}
export const isPun = (href) => href.startsWith(`${PUN_ORIGIN}/`);
