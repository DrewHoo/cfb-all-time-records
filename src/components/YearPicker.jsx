// A year word in the sentence ("since 1978", "through 1997"): no year, the
// named years, then "another year…", which turns the word into a box for any
// year. Four digits that make a year the board can take count at once, so the
// board follows the typing; leaving the box (or Enter) puts the word back, and
// a year that isn't one leaves the board as it was. The box is always in the
// page, hidden, so choosing "another year…" can focus it inside the tap
// itself: a phone opens its keyboard only for that.

import { useRef, useState } from 'react';
import { Picker } from './Picker.jsx';

const ANOTHER = 'another';

/**
 * value: the year, or null; none: the word for no year ("all time");
 * word: what goes before a year ("since"); years: [{ year, hint }], the named
 * ones; lo, hi: the years a typed one can be; ariaLabel names the picker.
 */
export function YearPicker({ value, onChange, none, word, years, lo, hi, ariaLabel }) {
  const [typing, setTyping] = useState(false);
  const [draft, setDraft] = useState('');
  const box = useRef(null);
  const from = useRef(value); // the year the box opened on, so leaving it tracks only a change
  const keep = useRef(false); // the menu closing leaves focus in the box
  const label = (y) => (y ? `${word} ${y}` : none);
  const named = years.filter((e) => e.year >= lo && e.year <= hi);
  const options = [
    { value: null, label: none },
    ...named.map((e) => ({ value: e.year, label: label(e.year), hint: e.hint })),
    ...(value && !named.some((e) => e.year === value) ? [{ value, label: label(value) }] : []),
    { value: ANOTHER, label: 'another year…', hint: lo === hi ? String(lo) : `${lo} to ${hi}` },
  ];
  const pick = (v) => {
    if (v !== ANOTHER) { onChange(v, { track: true }); return; }
    from.current = value;
    keep.current = true;
    setDraft('');
    setTyping(true);
    box.current?.focus();
  };
  const type = (s) => {
    s = s.replace(/[^0-9]/g, '').slice(0, 4);
    setDraft(s);
    const y = Number(s);
    if (s.length === 4 && y >= lo && y <= hi && y !== value) onChange(y, { track: false });
  };
  const leave = () => {
    setTyping(false);
    if (value !== from.current) onChange(value, { track: true });
  };
  return (
    <span className="era">
      {!typing && (
        <Picker value={value} options={options} onChange={pick} ariaLabel={ariaLabel}
          onCloseAutoFocus={(e) => { if (keep.current) { e.preventDefault(); keep.current = false; } }} />
      )}
      <span className={'yword' + (typing ? '' : ' off')}>
        {word}{' '}
        <input ref={box} className="yin" type="text" inputMode="numeric" pattern="[0-9]*" maxLength={4} placeholder="year"
          aria-label={`${ariaLabel}, a year from ${lo} to ${hi}`} tabIndex={typing ? 0 : -1} value={draft}
          onChange={(e) => type(e.target.value)} onBlur={leave}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === 'Escape') e.currentTarget.blur(); }} />
      </span>
    </span>
  );
}
