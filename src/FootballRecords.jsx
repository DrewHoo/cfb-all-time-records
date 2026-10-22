// All 136 FBS programs on one board: the sentence picks the conference and
// the measure, the rows rank by it, and a program opens inline under its
// row. The address carries the board (?sort=&conf=) and the open row (?t=).
import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import * as F from './lib/football.js';
import { footballSentence, footballShareText, footballTitle, footballClaim, FOOTBALL_SITE } from './lib/share.js';
import { track } from './lib/analytics.js';
import { Picker } from './components/Picker.jsx';
import { Dateline, NavIcons } from './components/Dateline.jsx';
import { ReadNext, Cite, Method, SiteFooter } from './components/Notes.jsx';
import { CloseIcon } from './components/Icons.jsx';
import { useShare } from './hooks/useShare.js';
import { useIsMobile } from './hooks/useIsMobile.js';

const BASE = import.meta.env.BASE_URL;
const PAGE = 50;
const int = (n) => n.toLocaleString('en-US');
const years = (ys) => (ys.length ? ys.join(', ') : 'none');

const Mark = ({ team, className = 'mark' }) => <img className={className} src={`${BASE}logos-color/${team.espn}.png`} alt="" loading="lazy" />;

export default function FootballRecords() {
  const [q, setQ] = useState(F.DEFAULT);
  const [shown, setShown] = useState(PAGE);
  const applied = useRef(false);
  const landed = useRef(false);
  const isMobile = useIsMobile();
  const { copied, share } = useShare(FOOTBALL_SITE);

  const board = useMemo(() => F.evaluate(q), [q]);
  const openIdx = q.t ? board.rows.findIndex((r) => r.team.slug === q.t) : -1;
  const openRow = openIdx >= 0 ? board.rows[openIdx] : null;
  // the open row is always on the page, however far down it ranks
  const visible = board.rows.slice(0, Math.max(shown, openIdx + 1));

  // The address, read once after hydration: the prerender rendered the
  // default board, so the first render must not depend on the URL.
  useEffect(() => {
    const fromUrl = F.parseUrl(window.location.search);
    if (F.isShared(fromUrl)) setQ(fromUrl);
    applied.current = true;
  }, []);
  // the address and the tab title follow the board (replaceState: a
  // definition, not a place to go back to)
  useEffect(() => {
    if (!applied.current) return;
    window.history.replaceState(null, '', `${window.location.pathname}${F.toUrl(q)}`);
    document.title = footballTitle(q, board);
  }, [q, board]);
  // a deep link lands on its row
  useEffect(() => {
    if (!openRow || landed.current) return;
    landed.current = true;
    document.getElementById(`t-${openRow.team.slug}`)?.scrollIntoView({ block: 'center' });
  }, [openRow]);

  const setSort = (sort) => { setQ((p) => ({ ...p, sort })); track('sort', { from: 'football', sort }); };
  const setConf = (conf) => {
    setQ((p) => ({ ...p, conf, t: p.t && conf && F.teamBySlug(p.t)?.conference !== conf ? null : p.t }));
    setShown(PAGE);
    track('conf', { from: 'football', conf: conf ?? 'all' });
  };
  const toggle = useCallback((slug) => {
    setQ((p) => ({ ...p, t: p.t === slug ? null : slug }));
    track('open', { from: 'football', t: slug });
  }, []);
  const find = {
    items: useMemo(() => [...F.TEAMS].sort((a, b) => a.name.localeCompare(b.name)).map((t) => ({ key: t.slug, name: t.name, mark: `${BASE}logos-color/${t.espn}.png`, sub: F.recordText(t) })), []),
    onPick: (slug) => {
      const t = F.teamBySlug(slug);
      setQ((p) => ({ ...p, t: slug, conf: p.conf && t.conference !== p.conf ? null : p.conf }));
      landed.current = false;
      track('find', { from: 'football', t: slug });
    },
    placeholder: 'Find a program',
    title: 'Program',
    none: 'No FBS program matches.',
  };
  const onShare = () => {
    share(footballShareText(q, board), window.location.href);
    track('share', { from: 'football', ...q });
  };

  const s = F.SORTS[q.sort];
  const confOptions = [{ value: null, label: `All ${int(F.TEAMS.length)}` }, ...F.CONFERENCES.map((c) => ({ value: c, label: c, hint: String(F.confCount(c)) }))];
  const sortOptions = F.SORT_KEYS.map((k) => ({ value: k, label: F.SORTS[k].label }));
  const leader = board.rows[0];

  return (
    <main>
      <Dateline span={`through the ${F.THROUGH} season`}>
        <NavIcons here="football" find={find} onShare={onShare} copied={copied} isMobile={isMobile} />
      </Dateline>
      <h1>College Football All-Time Records</h1>

      <p className="sentence">
        <Picker value={q.conf} options={confOptions} onChange={setConf} ariaLabel="Conference" />{' '}
        FBS programs ranked by{' '}
        <Picker value={q.sort} options={sortOptions} onChange={setSort} ariaLabel="Ranked by" />, every game through {F.THROUGH}.
        <span className="sr-only">{footballSentence(q)}</span>
      </p>
      <p className="baserate">
        {leader?.value != null ? <>The leader: <b>{leader.team.name}</b>, {s.fmt(leader.value)}. </> : null}
        {q.conf ? `${int(board.total)} programs in the ${q.conf}.` : `${int(board.total)} programs; click one for its record.`}
      </p>

      <div className="bhead" aria-hidden="true">
        <span>Rank</span><span>Program</span><span className="bh-rec">Record</span><span className="bh-val">{s.noun}</span>
      </div>
      <ol className="board">
        {visible.map((r) => {
          const t = r.team;
          const open = r === openRow;
          return (
            <li key={t.slug} id={`t-${t.slug}`} className={open ? 'open' : ''}>
              <button className={'row' + (open ? ' on' : '')} onClick={() => toggle(t.slug)} aria-expanded={open}>
                <span className="rk">{F.rankText(r)}</span>
                <Mark team={t} />
                <span className="nm">{t.name}<small>{t.conference}</small></span>
                <span className="rec">{F.recordText(t)} <b>{F.pctText(t.winPct)}</b></span>
                <span className="val">{r.value == null ? '—' : s.fmt(r.value)}</span>
              </button>
              {open && (
                <div className="panel">
                  <div className="panel-head">
                    <Mark team={t} className="panel-mark" />
                    <div className="panel-id">
                      <span className="panel-name">{t.name}</span>
                      <span className="panel-meta">{t.conference} · {t.years} seasons</span>
                    </div>
                    <button className="ico panel-close" onClick={() => toggle(t.slug)} aria-label="Close"><CloseIcon /></button>
                  </div>
                  <p className="claim">{footballClaim(r, board)}</p>
                  <div className="stats">
                    <span>All-time record<b>{F.recordText(t)}</b><small>{F.pctText(t.winPct)}</small></span>
                    <span>Bowl record<b>{F.bowlText(t)}</b><small>{t.bowlPct == null ? '' : F.pctText(t.bowlPct)}</small></span>
                    <span>Claimed national titles<b>{t.claimedNatChamps}</b><small>{years(t.claimedYears)}</small></span>
                    <span>Unclaimed selections<b>{t.unclaimedNatChamps}</b><small>{years(t.unclaimedYears)}</small></span>
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ol>
      {visible.length < board.rows.length && (
        <div className="showmore">
          <button onClick={() => setShown((n) => n + PAGE)}>see {Math.min(PAGE, board.rows.length - visible.length)} more</button>
          <span className="showmore-n">· {int(board.rows.length - visible.length)} left</span>
        </div>
      )}

      <ReadNext here="football" />
      <Cite what="a record" />
      <Method>
        <p>
          Every row is a program's all-time record as Wikipedia's{' '}
          <a href={F.SOURCE_URL}>list of FBS football programs</a> (<a href="https://creativecommons.org/licenses/by-sa/4.0/">CC BY-SA 4.0</a>) tallies it,
          through the {F.THROUGH} season: wins, losses and ties in every game the program has played, its bowl record, and the
          national championships it claims. The {int(F.TEAMS.length)} programs are this season's FBS members; FCS and lower-division
          programs aren't listed there, so they aren't here.
        </p>
        <p>
          <b>Win percentage</b> counts a tie as half a win, the NCAA's way. <b>Claimed national titles</b> are the ones the school itself
          claims; <b>unclaimed selections</b> are seasons a recognized selector named the program champion that the school doesn't
          claim, and the "claimed or not" count adds the two. The national-title columns, like Wikipedia's, make no judgment about which selectors count,
          so Alabama's 18 and Michigan's 12 are the schools' own numbers.
        </p>
        <p>
          Ranks are competition ranks, ties included. A program that has never played a bowl has no bowl win percentage and sits at
          the bottom of that board without a rank. Records include games later vacated by the NCAA, as Wikipedia's table does.
        </p>
        <p>A sibling of <a href="https://drewhoover.com/cfb-streak-king/">College Football Streak King</a> and <a href="https://drewhoover.com/hostile-territory/">Hostile Territory</a>.</p>
      </Method>
      <SiteFooter />
    </main>
  );
}
