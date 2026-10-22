// Every NCAA Division I national champion since 1990, 30 sports in one grid:
// years down, sports across, a school's mark in each cell. The board rests
// monochrome; a school picked or hovered lights every title it has won in
// its own colors. The address carries the picked schools (?s=).
import { useState, useMemo, useCallback, useRef, useEffect, Fragment, memo } from 'react';
import * as C from './lib/champs.js';
import { getLogoUrl, getMonoLogoUrl } from './championshipData.js';
import { gridSentence, gridShareText, gridTitle, GRID_SITE } from './lib/share.js';
import { track } from './lib/analytics.js';
import { Dateline, NavIcons } from './components/Dateline.jsx';
import { ReadNext, Cite, Method, SiteFooter } from './components/Notes.jsx';
import { useShare } from './hooks/useShare.js';
import { useIsMobile } from './hooks/useIsMobile.js';
import { SchoolPicker } from './components/SchoolPicker.jsx';

const BASE = import.meta.env.BASE_URL;
// Sport header icons (Fluent Emoji High Contrast, MIT — see public/icons/),
// applied as CSS masks so they wear the page's ink. They live in public/ so
// the path is the same string in the prerender and the built bundle.
const sportIconUrl = (name) => `${BASE}icons/${name}.svg`;
const ICONS = {
  football: 'football', mbb: 'basketball', wbb: 'basketball', baseball: 'baseball', softball: 'softball', mvb: 'volleyball', wvb: 'volleyball',
  mih: 'ice-hockey', wih: 'ice-hockey', msoc: 'soccer', wsoc: 'soccer', mlax: 'lacrosse', wlax: 'lacrosse', wfh: 'field-hockey', wgym: 'gymnastics',
  mten: 'tennis', wten: 'tennis', mgolf: 'golf', wgolf: 'golf', mswim: 'swimming-diving', wswim: 'swimming-diving', mwp: 'water-polo', wwp: 'water-polo',
  wrestling: 'wrestling', mxc: 'running', wxc: 'running', mitf: 'running', witf: 'running', motf: 'running', wotf: 'running',
};
const TAGS = { mxc: 'XC', wxc: 'XC', mitf: 'IN', witf: 'IN', motf: 'OUT', wotf: 'OUT' };

const CELL = 32;
const YEAR_W = 48;
const HDR_H = 56;
const int = (n) => n.toLocaleString('en-US');
const activeClass = (school) => 'active-' + C.slugOf(school);

// One rule per school that has titles. The layout wrapper toggles
// per-school `active-<Name>` classes on hover/selection, a cheap className
// change against pre-parsed rules. --sel crossfades the white stamp out and
// the color logo in; shared cells carry both schools, so only the active
// school's half flips.
const SCHOOL_HIGHLIGHT_CSS = (() => {
  const esc = (s) => s.replace(/["\\]/g, '\\$&');
  let css = '';
  for (const s of Object.keys(C.titles)) {
    const e = esc(s);
    const c = activeClass(s);
    css += `.cg-scope.${c} .cg-cell[data-school="${e}"],.cg-scope.${c} .cg-cell[data-school-2="${e}"]{opacity:1;}\n`;
    css += `.cg-scope.${c} .cg-cell[data-school="${e}"]:not(.cg-cell--shared),.cg-scope.${c} .cg-cell--shared[data-school="${e}"] .cg-half--a,.cg-scope.${c} .cg-cell--shared[data-school-2="${e}"] .cg-half--b,.cg-scope.${c} .lb-row[data-school="${e}"]{--sel:1;}\n`;
    css += `.cg-scope.${c} .lb-row[data-school="${e}"]{color:var(--cream);background:rgba(243,226,188,0.06);}\n`;
  }
  return css;
})();

// A school's mark: the baked white stamp with the full-color logo stacked
// on top at opacity 0; the per-school --sel rule crossfades them. The text
// fallback flips on only if the stamp 404s.
function SchoolMark({ school, onError }) {
  const info = C.SCHOOLS[school];
  const mono = getMonoLogoUrl(school);
  const color = getLogoUrl(school);
  const invert = info?.invertLogo ? ' cg-logo--invert' : '';
  return (
    <>
      <span className="cg-mark">
        {mono ? (
          <img src={mono} alt={school} loading="lazy" className="cg-logo cg-logo--mono" onError={onError} />
        ) : color ? (
          <img src={color} alt={school} loading="lazy" className={'cg-logo cg-logo--auto' + invert} onError={onError} />
        ) : null}
        {mono && color && <img src={color} alt="" loading="lazy" className={'cg-logo cg-logo--color' + invert} />}
      </span>
      <div className="cg-fallback" style={{ display: mono || color ? 'none' : 'flex' }}>{info?.abbr || school.slice(0, 3).toUpperCase()}</div>
    </>
  );
}

export default function ChampionshipGrid() {
  const [highlighted, setHighlighted] = useState(null);
  const [selection, setSelection] = useState([]);
  const scopeRef = useRef(null);
  const tipRef = useRef(null);
  const applied = useRef(false);
  const isMobile = useIsMobile();
  const { copied, share } = useShare(GRID_SITE);

  // the address, read once after hydration (the first render is the prerender's)
  useEffect(() => {
    const fromUrl = C.parseUrl(window.location.search);
    if (fromUrl.s.length) setSelection(fromUrl.s);
    applied.current = true;
  }, []);
  // the address and the tab title follow the selection
  useEffect(() => {
    if (!applied.current) return;
    window.history.replaceState(null, '', `${window.location.pathname}${C.toUrl({ s: selection })}`);
    document.title = gridTitle({ s: selection });
  }, [selection]);

  const activeSchools = useMemo(() => (!highlighted || selection.includes(highlighted) ? selection : [...selection, highlighted]), [selection, highlighted]);

  // Hover intent: a school lights only after the cursor has rested on its
  // mark for 100ms, so sweeping across the board doesn't strobe.
  const hoverTimer = useRef(null);
  useEffect(() => () => clearTimeout(hoverTimer.current), []);
  const onEnter = useCallback((school) => {
    clearTimeout(hoverTimer.current);
    setHighlighted((prev) => (prev === school ? prev : null));
    hoverTimer.current = setTimeout(() => setHighlighted(school), 100);
  }, []);
  const onLeave = useCallback(() => { clearTimeout(hoverTimer.current); setHighlighted(null); }, []);
  const toggleSchool = useCallback((school) => {
    clearTimeout(hoverTimer.current);
    setSelection((prev) => (prev.includes(school) ? prev.filter((s) => s !== school) : [...prev, school]));
    setHighlighted(null);
    track('pick', { from: 'grid', school });
  }, []);
  const onClick = useCallback((school, e) => { e.stopPropagation(); toggleSchool(school); }, [toggleSchool]);
  const clearSelection = useCallback(() => { setSelection([]); setHighlighted(null); }, []);
  const handleImgError = useCallback((e) => {
    const mark = e.target.closest('.cg-mark');
    if (!mark) return;
    mark.style.display = 'none';
    const fallback = mark.nextElementSibling;
    if (fallback) fallback.style.display = 'flex';
  }, []);

  // the active classes go straight onto the wrapper, so hover never
  // re-renders the memoized grid or leaderboard
  useEffect(() => {
    const el = scopeRef.current;
    if (!el) return;
    el.className = 'cg-layout cg-scope' + (activeSchools.length ? ' has-active ' + activeSchools.map(activeClass).join(' ') : '');
  }, [activeSchools]);

  // the sport-name tooltip: one fixed element, positioned on hover, clamped to the viewport
  useEffect(() => {
    const scope = scopeRef.current;
    const tip = tipRef.current;
    if (!scope || !tip) return;
    const show = (hdr) => {
      tip.textContent = hdr.dataset.name;
      const r = hdr.getBoundingClientRect();
      const tw = tip.offsetWidth;
      tip.style.left = `${Math.max(8, Math.min(r.left + r.width / 2 - tw / 2, window.innerWidth - tw - 8))}px`;
      tip.style.top = `${r.bottom + 4}px`;
      tip.style.opacity = '1';
    };
    const onOver = (e) => { const hdr = e.target.closest('.cg-sport-hdr'); if (hdr) show(hdr); };
    const onOut = (e) => { const hdr = e.target.closest('.cg-sport-hdr'); if (hdr && !hdr.contains(e.relatedTarget)) tip.style.opacity = '0'; };
    scope.addEventListener('mouseover', onOver);
    scope.addEventListener('mouseout', onOut);
    return () => { scope.removeEventListener('mouseover', onOver); scope.removeEventListener('mouseout', onOut); };
  }, []);

  const find = {
    items: useMemo(() => C.schoolOptions.map((s) => ({ key: s, name: s, mark: getLogoUrl(s), sub: String(C.titles[s].total) })), []),
    onPick: (school) => { setSelection((prev) => (prev.includes(school) ? prev : [...prev, school])); track('find', { from: 'grid', school }); },
    placeholder: 'Find a school',
    title: 'School',
    none: 'No school with a title matches.',
  };
  const onShare = () => {
    share(gridShareText({ s: selection }), window.location.href);
    track('share', { from: 'grid', s: selection.join(',') || null });
  };
  const lead = C.leaderboard[0];

  return (
    <main className="cg-page">
      <style dangerouslySetInnerHTML={{ __html: SCHOOL_HIGHLIGHT_CSS }} />
      <div className="cg-tip" ref={tipRef} aria-hidden="true" />

      <Dateline span={`${C.FIRST}–${C.LAST}`}>
        <NavIcons here="grid" find={find} onShare={onShare} copied={copied} isMobile={isMobile} />
      </Dateline>
      <h1>NCAA Division I Championships</h1>

      <p className="sentence">
        {gridSentence()} Pick a school to trace its titles:
        {selection.map((s) => (
          <span key={s} className="sel">
            <img src={getLogoUrl(s)} alt="" className={'sel-mark' + (C.SCHOOLS[s]?.invertLogo ? ' cg-logo--invert' : '')} />
            <span className="sel-name">{s}</span>
            <b className="sel-n">{C.titles[s]?.total ?? 0}</b>
            <button className="sel-x" onClick={() => toggleSchool(s)} aria-label={`Remove ${s}`}>×</button>
          </span>
        ))}
        <SchoolPicker items={find.items} onPick={find.onPick} isMobile={isMobile} placeholder="Find a school" title="School" none="No school with a title matches.">
          <button className="addbtn" aria-label="Add a school">+</button>
        </SchoolPicker>
      </p>
      <p className="baserate">
        <b>{lead.school}</b> leads with {lead.total}; {int(C.leaderboard.length)} schools have won at least one.
        {selection.length > 0 && <> Tap or hover a cell to preview another; <button className="linkbtn" onClick={clearSelection}>clear the picks</button>.</>}
      </p>

      <div ref={scopeRef} className="cg-layout cg-scope">
        <GridContent onEnter={onEnter} onLeave={onLeave} onClick={onClick} onClear={clearSelection} handleImgError={handleImgError} />
        <Leaderboard onEnter={onEnter} onLeave={onLeave} onToggle={toggleSchool} />
      </div>

      <ReadNext here="grid" />
      <Cite what="a title count" />
      <Method>
        <p>
          Every cell is a national champion as the sport's championship page on{' '}
          <a href="https://en.wikipedia.org/wiki/NCAA_Division_I">Wikipedia</a> (<a href="https://creativecommons.org/licenses/by-sa/4.0/">CC BY-SA 4.0</a>) lists it,
          {' '}{C.FIRST} to {C.LAST}, {C.SPORTS.length} sports. The grid begins in {C.FIRST} because that is as far back as every column could be
          checked against its source; <a href="https://drewhoover.com/collegiate-championships/">the sibling grid</a> runs from 1972 with 33 sports.
        </p>
        <p>
          <b>Football</b> has no NCAA championship: the column is the AP poll champion through 1997, the BCS champion through 2013 and the
          College Football Playoff champion since. A split title shows both schools in one cell and credits each with one. A football season
          is listed under its fall year; every other sport under the year its championship was played, so the 2024 football champion and the
          2025 basketball champion are the same school year. A dash in 2020 is a championship canceled for COVID-19.
        </p>
        <p>
          The leaderboard counts titles in these {C.SPORTS.length} sports only, so a school's total here can sit below the number it
          publishes, which usually counts every NCAA sport since 1906. Ranks are competition ranks, ties included.
        </p>
        <p>A sibling of <a href="https://drewhoover.com/collegiate-championships/">Who has the most college championships?</a> and <a href="https://drewhoover.com/how-many-rings/">How Many Rings?</a>.</p>
      </Method>
      <SiteFooter />
    </main>
  );
}

// The board, memoized: its props are stable, so hover never reconciles 1,000 cells.
const GridContent = memo(function GridContent({ onEnter, onLeave, onClick, onClear, handleImgError }) {
  return (
    <div className="cg-scroll" onClick={onClear}>
      <div
        className="cg-grid"
        onMouseLeave={onLeave}
        style={{ '--sport-count': C.sortedSports.length, '--year-count': C.descendingYears.length, '--cell-w-default': `${CELL}px`, '--year-w-default': `${YEAR_W}px`, '--header-h-default': `${HDR_H}px` }}
      >
        <div className="cg-corner" />
        {C.sortedSports.map((sport) => (
          <div key={sport.key} className="cg-sport-hdr" data-name={sport.name} aria-label={sport.name}>
            <span className="cg-sport-icon" aria-hidden="true" style={{ '--icon': `url(${sportIconUrl(ICONS[sport.key])})` }} />
            {TAGS[sport.key] && <span className="cg-sport-tag" aria-hidden="true">{TAGS[sport.key]}</span>}
            <span className="cg-sport-gender" aria-hidden="true">{sport.gender}</span>
          </div>
        ))}
        {C.descendingYears.map((year) => {
          const isDecade = year % 10 === 0;
          return (
            <Fragment key={year}>
              <div className={'cg-year' + (isDecade ? ' cg-year--decade' : '')}>{year}</div>
              {C.sortedSports.map((sport) => {
                const champs = C.champsOf(sport.key, year);
                const isShared = champs.length > 1;
                const primary = champs[0] ?? null;
                const secondary = champs[1] ?? null;
                const cls = 'cg-cell' + (champs.length === 0 ? ' cg-cell--empty' : '') + (isDecade ? ' cg-cell--decade' : '') + (isShared ? ' cg-cell--shared' : '');
                const titleText = champs.length === 0 ? `${year} ${sport.name}: no champion` : `${year} ${sport.name}: ${champs.join(' & ')}${isShared ? ' (shared)' : ''}`;
                const canceled = champs.length === 0 && year === 2020 && C.CHAMPIONSHIPS[sport.key]?.[2019];
                return (
                  <div
                    key={sport.key}
                    className={cls}
                    data-school={primary || undefined}
                    data-school-2={secondary || undefined}
                    onMouseEnter={!isShared && primary ? () => onEnter(primary) : undefined}
                    onClick={!isShared && primary ? (e) => onClick(primary, e) : undefined}
                    title={titleText}
                  >
                    {isShared
                      ? champs.map((co, i) => (
                          <div key={co} className={`cg-half cg-half--${i === 0 ? 'a' : 'b'}`} onMouseEnter={() => onEnter(co)} onClick={(e) => onClick(co, e)}>
                            <SchoolMark school={co} onError={handleImgError} />
                          </div>
                        ))
                      : primary && <SchoolMark school={primary} onError={handleImgError} />}
                    {canceled && <div className="cg-covid" title="Canceled (COVID-19)">&mdash;</div>}
                  </div>
                );
              })}
            </Fragment>
          );
        })}
      </div>
    </div>
  );
});

// Every school with a title, most first. A row lights with its school.
const Leaderboard = memo(function Leaderboard({ onEnter, onLeave, onToggle }) {
  return (
    <ol className="lb" aria-label="Schools by national titles" onMouseLeave={onLeave}>
      {C.leaderboard.map((r) => (
        <li key={r.school}>
          <button className="lb-row" data-school={r.school} onMouseEnter={() => onEnter(r.school)} onClick={() => onToggle(r.school)} title={`${r.school} — ${C.topSports(r.school).map(([n, k]) => `${n} ${k}`).join(', ')}`}>
            <span className="lb-rk">{r.tied ? 'T' : ''}{r.rank}</span>
            <span className="lb-mark"><SchoolMark school={r.school} /></span>
            <span className="lb-name">{r.school}</span>
            <span className="lb-bd">{r.male}♂ {r.female}♀</span>
            <span className="lb-n">{r.total}</span>
          </button>
        </li>
      ))}
    </ol>
  );
});
