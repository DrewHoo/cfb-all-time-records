// What to read next, the citing ask with Ko-fi, the Method frame and the
// footer: the static copy every page carries.
import { track } from '../lib/analytics.js';

export const KOFI_URL = 'https://ko-fi.com/drewhooverdotcom';
export const REPO_URL = 'https://github.com/DrewHoo/cfb-all-time-records';
const BASE = import.meta.env.BASE_URL;

// Every other sports site, in the order the sites share: [tracking key, address, name, the line after the dash].
// scripts/prerender.mjs reads this list too, for dist/llms.txt.
/** Putting Up Numbers (puttingupnumbers.com), where the comparators live now: one link a sport */
const PUN_SPORTS = [['College Football', 'cfb'], ['NFL', 'nfl'], ['NBA', 'nba'], ['WNBA', 'wnba'], ['NHL', 'nhl'], ['Soccer', 'soccer']].map(([name, id]) => ({ name, url: `https://puttingupnumbers.com/${id}/` }))
export const SIBLINGS = [
  ['puttingupnumbers', 'https://puttingupnumbers.com/', 'Putting Up Numbers', 'compare players, coaches, and teams on wins.', PUN_SPORTS],
  ['streak-king', 'https://drewhoover.com/cfb-streak-king/', 'College Football Streak King', 'the longest active and all-time winning and losing streaks in college football, under any definition, every FBS game since 1936.'],
  ['hostile-territory', 'https://drewhoover.com/hostile-territory/', 'Hostile Territory', "every head coach's true road record against AP top-10 teams since 1936."],
  ['how-many-rings', 'https://drewhoover.com/how-many-rings/', 'How Many Rings?', 'every person on a national-championship staff since 1990, ranked by the number of rings they can claim.'],
  ['collegiate-championships', 'https://drewhoover.com/collegiate-championships/', 'Collegiate Championships', 'which schools have won the most NCAA championships, across 33 sports.'],
];

export function ReadNext({ here }) {
  return (
    <>
      <h2>What to read next</h2>
      <div className="notes">
        {SIBLINGS.map(([key, href, name, line, links]) => (
          <p key={key}><a href={href} onClick={() => track('readnext', { from: here, to: key })}>{name}</a>{links ? ': ' : ' — '}{line}{links?.map((l, i) => <span key={l.url}>{i ? ' | ' : ' '}<a href={l.url} onClick={() => track('readnext', { from: here, to: `puttingupnumbers/${l.name}` })}>{l.name}</a></span>)}</p>
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
