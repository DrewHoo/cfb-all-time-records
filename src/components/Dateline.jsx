// The line above the title: provenance on the left, the icon bar on the
// right. The bar is the same on both pages less the page's own icon: find a
// school, the other page, ko-fi, share.
import { track } from '../lib/analytics.js';
import { KOFI_URL } from './Notes.jsx';
import { SchoolPicker } from './SchoolPicker.jsx';
import { ShareIcon, SearchIcon, CoffeeIcon, GridIcon, ListIcon, CloseIcon } from './Icons.jsx';

const BASE = import.meta.env.BASE_URL;

/** `here`: 'grid' or 'football' (also the `from` its clicks report). `find`: { items, onPick, placeholder, title, none } */
export function NavIcons({ here, find, onShare, copied, isMobile }) {
  return (
    <span className="dateline-acts">
      {find && (
        <SchoolPicker items={find.items} onPick={find.onPick} isMobile={isMobile} placeholder={find.placeholder} title={find.title} none={find.none}>
          <button className="ico" aria-label={find.placeholder ?? 'Find a school'}><SearchIcon /></button>
        </SchoolPicker>
      )}
      {here !== 'grid' && <a className="ico" href={BASE} onClick={() => track('nav', { from: here, to: 'grid' })} aria-label="Every NCAA champion, in one grid"><GridIcon /></a>}
      {here !== 'football' && <a className="ico" href={`${BASE}football.html`} onClick={() => track('nav', { from: here, to: 'football' })} aria-label="All-time FBS football records"><ListIcon /></a>}
      <a className="ico" href={KOFI_URL} onClick={() => track('kofi', { from: `icons ${here}` })} aria-label="Buy me a coffee"><CoffeeIcon /></a>
      <button className="ico" onClick={onShare} aria-label="Share"><ShareIcon /></button>
      {copied && <span className="toast">copied</span>}
    </span>
  );
}

export function Dateline({ span, children }) {
  return (
    <div className="dateline">
      <span>drewhoover.com · {span}</span>
      {children}
    </div>
  );
}

export { CloseIcon };
