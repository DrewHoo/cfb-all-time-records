// The line above the title: provenance on the left, the icon bar on the
// right: find a program, ko-fi, share.
import { track } from '../lib/analytics.js';
import { KOFI_URL } from './Notes.jsx';
import { SchoolPicker } from './SchoolPicker.jsx';
import { ShareIcon, SearchIcon, CoffeeIcon, CloseIcon } from './Icons.jsx';

/** `here`: the page, the `from` its clicks report. `find`: { items, onPick, placeholder, title, none } */
export function NavIcons({ here, find, onShare, copied, isMobile }) {
  return (
    <span className="dateline-acts">
      {find && (
        <SchoolPicker items={find.items} onPick={find.onPick} isMobile={isMobile} placeholder={find.placeholder} title={find.title} none={find.none}>
          <button className="ico" aria-label={find.placeholder ?? 'Find a school'}><SearchIcon /></button>
        </SchoolPicker>
      )}
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
