// What to read next (Putting Up Numbers' claims, lib/readNext.js), the citing
// ask with Ko-fi, the Method frame and the footer: what every page carries.
import { useEffect, useRef, useState } from 'react';
import { track } from '../lib/analytics.js';
import { bakedLinks, drawnLinks, tapLink, blockShown, isPun } from '../lib/readNext.js';

export const KOFI_URL = 'https://ko-fi.com/drewhooverdotcom';
export const REPO_URL = 'https://github.com/DrewHoo/cfb-all-time-records';
const BASE = import.meta.env.BASE_URL;

// What to read next: the first five of the back-bar embed's draw, as
// sentences, each a link. Until the embed draws (and when it never does) the
// list the prerender baked into the page; with neither, no block.
export function ReadNext() {
  // the baked list first, so the hydrate matches the prerender
  const [links, setLinks] = useState(bakedLinks);
  const ref = useRef(null);
  useEffect(() => {
    const take = () => setLinks(drawnLinks() ?? bakedLinks());
    take();
    window.addEventListener('dh:readnext', take);
    return () => window.removeEventListener('dh:readnext', take);
  }, []);
  // a sighting once the block is on screen, again when the draw changes
  useEffect(() => {
    if (!links.length || !ref.current || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver((seen) => {
      if (!seen.some((e) => e.isIntersecting)) return;
      io.disconnect();
      blockShown(links);
    });
    io.observe(ref.current);
    return () => io.disconnect();
  }, [links]);
  if (!links.length) return null;
  return (
    <>
      <h2>What to read next</h2>
      <div className="notes readnext" ref={ref}>
        {links.map((l, i) => (
          <p key={l.id}>
            <a href={l.href} referrerPolicy={isPun(l.href) ? 'no-referrer-when-downgrade' : undefined} onClick={() => tapLink(l, i + 1)}>{l.text}</a>
          </p>
        ))}
      </div>
    </>
  );
}

/** `what`: "a record" / "a title count" */
export function Cite({ what }) {
  return (
    <>
      <h2>Using {what} from here</h2>
      <div className="notes">
        <p>
          If {what} from this page ends up in your article, broadcast, podcast or thread, please cite it: name the site and link to
          the view where sensible; the url encodes what the page shows into it.
        </p>
        <p>
          The site is free and serves no ads. If you enjoyed using it, consider{' '}
          <a href={KOFI_URL} onClick={() => track('kofi', { from: 'notes' })}>buying me some server compute</a>.
        </p>
      </div>
    </>
  );
}

export function Method({ children }) {
  return (
    <section className="notes" id="method" aria-label="Method">
      <h2>Method</h2>
      {children}
    </section>
  );
}

export function SiteFooter() {
  return (
    <footer>
      <a href="https://drewhoover.com/">drewhoover.com</a> · <a href={REPO_URL}>source &amp; data</a> ·{' '}
      <a href={KOFI_URL} onClick={() => track('kofi', { from: 'footer' })}>buy me a coffee</a>
    </footer>
  );
}
