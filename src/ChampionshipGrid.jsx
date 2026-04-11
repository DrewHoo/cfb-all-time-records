import { useState, useMemo, useCallback, useRef, useEffect, Fragment, memo } from 'react';
import { SPORTS, SCHOOLS, CHAMPIONSHIPS, YEARS, getLogoUrl } from './championshipData';

// Default cell size (overridden on mobile via a CSS min() + viewport calc).
const CELL = 32;
const YEAR_W = 48;
const HDR_H = 56;

// Read ?school=... on first render so shared links land on the locked view.
const initialLockedFromUrl = () => {
  if (typeof window === 'undefined') return null;
  const param = new URLSearchParams(window.location.search).get('school');
  if (!param) return null;
  return SCHOOLS[param] ? param : null;
};

export default function ChampionshipGrid() {
  const [highlighted, setHighlighted] = useState(null);
  const [locked, setLocked] = useState(initialLockedFromUrl);
  const [copied, setCopied] = useState(false);
  const gridRef = useRef(null);

  // Stable ref mirrors `locked` so hover callbacks stay referentially stable
  // (and don't force the memoized cell grid to re-render every mouseenter).
  const lockedRef = useRef(locked);
  useEffect(() => {
    lockedRef.current = locked;
  }, [locked]);

  // Keep ?school=... in sync with the locked state without growing history.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const url = new URL(window.location.href);
    if (locked) {
      url.searchParams.set('school', locked);
    } else {
      url.searchParams.delete('school');
    }
    window.history.replaceState(null, '', url);
  }, [locked]);

  const active = locked || highlighted;

  // Sports ordered alphabetically ignoring the "Men's "/"Women's " prefix so
  // paired sports (Basketball, Soccer, Tennis…) sit next to each other.
  const sortedSports = useMemo(() => {
    const stripGender = (name) => name.replace(/^(Men's |Women's )/, '');
    return [...SPORTS].sort((a, b) => {
      const cmp = stripGender(a.name).localeCompare(stripGender(b.name));
      return cmp !== 0 ? cmp : a.name.localeCompare(b.name);
    });
  }, []);

  // Years in descending order (newest at the top of the grid).
  const descendingYears = useMemo(() => [...YEARS].sort((a, b) => b - a), []);
  const yearRange = useMemo(
    () => `${Math.min(...YEARS)}–${Math.max(...YEARS)}`,
    [],
  );

  // Count total titles per school across all sports shown. Shared titles
  // (array values) credit each co-champion with one title.
  const schoolTitles = useMemo(() => {
    const counts = {};
    for (const sport of SPORTS) {
      const data = CHAMPIONSHIPS[sport.key] || {};
      for (const value of Object.values(data)) {
        if (!value) continue;
        const schools = Array.isArray(value) ? value : [value];
        for (const school of schools) {
          counts[school] = (counts[school] || 0) + 1;
        }
      }
    }
    return counts;
  }, []);

  // These callbacks read `locked` via the ref, so their identity never
  // changes. That lets <GridContent> memoize against them.
  const onEnter = useCallback((school) => {
    if (!lockedRef.current) setHighlighted(school);
  }, []);

  const onLeave = useCallback(() => {
    if (!lockedRef.current) setHighlighted(null);
  }, []);

  const onClick = useCallback((school, e) => {
    e.stopPropagation();
    setLocked((prev) => (prev === school ? null : school));
    setHighlighted(null);
  }, []);

  const clearLock = useCallback(() => {
    setLocked(null);
    setHighlighted(null);
  }, []);

  const handleImgError = useCallback((e) => {
    // Hide broken images so the text fallback shows
    e.target.style.display = 'none';
    const fallback = e.target.nextElementSibling;
    if (fallback) fallback.style.display = 'flex';
  }, []);

  const shareTitle = locked
    ? `Every NCAA D-I national title ${locked} has won since 1990`
    : 'Every NCAA D-I national champion since 1990, in one grid';

  const copyLink = useCallback(async (e) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // Clipboard API can fail on http: or inside some iframes — silently ignore.
    }
  }, []);

  const shareToReddit = useCallback((e) => {
    e.stopPropagation();
    const url = encodeURIComponent(window.location.href);
    const title = encodeURIComponent(shareTitle);
    window.open(
      `https://www.reddit.com/submit?url=${url}&title=${title}`,
      '_blank',
      'noopener,noreferrer',
    );
  }, [shareTitle]);

  // Dynamic CSS that dims non-matching cells and glows the active school.
  // Recomputed only when `active` changes — React updates a single text node
  // instead of reconciling ~800 cells. Split cells carry both champions in
  // data-school and data-school-2, so either attribute matching counts.
  const activeStyle = useMemo(() => {
    if (!active) return '';
    const color = SCHOOLS[active]?.color || '#fff';
    // NCAA school names are safe ASCII, but escape quotes/backslashes defensively.
    const esc = active.replace(/["\\]/g, '\\$&');
    return `
      .cg-grid .cg-cell:not([data-school="${esc}"]):not([data-school-2="${esc}"]) {
        opacity: 0.12;
        filter: grayscale(1) brightness(0.6);
      }
      .cg-grid .cg-cell[data-school="${esc}"],
      .cg-grid .cg-cell[data-school-2="${esc}"] {
        z-index: 5;
        transform: scale(1.18);
        box-shadow: 0 0 0 2px ${color}, 0 0 14px 3px ${color};
        border-radius: 4px;
        background: rgba(255,255,255,0.06);
      }
    `;
  }, [active]);

  return (
    <div className="cg-page" onClick={clearLock}>
      <style>{STYLES}</style>
      <style>{activeStyle}</style>

      {/* Header */}
      <header className="cg-header">
        <a href="./football.html" className="cg-nav">
          Football All-Time Records →
        </a>
        <h1>NCAA Division I Championships</h1>
        <p className="cg-sub">
          {yearRange} &middot; {SPORTS.length} sports
          &middot; Hover or tap to trace a school
        </p>
      </header>

      {/* Info bar */}
      <div className={`cg-info ${active ? 'cg-info--active' : ''}`}>
        {active ? (
          <div className="cg-info-inner">
            <div
              className="cg-info-swatch"
              style={{ background: SCHOOLS[active]?.color || '#888' }}
            />
            {getLogoUrl(active) && (
              <img
                src={getLogoUrl(active)}
                alt=""
                className="cg-info-logo"
              />
            )}
            <span className="cg-info-name">{active}</span>
            <span className="cg-info-count">
              {schoolTitles[active]} title{schoolTitles[active] !== 1 ? 's' : ''} shown
            </span>
            {locked && (
              <span className="cg-info-hint">click again to unlock</span>
            )}
          </div>
        ) : (
          <div className="cg-info-placeholder">
            Hover or tap any cell to highlight a school&rsquo;s championships
          </div>
        )}
      </div>

      {/* Share row */}
      <div className="cg-share" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="cg-share-btn" onClick={copyLink}>
          {copied ? 'Link copied' : locked ? 'Copy link to this view' : 'Copy link'}
        </button>
        <button type="button" className="cg-share-btn" onClick={shareToReddit}>
          Share on Reddit
        </button>
      </div>

      {/* Grid — memoized so hover state changes in the parent don't reconcile
          ~800 cells. Active-school highlighting is applied via the sibling
          <style> above using data-school attribute selectors. */}
      <GridContent
        gridRef={gridRef}
        sortedSports={sortedSports}
        descendingYears={descendingYears}
        onEnter={onEnter}
        onLeave={onLeave}
        onClick={onClick}
        handleImgError={handleImgError}
      />

      <footer className="cg-footer">
        <p>
          Football uses AP poll champion (pre-BCS era) and BCS/CFP champion.
          Year 2020 dashes indicate seasons canceled due to COVID-19.
          Data sourced from NCAA records.
        </p>
      </footer>
    </div>
  );
}

// Memoized grid body. All its props are stable (module-level data + useCallback
// handlers that read `locked` via a ref), so React.memo's default shallow
// comparison skips reconciliation on every hover-state change in the parent.
const GridContent = memo(function GridContent({
  gridRef,
  sortedSports,
  descendingYears,
  onEnter,
  onLeave,
  onClick,
  handleImgError,
}) {
  return (
    <div className="cg-scroll">
      <div
        ref={gridRef}
        className="cg-grid"
        style={{
          '--sport-count': sortedSports.length,
          '--year-count': descendingYears.length,
          '--cell-w-default': `${CELL}px`,
          '--year-w-default': `${YEAR_W}px`,
          '--header-h-default': `${HDR_H}px`,
        }}
      >
        <div className="cg-corner" />

        {sortedSports.map((sport) => (
          <div
            key={sport.key}
            className="cg-sport-hdr"
            data-name={sport.name}
            aria-label={sport.name}
          >
            <span className="cg-sport-icon" aria-hidden="true">
              {sport.icon}
            </span>
            {sport.gender && (
              <span className="cg-sport-gender" aria-hidden="true">
                {sport.gender}
              </span>
            )}
          </div>
        ))}

        {descendingYears.map((year) => {
          const isDecade = year % 10 === 0;
          return (
            <Fragment key={year}>
              <div className={`cg-year ${isDecade ? 'cg-year--decade' : ''}`}>
                {year}
              </div>
              {sortedSports.map((sport) => {
                const raw = CHAMPIONSHIPS[sport.key]?.[year] ?? null;
                const champs = raw == null ? [] : Array.isArray(raw) ? raw : [raw];
                const isShared = champs.length > 1;
                const primary = champs[0] ?? null;
                const secondary = champs[1] ?? null;

                let cls = 'cg-cell';
                if (champs.length === 0) cls += ' cg-cell--empty';
                if (isDecade) cls += ' cg-cell--decade';
                if (isShared) cls += ' cg-cell--shared';

                const titleText =
                  champs.length === 0
                    ? `${year} ${sport.name}: No champion`
                    : `${year} ${sport.name}: ${champs.join(' & ')}${isShared ? ' (shared)' : ''}`;

                return (
                  <div
                    key={sport.key}
                    className={cls}
                    data-school={primary || undefined}
                    data-school-2={secondary || undefined}
                    onMouseEnter={
                      !isShared && primary ? () => onEnter(primary) : undefined
                    }
                    onMouseLeave={!isShared && primary ? onLeave : undefined}
                    onClick={
                      !isShared && primary ? (e) => onClick(primary, e) : undefined
                    }
                    title={titleText}
                  >
                    {isShared
                      ? champs.map((co, i) => {
                          const coInfo = SCHOOLS[co];
                          const coLogo = getLogoUrl(co);
                          return (
                            <div
                              key={co}
                              className={`cg-half cg-half--${i === 0 ? 'a' : 'b'}`}
                              onMouseEnter={() => onEnter(co)}
                              onMouseLeave={onLeave}
                              onClick={(e) => onClick(co, e)}
                            >
                              {coLogo ? (
                                <img
                                  src={coLogo}
                                  alt={co}
                                  loading="lazy"
                                  className="cg-logo"
                                  onError={handleImgError}
                                />
                              ) : (
                                <div
                                  className="cg-fallback"
                                  style={{
                                    display: 'flex',
                                    background: coInfo?.color || '#555',
                                  }}
                                >
                                  {coInfo?.abbr || co.slice(0, 3).toUpperCase()}
                                </div>
                              )}
                            </div>
                          );
                        })
                      : primary && (
                          <>
                            {getLogoUrl(primary) && (
                              <img
                                src={getLogoUrl(primary)}
                                alt={primary}
                                loading="lazy"
                                className="cg-logo"
                                onError={handleImgError}
                              />
                            )}
                            <div
                              className="cg-fallback"
                              style={{
                                display: getLogoUrl(primary) ? 'none' : 'flex',
                                background: SCHOOLS[primary]?.color || '#555',
                              }}
                            >
                              {SCHOOLS[primary]?.abbr ||
                                primary.slice(0, 3).toUpperCase()}
                            </div>
                          </>
                        )}
                    {champs.length === 0 &&
                      year === 2020 &&
                      CHAMPIONSHIPS[sport.key]?.[2019] &&
                      !CHAMPIONSHIPS[sport.key]?.[2020] && (
                        <div className="cg-covid" title="Canceled (COVID-19)">
                          &mdash;
                        </div>
                      )}
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

const STYLES = `
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=DM+Mono:wght@400;500&display=swap');

*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

:root {
  --bg:      #0c0f14;
  --surface: #151921;
  --border:  rgba(255,255,255,0.06);
  --text:    #e0e0e0;
  --muted:   #6b7280;
  --accent:  #fbbf24;
}

body {
  margin: 0;
  background: var(--bg);
  color: var(--text);
  font-family: 'DM Sans', system-ui, -apple-system, sans-serif;
  -webkit-font-smoothing: antialiased;
}

/* Page */
.cg-page {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 24px 16px 48px;
}

/* Header */
.cg-header {
  text-align: center;
  margin-bottom: 12px;
}
.cg-nav {
  display: inline-block;
  font-size: 11px;
  color: var(--muted);
  text-decoration: none;
  margin-bottom: 10px;
  padding: 4px 10px;
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 6px;
  letter-spacing: 0.03em;
  transition: color 0.15s, border-color 0.15s;
}
.cg-nav:hover {
  color: #fff;
  border-color: rgba(255,255,255,0.25);
}
.cg-header h1 {
  font-size: 22px;
  font-weight: 700;
  letter-spacing: -0.02em;
  color: #fff;
  margin-top: 6px;
}
.cg-sub {
  font-size: 12px;
  color: var(--muted);
  margin-top: 4px;
}

/* Info bar */
.cg-info {
  width: 100%;
  max-width: 720px;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  background: var(--surface);
  border: 1px solid var(--border);
  margin-bottom: 16px;
  transition: border-color 0.2s, background 0.2s;
  overflow: hidden;
}
.cg-info--active {
  border-color: rgba(255,255,255,0.12);
}
.cg-info-inner {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0 16px;
}
.cg-info-swatch {
  width: 14px;
  height: 14px;
  border-radius: 3px;
  flex-shrink: 0;
}
.cg-info-logo {
  width: 28px;
  height: 28px;
  object-fit: contain;
}
.cg-info-name {
  font-weight: 600;
  font-size: 15px;
  color: #fff;
}
.cg-info-count {
  font-size: 13px;
  color: var(--muted);
  font-family: 'DM Mono', monospace;
}
.cg-info-hint {
  font-size: 11px;
  color: var(--muted);
  opacity: 0.7;
  margin-left: 4px;
}
.cg-info-placeholder {
  font-size: 13px;
  color: var(--muted);
}

/* Share row */
.cg-share {
  display: flex;
  gap: 8px;
  margin-bottom: 14px;
}
.cg-share-btn {
  font-family: inherit;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.03em;
  color: var(--muted);
  background: var(--surface);
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 6px;
  padding: 6px 12px;
  cursor: pointer;
  transition: color 0.15s, border-color 0.15s, background 0.15s;
}
.cg-share-btn:hover {
  color: #fff;
  border-color: rgba(255,255,255,0.25);
  background: rgba(255,255,255,0.04);
}

/* Scrollable grid wrapper */
.cg-scroll {
  overflow: auto;
  max-width: 100%;
  border-radius: 8px;
  border: 1px solid var(--border);
  background: var(--surface);
  -webkit-overflow-scrolling: touch;
}

/* Grid — cell/year/header widths come from --*-default custom props that
   the JSX component sets inline, but the computed values live here in CSS
   so media queries can override them without getting shadowed by inline
   styles. */
.cg-grid {
  display: grid;
  position: relative;
  --cell-w: var(--cell-w-default, 32px);
  --year-w: var(--year-w-default, 48px);
  --header-h: var(--header-h-default, 56px);
  grid-template-columns: var(--year-w) repeat(var(--sport-count), var(--cell-w));
  grid-template-rows: var(--header-h) repeat(var(--year-count), var(--cell-w));
}

/* Corner cell */
.cg-corner {
  position: sticky;
  left: 0;
  top: 0;
  z-index: 20;
  background: var(--surface);
  border-bottom: 1px solid var(--border);
  border-right: 1px solid var(--border);
}

/* Sport column headers */
.cg-sport-hdr {
  position: sticky;
  top: 0;
  z-index: 10;
  background: var(--surface);
  border-bottom: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  padding: 2px 0;
  cursor: help;
}
.cg-sport-icon {
  font-size: clamp(10px, calc(var(--cell-w) * 0.62), 18px);
  line-height: 1;
  filter: saturate(0.85);
}
.cg-sport-gender {
  font-size: clamp(6px, calc(var(--cell-w) * 0.32), 10px);
  line-height: 1;
  color: var(--muted);
  font-weight: 600;
}
/* Custom hover tooltip for sport names — replaces the native title
   attribute because browser tooltips take ~500ms to show and flicker
   out on fast mouse movement. */
.cg-sport-hdr::after {
  content: attr(data-name);
  position: absolute;
  top: calc(100% + 4px);
  left: 50%;
  transform: translateX(-50%);
  background: #1f2533;
  color: #fff;
  border: 1px solid rgba(255,255,255,0.12);
  padding: 4px 9px;
  border-radius: 6px;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.02em;
  white-space: nowrap;
  pointer-events: none;
  opacity: 0;
  z-index: 30;
  box-shadow: 0 4px 14px rgba(0,0,0,0.4);
  transition: opacity 0.12s ease;
}
.cg-sport-hdr:hover::after {
  opacity: 1;
}

/* Year labels */
.cg-year {
  position: sticky;
  left: 0;
  z-index: 10;
  background: var(--surface);
  display: flex;
  align-items: center;
  justify-content: flex-end;
  padding-right: 10px;
  font-family: 'DM Mono', monospace;
  font-size: 12px;
  font-weight: 400;
  color: var(--muted);
  border-right: 1px solid var(--border);
  user-select: none;
}
.cg-year--decade {
  color: #fff;
  font-weight: 500;
  border-bottom: 1px solid rgba(255,255,255,0.18);
}

/* Data cells */
.cg-cell {
  display: flex;
  align-items: center;
  justify-content: center;
  border-right: 1px solid var(--border);
  border-bottom: 1px solid var(--border);
  cursor: pointer;
  transition: opacity 0.12s ease, transform 0.12s ease, box-shadow 0.12s ease;
  position: relative;
  overflow: visible;
}
.cg-cell--decade {
  border-bottom: 1px solid rgba(255,255,255,0.18);
}
.cg-cell--empty {
  cursor: default;
}

/* Logos — scale with cell size so they shrink cleanly on mobile */
.cg-logo {
  width: 82%;
  height: 82%;
  object-fit: contain;
  pointer-events: none;
  image-rendering: auto;
}

/* Text fallback */
.cg-fallback {
  width: 78%;
  height: 78%;
  border-radius: 3px;
  align-items: center;
  justify-content: center;
  font-size: clamp(6px, calc(var(--cell-w) * 0.26), 9px);
  font-weight: 700;
  color: #fff;
  letter-spacing: 0.02em;
  text-shadow: 0 1px 2px rgba(0,0,0,0.5);
  pointer-events: none;
}

/* Shared championship — two logos split diagonally (top-left / bottom-right).
   Each half is its own hit target so hover/click target the correct school. */
.cg-cell--shared {
  position: relative;
}
.cg-half {
  position: absolute;
  inset: 0;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}
.cg-half--a {
  clip-path: polygon(0 0, 100% 0, 0 100%);
}
.cg-half--b {
  clip-path: polygon(100% 0, 100% 100%, 0 100%);
}
.cg-half .cg-logo,
.cg-half .cg-fallback {
  width: 52%;
  height: 52%;
  position: absolute;
}
.cg-half--a .cg-logo,
.cg-half--a .cg-fallback {
  top: 8%;
  left: 8%;
}
.cg-half--b .cg-logo,
.cg-half--b .cg-fallback {
  bottom: 8%;
  right: 8%;
}
/* Thin diagonal divider. Placed above both halves via pointer-events: none
   so the underlying hit targets still receive hover/click. */
.cg-cell--shared::after {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(
    to top right,
    transparent calc(50% - 0.5px),
    rgba(255,255,255,0.35) calc(50% - 0.5px),
    rgba(255,255,255,0.35) calc(50% + 0.5px),
    transparent calc(50% + 0.5px)
  );
  pointer-events: none;
}

/* COVID dash */
.cg-covid {
  color: rgba(255,255,255,0.15);
  font-size: 16px;
  font-weight: 300;
}

/* Footer */
.cg-footer {
  margin-top: 20px;
  max-width: 600px;
  text-align: center;
}
.cg-footer p {
  font-size: 11px;
  color: var(--muted);
  line-height: 1.5;
}

/* Responsive: on phones, shrink cells + year column so the full grid
   fits within the viewport horizontally (vertical scroll is fine). */
@media (max-width: 640px) {
  .cg-page { padding: 12px 4px 24px; }
  .cg-header h1 { font-size: 18px; }
  .cg-info { height: 40px; }
  .cg-info-name { font-size: 13px; }
  .cg-info-placeholder { font-size: 11px; padding: 0 8px; text-align: center; }

  .cg-scroll {
    overflow-x: hidden;
    max-width: 100%;
  }
  .cg-grid {
    --year-w: 28px;
    --header-h: 44px;
    /* cell width = (viewport − year col − horizontal padding) / column count,
       capped at the desktop default so large phones don't balloon */
    --cell-w: min(
      var(--cell-w-default, 32px),
      calc((100vw - 28px - 10px) / var(--sport-count))
    );
  }
  .cg-year {
    font-size: 9px;
    padding-right: 3px;
  }
}
`;
