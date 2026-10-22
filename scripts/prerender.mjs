// Runs after `vite build`. Bakes each page's rendered markup into its HTML
// (dist/index.html, dist/football.html), adds JSON-LD and the index site's
// embeds, and writes dist/sitemap.xml.
//
// Without this the deployed page is `<div id="root"></div>` and every word on
// it exists only after React runs. Google usually renders JS in a deferred
// second pass; Bing, DuckDuckGo, social unfurlers and the LLM crawlers
// largely don't. The <head> itself stays in each page's HTML; this fills the
// body and adds what the HTML can't carry by hand.
import { createServer } from 'vite'
import { renderToString } from 'react-dom/server'
import React from 'react'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const ORIGIN = 'https://drewhoover.com'
const SITE = `${ORIGIN}/cfb-all-time-records/`

const vite = await createServer({ root: ROOT, server: { middlewareMode: true }, appType: 'custom', logLevel: 'warn' })

const PAGES = [
  { file: 'index.html', module: '/src/ChampionshipGrid.jsx', url: SITE },
  { file: 'football.html', module: '/src/FootballRecords.jsx', url: `${SITE}football.html` },
]

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')

for (const p of PAGES) {
  const out = path.join(ROOT, 'dist', p.file)
  const { default: App } = await vite.ssrLoadModule(p.module)
  const appHtml = renderToString(React.createElement(App))
  let html = fs.readFileSync(out, 'utf8')

  // Throw rather than no-op: a Vite change that renames the marker would
  // otherwise quietly ship an empty page again.
  if (!html.includes('<div id="root"></div>')) throw new Error(`prerender: no empty #root in ${p.file}`)
  const title = html.match(/<title>([^<]*)<\/title>/)?.[1]
  const description = html.match(/<meta name="description" content="([^"]*)"/)?.[1]
  if (!title || !description) throw new Error(`prerender: no <title>/description in ${p.file}`)

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      { '@type': 'WebPage', '@id': p.url, url: p.url, name: title, description, isPartOf: { '@type': 'WebSite', url: `${ORIGIN}/`, name: 'drewhoover.com' } },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'drewhoover.com', item: `${ORIGIN}/` },
          { '@type': 'ListItem', position: 2, name: 'Sports', item: `${ORIGIN}/sports/` },
          { '@type': 'ListItem', position: 3, name: title, item: p.url },
        ],
      },
    ],
  }
  html = html.replace(
    '</head>',
    `    <script src="${ORIGIN}/embed/back-bar.js" data-section="sports" async></script>
    <script src="${ORIGIN}/embed/giscus.js" async></script>
    <script src="${ORIGIN}/embed/analytics.js" async></script>
    <script type="application/ld+json">${JSON.stringify(jsonLd).replace(/</g, '\\u003c')}</script>
  </head>`,
  )
  html = html.replace('<div id="root"></div>', `<div id="root">${appHtml}</div>`)
  fs.writeFileSync(out, html)
  const words = appHtml.replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length
  console.log(`${p.file}: prerendered ${(appHtml.length / 1024).toFixed(0)}KB into #root (~${words} words)`)
}
await vite.close()

// the sitemap: both pages, with lastmod, what Search Console wants submitted
const lastmod = new Date().toISOString().slice(0, 10)
fs.writeFileSync(
  path.join(ROOT, 'dist/sitemap.xml'),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${PAGES.map((p) => `  <url>\n    <loc>${esc(p.url)}</loc>\n    <lastmod>${lastmod}</lastmod>\n  </url>`).join('\n')}\n</urlset>\n`,
)
