// The era word: all time and the named eras, then "another year…", which turns
// the word into a box for any year. Four digits that make a year the data has
// count at once, so the board follows the typing; leaving the box (or Enter)
// puts the word back, and a year that isn't one leaves the board as it was.
// The box is always in the page, hidden, so choosing "another year…" can focus
// it inside the tap itself: a phone opens its keyboard only for that.

import { useRef, useState } from 'react';
import * as F from '../lib/football.js';
import { Picker } from './Picker.jsx';

const ANOTHER = 'another';

export function EraPicker({ since, onChange }) {
  const [typing, setTyping] = useState(false);
  const [draft, setDraft] = useState('');
  const box = useRef(null);
  const from = useRef(since); // the year the box opened on, so leaving it tracks only a change
  const keep = useRef(false); // the menu closing leaves focus in the box
  const options = [
    { value: null, label: F.eraLabel(null) },
    ...F.ERAS.map((e) => ({ value: e.year, label: F.eraLabel(e.year), hint: e.hint })),
    ...(since && !F.ERA_YEARS.includes(since) ? [{ value: since, label: F.eraLabel(since) }] : []),
    { value: ANOTHER, label: 'another year…', hint: `${F.FIRST_SEASON + 1} to ${F.SEASON}` },
  ];
  const pick = (v) => {
    if (v !== ANOTHER) { onChange(v, { track: true }); return; }
    from.current = since;
    keep.current = true;
    setDraft('');
    setTyping(true);
    box.current?.focus();
  };
  const type = (s) => {
    s = s.replace(/[^0-9]/g, '').slice(0, 4);
    setDraft(s);
    if (s.length === 4 && F.isSince(Number(s)) && Number(s) !== since) onChange(Number(s), { track: false });
  };
  const leave = () => {
    setTyping(false);
    if (since !== from.current) onChange(since, { track: true });
  };
  return (
    <span className="era">
      {!typing && (
        <Picker value={since} options={options} onChange={pick} ariaLabel="Counting from"
          onCloseAutoFocus={(e) => { if (keep.current) { e.preventDefault(); keep.current = false; } }} />
      )}
      <span className={'yword' + (typing ? '' : ' off')}>
        since{' '}
        <input ref={box} className="yin" type="text" inputMode="numeric" pattern="[0-9]*" maxLength={4} placeholder="year"
          aria-label={`Counting from a year, ${F.FIRST_SEASON + 1} to ${F.SEASON}`} tabIndex={typing ? 0 : -1} value={draft}
          onChange={(e) => type(e.target.value)} onBlur={leave}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === 'Escape') e.currentTarget.blur(); }} />
      </span>
    </span>
  );
}
