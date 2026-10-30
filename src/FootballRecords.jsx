// All 136 FBS programs on one board: the sentence picks the conference, the
// measure and the era it counts from, the rows rank by it, and a program
// opens inline under its row. The address carries the board
// (?sort=&since=&conf=) and the open row (?t=).
import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import * as F from './lib/football.js';
import { footballSentence, footballShareText, footballTitle, footballClaim, FOOTBALL_SITE } from './lib/share.js';
import { track } from './lib/analytics.js';
import { Picker } from './components/Picker.jsx';
import { EraPicker } from './components/EraPicker.jsx';
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
  // a deep link lands on its row; a program picked from find scrolls to its row, and focus goes there too
  const glide = useRef(false);
  const [found, setFound] = useState(0); // a pick of the program already open still scrolls to it
  useEffect(() => {
    if (!openRow || landed.current) return;
    landed.current = true;
    const li = document.getElementById(`t-${openRow.team.slug}`);
    if (!li) return;
    const smooth = glide.current && !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    li.scrollIntoView({ block: 'center', behavior: smooth ? 'smooth' : 'auto' });
    // focus after the key that picked it is done: an Enter still in flight would press the row's button and close it
    if (glide.current) setTimeout(() => li.querySelector('.row')?.focus({ preventScroll: true }), 0);
    glide.current = false;
  }, [openRow, found]);

  const setSort = (sort) => { setQ((p) => ({ ...p, sort })); track('sort', { from: 'board', sort }); };
  // a year typed in counts as it's typed and is tracked once, when the box is left
  const setSince = (since, { track: tracked = true } = {}) => {
    setQ((p) => ({ ...p, since }));
    if (tracked) track('since', { from: 'board', since: since ?? 'all', typed: !!since && !F.ERA_YEARS.includes(since) });
  };
  const setConf = (conf) => {
    setQ((p) => ({ ...p, conf, t: p.t && conf && F.teamBySlug(p.t)?.conference !== conf ? null : p.t }));
    setShown(PAGE);
    track('conf', { from: 'board', conf: conf ?? 'all' });
  };
  const toggle = useCallback((slug) => {
    setQ((p) => ({ ...p, t: p.t === slug ? null : slug }));
    track('open', { from: 'board', t: slug });
  }, []);
  const find = {
    items: useMemo(() => [...F.TEAMS].sort((a, b) => a.name.localeCompare(b.name)).map((t) => ({ key: t.slug, name: t.name, mark: `${BASE}logos-color/${t.espn}.png`, sub: F.recordText(t) })), []),
    onPick: (slug) => {
      const t = F.teamBySlug(slug);
      setQ((p) => ({ ...p, t: slug, conf: p.conf && t.conference !== p.conf ? null : p.conf }));
      landed.current = false;
      glide.current = true;
      setFound((n) => n + 1);
      track('find', { from: 'board', t: slug });
    },
    placeholder: 'Find a program',
    title: 'Program',
    none: 'No FBS program matches.',
  };
  const onShare = () => {
    share(footballShareText(q, board), window.location.href);
    track('share', { from: 'board', ...q });
  };

  const s = F.SORTS[q.sort];
  const confOptions = [{ value: null, label: `All ${int(F.TEAMS.length)}` }, ...F.CONFERENCES.map((c) => ({ value: c, label: c, hint: String(F.confCount(c)) }))];
  const sortOptions = F.SORT_KEYS.map((k) => ({ value: k, label: F.SORTS[k].label }));
  const era = F.eraText(q.since);
  const leader = board.rows[0];

  return (
    <main>
      <Dateline span={`through ${F.THROUGH}`}>
        <NavIcons here="board" find={find} onShare={onShare} copied={copied} isMobile={isMobile} />
      </Dateline>
      <h1>College Football All-Time Records</h1>

      <p className="sentence">
        <Picker value={q.conf} options={confOptions} onChange={setConf} ariaLabel="Conference" />{' '}
        FBS programs ranked by{' '}
        <Picker value={q.sort} options={sortOptions} onChange={setSort} ariaLabel="Ranked by" />{' '}
        <EraPicker since={q.since} onChange={setSince} />, every game through {F.THROUGH}.
        <span className="sr-only">{footballSentence(q)}</span>
      </p>
      <p className="baserate">
        {leader?.value != null ? <>The leader: <b>{leader.team.name}</b>, {s.fmt(leader.value)}. </> : null}
        {q.conf ? `${int(board.total)} programs in the ${q.conf}.` : `${int(board.total)} programs; click one for its record.`}
      </p>

      <div className="bhead" aria-hidden="true">
        <span>Rank</span><span>Program</span><span className="bh-rec">Record</span><span className="bh-val">{F.measure(q.sort, q.since)}</span>
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
                      <span className="panel-meta">{t.conference} · {t.years} seasons{era}</span>
                    </div>
                    <button className="ico panel-close" onClick={() => toggle(t.slug)} aria-label="Close"><CloseIcon /></button>
                  </div>
                  <p className="claim">{footballClaim(r, board)}</p>
                  <div className="stats">
                    <span>{q.since ? `Record since ${q.since}` : 'All-time record'}<b>{F.recordText(t)}</b><small>{F.pctText(t.winPct)}{q.since ? ` · ${F.recordText(F.teamBySlug(t.slug))} all time` : F.LATEST ? ` · ${F.seasonText(t)} in ${F.SEASON}` : ''}</small></span>
                    <span>Bowl record{era}<b>{F.bowlText(t)}</b><small>{t.bowlPct == null ? '' : F.pctText(t.bowlPct)}</small></span>
                    <span>Claimed national titles{era}<b>{t.claimedNatChamps}</b><small>{years(t.claimedYears)}</small></span>
                    <span>Unclaimed selections{era}<b>{t.unclaimedNatChamps}</b><small>{years(t.unclaimedYears)}</small></span>
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

      <ReadNext here="board" />
      <Cite what="a record" />
      <Method>
        <p>
          Every row is a program's record as the NCAA counts it: the total Wikipedia's{' '}
          <a href={F.RECORDS_SOURCE_URL}>table of FBS win-loss records</a> (<a href="https://creativecommons.org/licenses/by-sa/4.0/">CC BY-SA 4.0</a>) gives
          through the {F.RECORDS_THROUGH} season, with every game since {F.LATEST ? `through ${F.LATEST} ` : ''}added from the games
          themselves, its bowl record and the national championships it claims. Pick a year and every number counts from that
          season on, out of each program's season-by-season record; "another year…" takes any year you type. The titles are through {F.BASE_SEASON}. The sections
          below say where the records come from, what counts, what the words mean, and where a published number differs.
        </p>

        <details>
          <summary>Where the records come from</summary>
          <p>
            The all-time totals are Wikipedia's table of FBS win-loss records as it stood before the {F.RECORDS_THROUGH + 1} season,
            when it ran through {F.RECORDS_THROUGH}; the table has been brought up to date only in part since, so this page counts
            every game after {F.RECORDS_THROUGH} itself, from <a href="/cfb-streak-king/">College Football Streak King</a>'s ledger,
            which reads cfbfastR's schedules and CollegeFootballData's finals and refreshes after every Saturday. A season with a game
            played counts as a season played. The bowl records are Wikipedia's{' '}
            <a href={F.BOWL_SOURCE_URL}>list of FBS bowl records</a> through the {F.BASE_SEASON} season's bowls. Every bowl since is
            counted from Streak King's games too.
          </p>
          <p>
            The season-by-season records behind every era come from three places. From 1936 on, every top-division season is counted
            from Streak King's games. Before that, and for seasons a program played below the top division, each program's list of
            seasons on Wikipedia, with James Howell's all-time scores (jhowell.net) filling in early ties a list leaves out; Texas
            State's seasons before 1951, which its list doesn't have, are from the school's own fact book. Where the NCAA changed a
            season's record, by a forfeit or vacated wins, the season carries the NCAA's record. Each program's seasons through{' '}
            {F.RECORDS_THROUGH} add up to its NCAA total, or within a few games of it; the rulings, with a source for each, and every
            season are in <a href="https://github.com/DrewHoo/cfb-all-time-records/tree/main/data">the repository</a>.
          </p>
          <p>
            The {int(F.TEAMS.length)} programs are this season's FBS members; FCS and lower-division programs aren't listed there, so
            they aren't here.
          </p>
        </details>

        <details>
          <summary>What counts</summary>
          <p>
            Games count the NCAA's way. Wins the NCAA vacated are out, and a forfeit counts for the team awarded it. Seasons a
            program played below the top division count, as they do in the NCAA's totals, so a program that moved up carries its
            FCS years in every era. Junior-college seasons, rugby seasons and unofficial teams don't count. Bowl games are in the
            record and in the bowl record both. A playoff game counts as a bowl, first-round games on campus included, as on
            Wikipedia's list; a conference title game doesn't. A program that has played no bowl has no bowl win percentage and sits at the bottom
            of that board without a rank.
          </p>
          <p>
            An era counts from its first season on: <b>since 1912</b>, the year the modern rules settled (four downs, the
            100-yard field, the six-point touchdown); <b>since 1936</b>, the first AP poll; <b>since 1978</b>, when Division I split
            and Division I-A began; <b>since 1998</b>, the BCS; <b>since 2014</b>, the College Football Playoff. Another year counts the same way, from any season after {F.FIRST_SEASON}. A title
            counts in an era when its season does.
          </p>
          <p>
            A national title counts the way its selector counted it. <b>Claimed national titles</b> are the ones the school itself
            claims; <b>unclaimed selections</b> are seasons a recognized selector named the program champion that the school doesn't
            claim. The national-title columns, like Wikipedia's, make no judgment about which selectors count.
          </p>
        </details>

        <details>
          <summary>What the words mean</summary>
          <p>
            <b>Win percentage</b> counts a tie as half a win, the NCAA's way. <b>Bowl win percentage</b> is the same arithmetic over
            bowl games alone. The <b>"claimed or not"</b> count adds the claimed titles and the unclaimed selections. <b>Seasons
            played</b> is the number of seasons the program has fielded a team. Ranks are competition ranks, ties included: two
            programs with the same value share a rank, marked T, and the next rank is skipped.
          </p>
        </details>

        <details>
          <summary>Where a published number differs, and why</summary>
          <p>
            A national-title count depends on who is counting. Alabama's 18 and Michigan's 12 are the schools' own numbers, and so is Auburn's 9, which it has claimed since August 2025; a count
            that admits fewer selectors, or more, lands somewhere else, and the "claimed or not" board shows the widest one. A
            school's own record book may keep games the NCAA vacated, or count early games against club and high-school teams the
            NCAA leaves out, so a win total here can run a few games below the school's. A win percentage that drops ties, or counts
            them as losses, differs from the one here for a program with ties in its past.
          </p>
          <p>
            For a few programs the seasons and the NCAA total differ by a few early games no season can be pinned to; those count all
            time and in no era, so a program's record since 1912 can fall a few games short of its all-time record less its seasons
            before 1912.
          </p>
        </details>

        <p>A sibling of <a href="https://drewhoover.com/cfb-streak-king/">College Football Streak King</a> and <a href="https://drewhoover.com/hostile-territory/">Hostile Territory</a>.</p>
      </Method>
      <SiteFooter />
    </main>
  );
}
