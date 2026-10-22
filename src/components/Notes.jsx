// What to read next, the citing ask with Ko-fi, the Method frame and the
// footer: the static copy every page carries.
import { track } from '../lib/analytics.js';

export const KOFI_URL = 'https://ko-fi.com/drewhooverdotcom';
export const REPO_URL = 'https://github.com/DrewHoo/cfb-all-time-records';
const BASE = import.meta.env.BASE_URL;

const SIBLINGS = [
  ['streak-king', 'https://drewhoover.com/cfb-streak-king/', 'Streak King', 'design a streak from up to four constraints; every FBS team ranked by its longest active run.'],
  ['how-many-rings', 'https://drewhoover.com/how-many-rings/', 'How Many Rings?', 'every person on a football national-championship staff since 1990, ranked by rings, each one cited.'],
  ['hostile-territory', 'https://drewhoover.com/hostile-territory/', 'Hostile Territory', "every head coach's true road record against AP top-10 teams since 1936, one chip per game."],
  ['nfl-comparator', 'https://drewhoover.com/nfl-comparator/', 'NFL Comparator', 'compare NFL players at the same point in their careers: who, which stat, through how many games or starts, since 1999.'],
  ['wnba-comparator', 'https://drewhoover.com/wnba-comparator/', 'WNBA Comparator', 'the same comparison for WNBA players: points, assists, 30-point games, through the first N games of a career.'],
  ['collegiate-championships', 'https://drewhoover.com/collegiate-championships/', 'Who has the most college championships?', 'every NCAA champion since 1972, 33 sports, one grid.'],
];

export function ReadNext({ here }) {
  return (
    <>
      <h2>What to read next</h2>
      <div className="notes">
        {SIBLINGS.map(([key, href, name, line]) => (
          <p key={key}><a href={href} onClick={() => track('readnext', { from: here, to: key })}>{name}</a> — {line}</p>
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
