// The share worker: sits on drewhoover.com/cfb-all-time-records/* in front
// of GitHub Pages and makes a shared URL unfurl as itself. GitHub Pages
// serves one HTML for every query string; this is the piece that makes a
// ranked board or an open program (?sort=, ?conf=, ?t=) read as its own page.
//
//   <head> rewrite  an address whose query says more than the prerendered
//                   page gets its own title, description and og tags,
//                   worded by src/lib/share.js (pure, the site's own words)
//   /share/og.png   the card drawn on demand (card.ts) from the data this
//                   bundle carries (src/data): the top of the board, the
//                   open program swapped in and lit. Cached at the edge.
//   old addresses   the board lived at /football.html (301 to the root, query
//                   kept); the championship grid that was the root moved to
//                   collegiate-championships, so a ?s= address 301s there.
//
// Anything else — and anything that goes wrong — passes through untouched:
// this worker must never be the reason the site is down.
//
// Deploy: npm run worker:deploy (deploy.yml does it after every push to
// main). To see a card locally: npm run build, npm run preview (4173), then
// npm run worker:dev and open
//   http://localhost:8787/cfb-all-time-records/share/og.png?sort=winPct&conf=SEC&t=alabama

import * as F from '../../src/lib/football.js';
import * as S from '../../src/lib/share.js';
import { renderCard, type CardRow } from './card.ts';

interface Env { ORIGIN?: string; NO_REPORT?: string }

const BASE = '/cfb-all-time-records';
const SITE = 'cfb-all-time-records';

/** Bump on any change to what the card draws or how a URL reads; it keys the edge cache. */
const CARD_VERSION = '2026-10-21b';

// Analytics: one Mixpanel event per link preview, sent server-side to the
// index site's project (the public token its embed carries; a project token
// only writes). The bot that fetches a shared link runs no script, so this
// is the only place a share can be counted. Nothing personal goes: the
// crawler's name, its user agent only when it is a crawler, the country
// Cloudflare saw, the URL itself and its slots.
const MIXPANEL_TOKEN = '1c6a0f45b8a5768185a8d9a2f4d65452';
const AGENTS: [RegExp, string][] = [
  [/Slackbot|Slack-ImgProxy/i, 'slack'], [/Discordbot/i, 'discord'], [/TelegramBot/i, 'telegram'], [/WhatsApp/i, 'whatsapp'],
  [/LinkedInBot/i, 'linkedin'], [/redditbot/i, 'reddit'], [/Bluesky/i, 'bluesky'], [/Mastodon/i, 'mastodon'],
  [/Facebot.*Twitterbot|Twitterbot.*Facebot/i, 'imessage'], [/Twitterbot/i, 'twitter'], [/facebookexternalhit|Facebot/i, 'facebook'],
  [/Googlebot/i, 'google'], [/bingbot/i, 'bing'], [/Applebot/i, 'apple'], [/bot|crawler|spider|preview|fetch|embed|scraper/i, 'other-bot'],
];
const agentOf = (ua: string | null): string => AGENTS.find(([re]) => re.test(ua ?? ''))?.[1] ?? 'browser';

function report(env: Env, ctx: ExecutionContext, request: Request, event: string, props: Record<string, unknown>) {
  if (env.NO_REPORT) return;
  try {
    const ua = request.headers.get('user-agent');
    const agent = agentOf(ua);
    const body = [{
      event,
      properties: {
        token: MIXPANEL_TOKEN, distinct_id: `unfurl:${agent}`, $insert_id: crypto.randomUUID(), time: Math.floor(Date.now() / 1000),
        site: SITE, agent, crawler: agent === 'browser' ? null : (ua ?? '').slice(0, 200),
        country: (request as Request & { cf?: { country?: string } }).cf?.country ?? null,
        ...props,
      },
    }];
    ctx.waitUntil(fetch('https://api.mixpanel.com/track?ip=0', {
      method: 'POST', headers: { 'content-type': 'application/json', accept: 'text/plain' }, body: JSON.stringify(body),
    }).then((r) => r.body?.cancel()).catch(() => {}));
  } catch {}
}

/** the board's address: the root (and index.html) */
const isBoard = (pathname: string): boolean => { const p = pathname.replace(BASE, ''); return p === '/' || p === '' || p === '/index.html'; };
/** the board's old address, before it became the root */
const isOldBoard = (pathname: string): boolean => /^\/football(?:\.html|\/)?$/.test(pathname.replace(BASE, ''));
/** the address and its slots, for an event */
const urlProps = (url: URL) => {
  const q = F.parseUrl(url.search);
  return { url: url.href, $current_url: url.href, path: url.pathname.replace(BASE, '') || '/', sort: q.sort, conf: q.conf, t: q.t };
};

const edge = (ttl: number) => ({ cf: { cacheEverything: true, cacheTtlByStatus: { '200-299': ttl, '400-599': 30 } } }) as RequestInit;

/** a mark as a data URI, from the site's committed marks or the school's color logo */
async function logoUri(src: string | null | undefined): Promise<string | null> {
  if (!src) return null;
  try {
    const res = await fetch(src, edge(86400));
    if (!res.ok) { await res.body?.cancel(); return null; }
    const buf = new Uint8Array(await res.arrayBuffer());
    let bin = '';
    for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
    const type = res.headers.get('content-type')?.includes('svg') ? 'image/svg+xml' : 'image/png';
    return `data:${type};base64,${btoa(bin)}`;
  } catch { return null; }
}

const int = (n: number) => n.toLocaleString('en-US');

/** the board card: the top of the ranked board, the open program swapped in and lit */
async function footballCard(origin: string, search: string): Promise<Response> {
  const q = F.parseUrl(search);
  const board = F.evaluate(q);
  const rows: CardRow[] = [];
  for (const r of S.footballCardRows(board, q, 6)) rows.push({ ...r, logo: await logoUri(`${origin}${BASE}/logos-color/${r.espn}.png`) });
  return renderCard({
    wordmark: S.FOOTBALL_SITE,
    heading: S.footballCardHeading(q),
    words: S.footballSentence(q),
    rows,
    footer: `${int(board.total)} ${q.conf ? `${q.conf} ` : ''}programs · through ${F.THROUGH} · drewhoover.com`,
  });
}

/** render, buffered: workers-og streams lazily, and a mid-stream failure would otherwise ship a 200 with an empty body */
async function buffered(res: Response): Promise<Response> {
  const png = await res.arrayBuffer();
  if (!png.byteLength) throw new Error('empty render');
  return new Response(png, { headers: { 'content-type': 'image/png', 'cache-control': 'public, max-age=3600, s-maxage=43200' } });
}

/** the shared address's words; null when the address says no more than the prerendered page */
function shareWords(search: string): { title: string; description: string; canon: string } | null {
  const q = F.parseUrl(search);
  if (!F.isShared(q)) return null;
  const board = F.evaluate(q);
  return { title: `${S.footballTitle(q, board)} · drewhoover.com`, description: S.footballDescription(q, board), canon: F.toUrl(q) };
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const origin = env.ORIGIN ?? 'https://drewhoover.com';

    // 0. the old addresses, moved for good
    if (isOldBoard(url.pathname)) return Response.redirect(`${origin}${BASE}/${url.search}`, 301);
    if (isBoard(url.pathname) && url.searchParams.has('s')) {
      const s = new URLSearchParams();
      for (const x of url.searchParams.getAll('s')) s.append('s', x);
      return Response.redirect(`${origin}/collegiate-championships/?${s}`, 301);
    }

    // 1. the dynamic card, cached at the edge under this deploy's version
    if (url.pathname === `${BASE}/share/og.png`) {
      try {
        const canon = F.toUrl(F.parseUrl(url.search));
        if (!canon) throw new Error('an address with nothing to draw');
        const key = new Request(`${url.origin}${url.pathname}?v=${CARD_VERSION}&${canon.slice(1)}`, { method: 'GET' });
        const cached = await caches.default.match(key);
        report(env, ctx, request, 'share card', { ...urlProps(url), cached: !!cached });
        if (cached) return cached;
        const res = await buffered(await footballCard(origin, url.search));
        ctx.waitUntil(caches.default.put(key, res.clone()));
        return res;
      } catch (e) {
        console.log(JSON.stringify({ event: 'og_render_failed', url: url.search, error: String((e as Error)?.stack ?? e) }));
        // the committed image, so a share still carries something
        return Response.redirect(`${origin}${BASE}/og.png`, 302);
      }
    }

    // 2. everything else: origin, with <head> rewritten where the address
    // says more than the prerendered page could. A same-zone subrequest
    // skips the worker and lands on GitHub Pages (and lets `wrangler dev`
    // hit the live site, or a local preview via ORIGIN).
    const res = await fetch(new Request(`${origin}${url.pathname}${url.search}`, request));
    try {
      if (request.method !== 'GET') return res;
      if (!(res.headers.get('content-type') ?? '').includes('text/html')) return res;
      if (!isBoard(url.pathname)) return res;
      const words = shareWords(url.search);
      if (!words) return res;
      const agent = agentOf(request.headers.get('user-agent'));
      if (agent !== 'browser') report(env, ctx, request, 'share unfurl', urlProps(url));
      const img = `${origin}${BASE}/share/og.png${words.canon}`;
      const content = (v: string) => ({ element(e: Element) { e.setAttribute('content', v); } });
      return new HTMLRewriter()
        .on('title', { element(e) { e.setInnerContent(words.title); } })
        .on('meta[name="description"]', content(words.description))
        .on('meta[property="og:title"]', content(words.title))
        .on('meta[property="og:description"]', content(words.description))
        .on('meta[property="og:url"]', content(`${origin}${url.pathname}${url.search}`))
        .on('meta[property="og:image"]', content(img))
        .on('meta[property="og:image:alt"]', content(`${words.title}, on a dark board.`))
        .on('meta[name="twitter:image"]', content(img))
        .on('meta[name="twitter:title"]', content(words.title))
        .on('meta[name="twitter:description"]', content(words.description))
        .transform(res);
    } catch (e) {
      console.log(JSON.stringify({ event: 'share_rewrite_failed', url: url.pathname + url.search, error: String(e) }));
      return res;
    }
  },
} satisfies ExportedHandler<Env>;
