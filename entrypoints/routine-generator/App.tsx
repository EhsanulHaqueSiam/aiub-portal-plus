import { useEffect, useMemo, useRef, useState } from 'react';
import { PortalShell } from '@/components/PortalShell';
import type { OfferedCourse, Section } from '@/lib/offered';
import type { CurriculumCourse } from '@/lib/offered';
import {
  WEEK_DAYS, generateRoutines, fmtClockTime, fmtAgo, parseClockTime, norm,
  type Filters, type Selection, type Routine,
} from '@/lib/routine';
import { buildCompletedLookup, computeEligibleCourses, namesMatch } from '@/lib/eligibility';
import { useRoutineData } from './useRoutineData';
import { triggerSync, writeHighlights, type SyncProgress } from './sync';

const MAX_SEARCH_RESULTS = 40;
const RESULTS_PAGE = 5;

// ------- bucketing offered courses by title -------
type CourseBucket = { title: string; sections: Section[]; courseCode?: string };

function groupByTitle(courses: OfferedCourse[]): Map<string, CourseBucket> {
  const m = new Map<string, CourseBucket>();
  for (const c of courses) {
    if (!c.title) continue;
    const title = String(c.title).trim();
    const existing = m.get(title);
    if (existing) {
      existing.sections.push(...(c.sections ?? []));
    } else {
      m.set(title, { title, sections: [...(c.sections ?? [])], courseCode: c.courseCode });
    }
  }
  return m;
}

// ------- App -------
export function App() {
  const data = useRoutineData();
  return (
    <PortalShell active="routine-generator" student={data.student}>
      <PageStrip />
      <Notice />
      {!data.loaded ? (
        <div className="p-10 text-center text-muted">Loading…</div>
      ) : (
        <Generator data={data} />
      )}
    </PortalShell>
  );
}

function PageStrip() {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-royal-100 bg-gradient-to-b from-royal-50 to-white px-7 pt-6 pb-7 mb-5 shadow-[0_1px_2px_rgba(11,30,91,.04),0_8px_22px_-14px_rgba(11,30,91,.18)]">
      <div className="absolute -top-px left-6 right-6 h-0.5 pointer-events-none"
           style={{ background: 'linear-gradient(90deg, transparent, var(--color-royal-600) 30%, var(--color-gold-400) 65%, transparent)' }} />
      <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.12em] text-muted">
        <a href="https://portal.aiub.edu/Student" className="text-muted hover:text-royal-600">Portal</a>
        <span>›</span>
        <a href="https://portal.aiub.edu/Student/Section/Offered" className="text-muted hover:text-royal-600">Tools</a>
        <span>›</span>
        <span className="text-royal-600">Routine Generator</span>
      </div>
      <h1 className="mt-3 font-display text-[44px] leading-none tracking-tight">
        Routine <em className="italic text-gradient-royal">Generator</em>
      </h1>
      <p className="mt-3 max-w-[65ch] text-[14px] leading-relaxed text-ink-3">
        Pick courses, tune filters, and we assemble every clash-free timetable from your Offered Courses — inside your
        browser, under your account.
      </p>
    </div>
  );
}

function Notice() {
  const [open, setOpen] = useState(true);
  return (
    <aside role="note" aria-label="Policy notice"
           className="relative rounded-2xl border border-gold-500/40 bg-gold-400/10 p-5 md:p-6 mb-5 text-amber-900">
      <div className="flex items-center justify-between gap-3">
        <div className="inline-flex items-center gap-2 rounded-full bg-navy-900 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.14em] text-gold-400">
          Read this first
        </div>
        <button type="button" onClick={() => setOpen((o) => !o)}
                className="text-[11px] font-bold uppercase tracking-widest text-amber-800 hover:text-amber-900">
          {open ? 'Hide' : 'Show'}
        </button>
      </div>
      {open && (
        <ol className="mt-4 space-y-2 list-none counter-[policy]">
          {[
            ['AIUB policy:', 'never use your AIUB Portal username and password on any third-party application other than official AIUB platforms.'],
            ['This extension does not sync in real time.', 'Syncing is user-initiated — data is only read from the Offered Courses page when you visit it in your own browser.'],
            ['If you sync for fresh data,', 'you log in to the official AIUB Portal at your own discretion.'],
            ['Your username and password are never seen, handled, or stored', 'by this extension. Sync happens inside your authenticated session on portal.aiub.edu.'],
            ['This extension is not affiliated with AIUB', 'and is not endorsed by AIUB.'],
            ['Provided exclusively for educational purposes.', 'Users are expected to act responsibly and comply with all applicable laws, regulations, and institutional policies.'],
            ['Under the hood, when you click "Sync now":', 'a portal tab briefly opens in the background and a content script programmatically expands curriculum panels to read prerequisite data from pages you already have access to. No data is submitted, modified, or transmitted outside your browser.'],
          ].map(([strong, rest], i) => (
            <li key={String(strong)} className="pl-9 relative text-[13px] leading-relaxed">
              <span className="absolute left-0 top-[3px] font-mono text-[10px] tracking-[0.08em] text-gold-500 font-bold" aria-hidden>
                {String(i + 1).padStart(2, '0')}
              </span>
              <strong className="font-bold text-amber-950">{strong}</strong> {rest}
            </li>
          ))}
        </ol>
      )}
    </aside>
  );
}

// ------- main generator shell -------
function Generator({ data }: { data: ReturnType<typeof useRoutineData> }) {
  const buckets = useMemo(() => groupByTitle(data.offered?.courses ?? []), [data.offered]);

  const [selections, setSelections] = useState<Map<string, Selection>>(new Map());
  const [lastResult, setLastResult] = useState<{
    routines: Routine[]; missing: string[]; exploredCap?: boolean; shownCount: number; filters: Filters;
  } | null>(null);

  // highlight sync — write selected sections to chrome.storage.local.aiubHighlights
  const [highlightsEnabled, setHighlightsEnabled] = useState<boolean>(!!data.highlights?.enabled);
  const [viewedRoutineIdx, setViewedRoutineIdx] = useState<number | null>(null);

  useEffect(() => {
    setHighlightsEnabled(!!data.highlights?.enabled);
  }, [data.highlights?.enabled]);

  // Persist highlights whenever the user picks a routine to emphasize.
  useEffect(() => {
    if (!lastResult || viewedRoutineIdx == null) return;
    const routine = lastResult.routines[viewedRoutineIdx];
    if (!routine) return;
    const classIds = routine.sections
      .map((s) => String(s.classId ?? s.section ?? '').trim())
      .filter(Boolean);
    const courseTitles: string[] = [];
    for (const sel of selections.values()) courseTitles.push(sel.title);
    writeHighlights({ classIds, courseTitles, enabled: highlightsEnabled });
  }, [viewedRoutineIdx, lastResult, highlightsEnabled, selections]);

  return (
    <>
      <DataCard data={data} selectionCount={selections.size} />

      <CoursesBlock
        buckets={buckets}
        selections={selections}
        setSelections={setSelections}
        data={data}
      />

      <FiltersBlock
        onGenerate={(filters) => {
          const selArr = Array.from(selections.values());
          const result = generateRoutines(selArr, filters);
          setLastResult({
            ...result,
            shownCount: Math.min(RESULTS_PAGE, result.routines.length),
            filters,
          });
          setViewedRoutineIdx(null);
        }}
        onClear={() => { setSelections(new Map()); setLastResult(null); setViewedRoutineIdx(null); }}
        resultCount={lastResult?.routines.length ?? 0}
        hasSelections={selections.size > 0}
      />

      {lastResult && (
        <ResultsBlock
          result={lastResult}
          onShowMore={() => setLastResult((r) => r ? { ...r, shownCount: Math.min(r.shownCount + RESULTS_PAGE, r.routines.length) } : r)}
          viewedIdx={viewedRoutineIdx}
          onView={setViewedRoutineIdx}
          highlightsEnabled={highlightsEnabled}
          onToggleHighlights={setHighlightsEnabled}
        />
      )}
    </>
  );
}

// ------- data card -------
function DataCard({ data, selectionCount }: { data: ReturnType<typeof useRoutineData>; selectionCount: number }) {
  const offered = data.offered;
  const courseCount = Array.isArray(offered?.courses) ? offered.courses.length : 0;
  const sectionCount = (offered?.courses ?? []).reduce((s, c) => s + (c.sections?.length ?? 0), 0);
  const lastSynced = fmtAgo(offered?.capturedAt ?? null);

  const regActive = !!data.registration?.active;
  const regAge = data.registration?.detectedAt
    ? Date.now() - new Date(data.registration.detectedAt).getTime()
    : Infinity;
  const showRegBanner = regActive && regAge < 7 * 24 * 60 * 60 * 1000;

  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<SyncProgress | null>(null);
  const [hint, setHint] = useState<string>(
    "Sync reads this semester's Offered Courses + your completed courses. Your curriculum (prerequisites) is cached — click \"Refresh curriculum\" if your program changes.",
  );

  async function doSync(opts: { forceCurriculum?: boolean; offeredOnly?: boolean } = {}) {
    setBusy(true);
    try {
      await triggerSync({
        ...opts,
        curriculumCapturedAt: data.curriculum?.capturedAt ?? null,
        onProgress: (p) => {
          setProgress(p);
          setHint(p.message);
        },
      });
      setHint('Sync complete — eligible courses are ready below.');
    } catch (e) {
      const err = e as Error;
      setHint(`Sync failed: ${err.message}`);
    } finally {
      setProgress(null);
      setBusy(false);
    }
  }

  return (
    <Block index="00" title="Data" subtitle="What we know about your Offered Courses.">
      <article className="flex flex-col gap-4 rounded-xl border border-line bg-white p-4 md:p-5 shadow-[0_1px_2px_rgba(11,30,91,.04),0_8px_22px_-14px_rgba(11,30,91,.18)]">
        {showRegBanner && (
          <div className="flex items-center gap-3 rounded-lg border border-gold-500/40 bg-gold-400/10 px-3 py-2.5">
            <span className="w-2 h-2 rounded-full bg-gold-500 animate-pulse" />
            <div className="flex-1 text-[12.5px] text-amber-900">
              <strong className="font-bold">Registration is open.</strong>{' '}
              Seat counts and section statuses change minute-to-minute right now — re-sync just before you generate.
            </div>
            <button type="button" onClick={() => doSync({ offeredOnly: true })} disabled={busy}
                    className="rounded-lg bg-royal-600 px-3 py-1.5 text-[12px] font-bold text-white hover:bg-royal-500 disabled:opacity-60">
              Re-sync offered
            </button>
          </div>
        )}

        <div className="grid gap-3.5 grid-cols-2 md:grid-cols-4 text-center">
          <DataStat label="Sections cached" value={courseCount > 0 ? String(sectionCount) : '—'} />
          <DataStat label="Last synced" value={lastSynced} />
          <DataStat label="Source" value="portal.aiub.edu" />
          <DataStat label="Status" value={courseCount > 0 ? '● Ready' : 'No data yet'} tone={courseCount > 0 ? 'ok' : 'muted'} />
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button type="button" onClick={() => doSync()} disabled={busy}
                  className="inline-flex items-center gap-2 rounded-lg bg-royal-600 px-4 py-2 text-[13px] font-bold text-white hover:bg-royal-500 disabled:opacity-60 shadow-[0_1px_2px_rgba(11,30,91,.04),0_8px_22px_-14px_rgba(11,30,91,.28)]">
            <span aria-hidden>↻</span>
            {busy && progress ? `Syncing ${progress.step}/${progress.total}…` : 'Sync now'}
          </button>
          <button type="button" onClick={() => doSync({ forceCurriculum: true })} disabled={busy}
                  title="Re-scrape My Curriculum (prerequisites). Only needed when your curriculum changes."
                  className="rounded-lg border border-line bg-white px-3.5 py-2 text-[12.5px] font-semibold text-ink-2 hover:bg-royal-50 hover:text-royal-600 disabled:opacity-60">
            Refresh curriculum
          </button>
          <a href="https://portal.aiub.edu/Student/Section/Offered"
             className="rounded-lg border border-line bg-white px-3.5 py-2 text-[12.5px] font-semibold text-ink-2 hover:bg-royal-50 hover:text-royal-600 no-underline!">
            Open Offered Courses ↗
          </a>
        </div>

        <p className="text-[11.5px] text-muted leading-relaxed m-0">{hint}</p>

        {selectionCount > 0 && (
          <div className="rounded-lg bg-royal-50 px-3.5 py-2.5 text-[12px] text-ink-3">
            <strong className="font-bold text-royal-600">{selectionCount}</strong> course{selectionCount === 1 ? '' : 's'} selected for generation below.
          </div>
        )}
      </article>
    </Block>
  );
}

function DataStat({ label, value, tone }: { label: string; value: string; tone?: 'ok' | 'muted' }) {
  const color = tone === 'ok' ? 'text-emerald-700' : tone === 'muted' ? 'text-muted' : 'text-ink';
  return (
    <div>
      <div className="text-[10.5px] font-bold uppercase tracking-[0.12em] text-muted">{label}</div>
      <div className={`mt-1 text-[18px] font-extrabold tabular-nums font-display leading-tight ${color}`}>{value}</div>
    </div>
  );
}

// ------- eligible-courses rail -------
// Rendered unconditionally once offered data is cached, so the feature is
// discoverable even before the user runs a full sync. The body switches on
// the eligibility reason so the empty state points at exactly what's missing.
function EligibleBlock({ eligibility, eligibleOffered, offeredReady, selections, onAdd }: {
  eligibility: ReturnType<typeof computeEligibleCourses>;
  eligibleOffered: Array<{ course: CurriculumCourse; bucket: CourseBucket }>;
  offeredReady: boolean;
  selections: Map<string, Selection>;
  onAdd: (b: CourseBucket) => void;
}) {
  const wrap = 'rounded-xl border border-royal-100 bg-royal-50/60 p-3.5';
  const head = (title: string, note: string, count?: number) => (
    <div className="flex items-baseline gap-2 flex-wrap mb-2">
      <strong className="text-[12.5px] font-bold text-royal-600">{title}</strong>
      <em className="text-[11.5px] text-muted not-italic">— {note}</em>
      {count != null && (
        <span className="ml-auto text-[11.5px] tabular-nums text-muted">{count}</span>
      )}
    </div>
  );
  const muted = (msg: string) => (
    <p className="m-0 text-[11.5px] leading-relaxed text-muted">{msg}</p>
  );

  if (!offeredReady) {
    return (
      <div className={wrap}>
        {head('Eligible for you', 'appears after sync')}
        {muted('Click "Sync now" above to cache this semester\'s Offered Courses — eligible courses you can take (prerequisites satisfied) will surface here as one-click chips.')}
      </div>
    );
  }

  if (eligibility.reason === 'no-curriculum') {
    return (
      <div className={wrap}>
        {head('Eligible for you', 'curriculum missing')}
        {muted('Your curriculum (with prerequisites) hasn\'t been captured yet. Hit "Refresh curriculum" in the Data card above to enable the shortcut.')}
      </div>
    );
  }

  if (eligibility.reason === 'no-grades') {
    return (
      <div className={wrap}>
        {head('Eligible for you', 'grades missing')}
        {muted('We need your completed courses to compute eligibility. Run a full "Sync now" above — it reads your Grade Report by Curriculum to figure out which prerequisites are satisfied.')}
      </div>
    );
  }

  if (eligibleOffered.length === 0) {
    return (
      <div className={wrap}>
        {head('Eligible for you', 'no matches this semester', 0)}
        {muted(`You have ${eligibility.list.length} course${eligibility.list.length === 1 ? '' : 's'} with prerequisites satisfied, but none are in the current Offered list. Search above to add any course manually — the generator doesn't enforce prerequisites.`)}
      </div>
    );
  }

  return (
    <div className={wrap}>
      {head('Eligible for you', 'prerequisites satisfied · offered this semester', eligibleOffered.length)}
      <div className="flex flex-wrap gap-2">
        {eligibleOffered.map(({ bucket }) => (
          <button key={bucket.title} type="button"
                  onClick={() => onAdd(bucket)}
                  disabled={selections.has(bucket.title)}
                  title={bucket.courseCode ? `${bucket.title} · ${bucket.courseCode}` : bucket.title}
                  className="rounded-full border border-royal-200 bg-white px-3 py-1 text-[11.5px] font-semibold text-ink-2 hover:bg-royal-600 hover:text-white hover:border-royal-600 disabled:opacity-40 disabled:cursor-not-allowed">
            {bucket.title}
          </button>
        ))}
      </div>
      <p className="mt-2 text-[11.5px] text-muted leading-relaxed">
        Faculty approved a course you don't technically qualify for? Search above and add it anyway — the
        generator doesn't enforce prerequisites, only the eligibility shortcut does.
      </p>
    </div>
  );
}

// ------- courses picker -------
function CoursesBlock({ buckets, selections, setSelections, data }: {
  buckets: Map<string, CourseBucket>;
  selections: Map<string, Selection>;
  setSelections: (m: Map<string, Selection>) => void;
  data: ReturnType<typeof useRoutineData>;
}) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);

  // Eligible courses: filter curriculum to courses whose prereqs are satisfied.
  const eligibility = useMemo(() => {
    const completed = buildCompletedLookup(data.graph?.curriculum ?? null, data.graph?.semester ?? null);
    return computeEligibleCourses(data.curriculum, completed);
  }, [data.curriculum, data.graph]);

  // Map eligible curriculum courses to offered buckets by fuzzy-name match.
  const eligibleOffered = useMemo(() => {
    if (eligibility.reason !== 'ok') return [];
    const out: Array<{ course: CurriculumCourse; bucket: CourseBucket }> = [];
    for (const c of eligibility.list) {
      for (const b of buckets.values()) {
        if (namesMatch(b.title, c.name)) {
          out.push({ course: c, bucket: b });
          break;
        }
      }
    }
    return out;
  }, [eligibility, buckets]);

  // Search: fuzzy match against bucket titles, course codes, and class IDs.
  const searchResults = useMemo(() => {
    if (query.trim().length < 2) return [];
    const q = norm(query);
    const results: CourseBucket[] = [];
    for (const b of buckets.values()) {
      if (results.length >= MAX_SEARCH_RESULTS) break;
      if (norm(b.title).includes(q)) { results.push(b); continue; }
      if (b.courseCode && norm(b.courseCode).includes(q)) { results.push(b); continue; }
      if ((b.sections ?? []).some((s) => norm(s.classId ?? s.section ?? '').includes(q))) {
        results.push(b);
      }
    }
    return results;
  }, [query, buckets]);

  function addSelection(bucket: CourseBucket) {
    const next = new Map(selections);
    next.set(bucket.title, { title: bucket.title, sections: bucket.sections });
    setSelections(next);
    setQuery('');
    setOpen(false);
  }
  function removeSelection(title: string) {
    const next = new Map(selections);
    next.delete(title);
    setSelections(next);
  }
  function setForcedSection(title: string, section?: string) {
    const next = new Map(selections);
    const s = next.get(title);
    if (!s) return;
    next.set(title, { ...s, forcedSection: section || undefined });
    setSelections(next);
  }

  return (
    <Block index="01" title="Courses" subtitle="Search and add. Pin a section, or leave it wide open.">
      <div className="flex flex-col gap-4">
        <div className="relative">
          <label htmlFor="rg-search" className="block text-[11.5px] font-bold uppercase tracking-[0.12em] text-muted mb-1.5">Search</label>
          <input id="rg-search" type="search" autoComplete="off" spellCheck={false}
                 value={query}
                 onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
                 onFocus={() => setOpen(true)}
                 placeholder="Course name, code, or class id…"
                 className="w-full rounded-lg border border-line bg-white px-3.5 py-2.5 text-[14px] text-ink outline-none focus:border-royal-600 focus:shadow-[0_0_0_4px_rgba(37,99,235,.12)]" />
          {open && searchResults.length > 0 && (
            <div className="absolute z-20 mt-1.5 w-full max-h-[320px] overflow-y-auto rounded-lg border border-line bg-white shadow-lg">
              {searchResults.map((b) => (
                <button key={b.title} type="button"
                        onClick={() => addSelection(b)}
                        disabled={selections.has(b.title)}
                        className="w-full text-left px-3.5 py-2 text-[13px] text-ink-2 hover:bg-royal-50 hover:text-royal-600 disabled:opacity-40 disabled:cursor-not-allowed">
                  <div className="font-semibold">{b.title}</div>
                  <div className="text-[11px] text-muted">{(b.sections ?? []).length} section(s){b.courseCode ? ` · ${b.courseCode}` : ''}</div>
                </button>
              ))}
            </div>
          )}
        </div>

        <EligibleBlock
          eligibility={eligibility}
          eligibleOffered={eligibleOffered}
          offeredReady={buckets.size > 0}
          selections={selections}
          onAdd={addSelection}
        />

        <div className="min-h-[48px] rounded-xl border border-dashed border-line bg-paper-soft p-3.5">
          {selections.size === 0 ? (
            <p className="m-0 text-[12px] text-muted">No courses selected yet — start typing above or tap an eligible course.</p>
          ) : (
            <ul className="flex flex-col gap-2 m-0 p-0 list-none">
              {Array.from(selections.values()).map((sel) => (
                <li key={sel.title} className="flex flex-wrap items-center gap-2">
                  <span className="rounded-lg bg-royal-600 text-white px-3 py-1 text-[12px] font-bold">{sel.title}</span>
                  <select value={sel.forcedSection ?? ''}
                          onChange={(e) => setForcedSection(sel.title, e.target.value)}
                          className="rounded-md border border-line bg-white px-2 py-1 text-[11.5px] text-ink-2">
                    <option value="">Any section</option>
                    {(sel.sections ?? []).map((s, i) => (
                      <option key={(s.classId ?? s.section ?? i) + '-' + i} value={String(s.section ?? s.classId ?? '')}>
                        {String(s.section ?? s.classId ?? '')} {s.status ? '· ' + s.status : ''}
                      </option>
                    ))}
                  </select>
                  <button type="button" onClick={() => removeSelection(sel.title)}
                          className="ml-auto text-[11px] text-muted hover:text-red-600">Remove</button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Block>
  );
}

// ------- filters -------
function FiltersBlock({ onGenerate, onClear, resultCount, hasSelections }: {
  onGenerate: (f: Filters) => void;
  onClear: () => void;
  resultCount: number;
  hasSelections: boolean;
}) {
  const [earliest, setEarliest] = useState<number>(8 * 60);
  const [latest, setLatest] = useState<number>(21 * 60);
  const [maxSeats, setMaxSeats] = useState<number>(100);
  const [statuses, setStatuses] = useState<Set<string>>(new Set(['OPEN', 'RESERVED', 'CANCEL', 'FRESHMAN', 'CLOSED']));
  const [allowedDays, setAllowedDays] = useState<Set<string>>(new Set(['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday']));
  const [sortBy, setSortBy] = useState<'minimize' | 'none'>('none');

  const timeOptions = useMemo(() => {
    const opts: Array<{ value: number; label: string }> = [];
    for (let t = 8 * 60; t <= 23 * 60; t += 30) opts.push({ value: t, label: fmtClockTime(t) });
    return opts;
  }, []);

  function toggleSet<T>(set: Set<T>, v: T, enabled: boolean): Set<T> {
    const next = new Set(set);
    if (enabled) next.add(v); else next.delete(v);
    return next;
  }

  return (
    <Block index="02" title="Generate options" subtitle="Trim the search before we look.">
      <div className="flex flex-col gap-4">
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="Earliest class start">
            <select value={earliest} onChange={(e) => setEarliest(parseInt(e.target.value, 10))}
                    className="w-full rounded-md border border-line bg-white px-3 py-2 text-[13px]">
              {timeOptions.filter((t) => t.value <= 13 * 60).map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </Field>
          <Field label="Latest class end">
            <select value={latest} onChange={(e) => setLatest(parseInt(e.target.value, 10))}
                    className="w-full rounded-md border border-line bg-white px-3 py-2 text-[13px]">
              {timeOptions.filter((t) => t.value >= 14 * 60).map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </Field>
        </div>

        <Field label="Max seat count allowed" hint="Excludes overfilled sections.">
          <div className="flex items-center gap-4">
            <input type="range" min={0} max={100} value={maxSeats}
                   onChange={(e) => setMaxSeats(parseInt(e.target.value, 10))}
                   className="flex-1 h-1.5 rounded-full cursor-pointer"
                   style={{ background: 'linear-gradient(90deg, var(--color-royal-600), var(--color-sky-500))' }} />
            <output className="min-w-[50px] text-right text-[14px] font-extrabold tabular-nums text-royal-600">{maxSeats}</output>
          </div>
        </Field>

        <Field label="Include section status">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {['Open', 'Reserved', 'Cancel', 'Freshman', 'Closed'].map((s) => {
              const key = s.toUpperCase();
              return (
                <Check key={s} checked={statuses.has(key)} onChange={(c) => setStatuses(toggleSet(statuses, key, c))}>{s}</Check>
              );
            })}
          </div>
        </Field>

        <Field label="Classes only on">
          <div className="flex flex-wrap gap-2">
            {(['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const).map((d) => (
              <DayBox key={d} day={d} checked={allowedDays.has(d)} onChange={(c) => setAllowedDays(toggleSet(allowedDays, d, c))} />
            ))}
          </div>
        </Field>

        <Field label="Sort by gaps?">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <Radio checked={sortBy === 'minimize'} onChange={() => setSortBy('minimize')}
                   strong="Minimize gaps" sub="Tight schedule, fewer holes" />
            <Radio checked={sortBy === 'none'} onChange={() => setSortBy('none')}
                   strong="No preference" sub="Rank by off-days first" />
          </div>
        </Field>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3 rounded-xl bg-navy-900 px-4 py-3 text-white shadow-[0_4px_16px_-6px_rgba(11,30,91,.35)]">
        <button type="button"
                onClick={() => onGenerate({ earliest, latest, maxSeats, statuses, allowedDays, sortBy })}
                disabled={!hasSelections}
                className="inline-flex items-center gap-2 rounded-lg bg-gold-400 px-5 py-2.5 text-[14px] font-extrabold text-navy-900 hover:brightness-105 disabled:opacity-50 disabled:cursor-not-allowed">
          Generate routines <span aria-hidden>→</span>
        </button>
        <button type="button" onClick={onClear}
                className="text-[12.5px] font-semibold text-white/80 hover:text-white">Reset</button>
        <span className="ml-auto text-[12px] text-white/70 tabular-nums">
          {resultCount > 0 ? `${resultCount} routine${resultCount === 1 ? '' : 's'} found` : ''}
        </span>
      </div>
    </Block>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <fieldset className="border-0 p-0 m-0 min-w-0">
      <legend className="text-[11.5px] font-bold uppercase tracking-[0.08em] text-muted mb-1.5 flex items-baseline gap-2 w-full">
        {label}
        {hint && <span className="text-[10.5px] font-normal normal-case tracking-normal text-muted-2">{hint}</span>}
      </legend>
      {children}
    </fieldset>
  );
}

function Check({ checked, onChange, children }: { checked: boolean; onChange: (v: boolean) => void; children: React.ReactNode }) {
  return (
    <label className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-[12.5px] font-semibold cursor-pointer ${checked ? 'border-royal-600 bg-royal-600 text-white' : 'border-line bg-white text-ink-2 hover:bg-royal-50'}`}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)}
             className="sr-only" />
      <span className={`w-3.5 h-3.5 rounded border-2 ${checked ? 'bg-white border-white' : 'border-line'}`} aria-hidden>
        {checked && <span className="block w-full h-full text-royal-600 text-[10px] leading-[10px] font-black text-center">✓</span>}
      </span>
      {children}
    </label>
  );
}

function DayBox({ day, checked, onChange }: { day: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className={`flex flex-col items-center justify-center w-[56px] h-[48px] rounded-lg border cursor-pointer transition-colors ${checked ? 'border-royal-600 bg-royal-600 text-white' : 'border-line bg-white text-ink-2 hover:bg-royal-50'}`}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="sr-only" />
      <span className="text-[10.5px] font-bold uppercase tracking-wide">{day.slice(0, 3)}</span>
      <span className="text-[8px] uppercase tracking-wider opacity-70">{day.slice(3)}</span>
    </label>
  );
}

function Radio({ checked, onChange, strong, sub }: { checked: boolean; onChange: () => void; strong: string; sub: string }) {
  return (
    <label className={`flex items-start gap-2.5 rounded-lg border px-3 py-2 cursor-pointer ${checked ? 'border-royal-600 bg-royal-50' : 'border-line bg-white hover:bg-royal-50'}`}>
      <input type="radio" name="rg-sort" checked={checked} onChange={onChange} className="mt-1" />
      <div>
        <div className="text-[13px] font-bold text-ink">{strong}</div>
        <div className="text-[11.5px] text-muted">{sub}</div>
      </div>
    </label>
  );
}

// ------- results -------
function ResultsBlock({ result, onShowMore, viewedIdx, onView, highlightsEnabled, onToggleHighlights }: {
  result: { routines: Routine[]; missing: string[]; exploredCap?: boolean; shownCount: number; filters: Filters };
  onShowMore: () => void;
  viewedIdx: number | null;
  onView: (i: number | null) => void;
  highlightsEnabled: boolean;
  onToggleHighlights: (v: boolean) => void;
}) {
  if (result.missing.length) {
    return (
      <Block index="03" title="Routines" subtitle="Ranked by your sort preference.">
        <div className="rounded-xl border-l-4 border-red-500 bg-red-50 p-4 text-[13px] text-red-800">
          <strong className="font-bold">Cannot generate:</strong> no sections match your filters for:
          <ul className="mt-1.5 list-disc ml-5">{result.missing.map((m) => <li key={m}>{m}</li>)}</ul>
        </div>
      </Block>
    );
  }
  if (!result.routines.length) {
    return (
      <Block index="03" title="Routines" subtitle="Ranked by your sort preference.">
        <div className="rounded-xl border border-dashed border-line bg-paper-soft p-6 text-center text-[13px] text-muted">
          No clash-free routine fits those filters. Try relaxing the time window, allowed days, or seat cap.
        </div>
      </Block>
    );
  }

  const shown = result.routines.slice(0, result.shownCount);
  return (
    <Block index="03" title="Routines" subtitle={result.filters.sortBy === 'minimize' ? 'Ranked by fewest gaps first.' : 'Ranked by most off-days first.'}>
      <div className="flex flex-col gap-4">
        <label className="inline-flex items-center gap-2 text-[12px] text-ink-2 cursor-pointer">
          <input type="checkbox" checked={highlightsEnabled} onChange={(e) => onToggleHighlights(e.target.checked)} />
          Highlight this routine's class IDs on Offered Courses + Registration
        </label>

        <div className="flex flex-col gap-4">
          {shown.map((routine, i) => (
            <RoutineCard key={i} routine={routine} idx={i} active={viewedIdx === i}
                         onView={() => onView(viewedIdx === i ? null : i)} />
          ))}
        </div>

        {result.shownCount < result.routines.length && (
          <button type="button" onClick={onShowMore}
                  className="self-center rounded-lg bg-royal-600 px-4 py-2 text-[12.5px] font-bold text-white hover:bg-royal-500">
            Load {Math.min(RESULTS_PAGE, result.routines.length - result.shownCount)} more
          </button>
        )}

        {result.exploredCap && (
          <p className="text-[11.5px] text-muted text-center">
            Search budget hit before enumerating every combination — these are the first clash-free ones found.
          </p>
        )}
      </div>
    </Block>
  );
}

function RoutineCard({ routine, idx, active, onView }: { routine: Routine; idx: number; active: boolean; onView: () => void }) {
  const gapHours = (routine.totalGap / 60).toFixed(1);
  return (
    <article className={`rounded-xl border bg-white shadow-[0_1px_2px_rgba(11,30,91,.04),0_8px_22px_-14px_rgba(11,30,91,.18)] overflow-hidden transition-shadow ${active ? 'border-royal-600 shadow-[0_0_0_3px_rgba(37,99,235,.18),0_8px_22px_-14px_rgba(11,30,91,.18)]' : 'border-line'}`}>
      <header className="flex flex-wrap items-center gap-3 px-4 py-3 border-b border-line-soft bg-paper-soft">
        <span className="rounded-md bg-navy-900 px-2.5 py-1 text-[11px] font-bold text-gold-400 font-mono">#{String(idx + 1).padStart(2, '0')}</span>
        <strong className="text-[13px] font-bold text-ink">Routine</strong>
        <span className="text-[11.5px] text-muted tabular-nums">
          {routine.offDays} off-day{routine.offDays === 1 ? '' : 's'} · {gapHours}h total gap · starts {fmtClockTime(routine.earliestStart)}
        </span>
        <button type="button" onClick={onView}
                className={`ml-auto rounded-md px-3 py-1.5 text-[11.5px] font-semibold ${active ? 'bg-royal-600 text-white' : 'bg-white border border-line text-ink-2 hover:bg-royal-50'}`}>
          {active ? 'Hide grid' : 'View grid'}
        </button>
      </header>

      <div className="flex flex-wrap gap-2 p-4">
        {routine.sections.map((s, i) => <CoursePill key={i} section={s} />)}
      </div>

      {active && <WeeklyGrid sections={routine.sections} />}
    </article>
  );
}

function CoursePill({ section }: { section: Section }) {
  return (
    <div className="rounded-lg border border-line-soft bg-paper-soft px-3 py-2 text-[12px]">
      <div className="font-bold text-ink-2 flex items-center gap-2">
        <span className="font-mono text-[10.5px] text-muted-2">{section.classId ?? section.section ?? '—'}</span>
        <span className="text-[11.5px] font-semibold">{section.section ?? ''}</span>
      </div>
      <ul className="mt-1 m-0 p-0 list-none text-[11px] text-ink-3">
        {(section._parsedSlots ?? []).map((slot, i) => (
          <li key={i}>{slot.day} · {slot.start}–{slot.end}{slot.room ? ` · ${slot.room}` : ''}</li>
        ))}
      </ul>
    </div>
  );
}

function WeeklyGrid({ sections }: { sections: Section[] }) {
  // Collect min/max time for the grid window.
  let minStart = 8 * 60, maxEnd = 18 * 60;
  for (const s of sections) for (const slot of s._parsedSlots ?? []) {
    if (slot._start < minStart) minStart = Math.floor(slot._start / 30) * 30;
    if (slot._end > maxEnd) maxEnd = Math.ceil(slot._end / 30) * 30;
  }
  const rows: number[] = [];
  for (let t = minStart; t < maxEnd; t += 30) rows.push(t);

  const occMap = new Map<string, { section: Section; slot: NonNullable<Section['_parsedSlots']>[number] }[]>();
  for (const s of sections) for (const slot of s._parsedSlots ?? []) {
    const key = slot.day;
    (occMap.get(key) ?? occMap.set(key, []).get(key)!).push({ section: s, slot });
  }

  return (
    <div className="border-t border-line-soft overflow-x-auto">
      <div className="min-w-[780px] grid text-[11px]"
           style={{ gridTemplateColumns: '60px repeat(5, minmax(120px, 1fr))' }}>
        <div />
        {WEEK_DAYS.map((d) => (
          <div key={d} className="px-2 py-2 text-center font-bold uppercase tracking-wider text-muted">{d.slice(0, 3)}</div>
        ))}
        {rows.map((t) => (
          <>
            <div key={`label-${t}`} className="px-2 py-2 text-[10.5px] text-muted-2 border-t border-line-soft tabular-nums">
              {fmtClockTime(t)}
            </div>
            {WEEK_DAYS.map((d) => {
              const slotAt = (occMap.get(d) ?? []).find((e) => e.slot._start <= t && t < e.slot._end);
              if (!slotAt) return <div key={d + '-' + t} className="border-t border-l border-line-soft min-h-[26px]" />;
              return (
                <div key={d + '-' + t}
                     className="border-t border-l border-line-soft min-h-[26px] bg-royal-600/90 text-white px-2 py-0.5 text-[10px] font-semibold"
                     title={`${slotAt.section.section ?? slotAt.section.classId} · ${slotAt.slot.start}–${slotAt.slot.end}`}>
                  {slotAt.slot._start === t && (slotAt.section.section ?? slotAt.section.classId)}
                </div>
              );
            })}
          </>
        ))}
      </div>
    </div>
  );
}

// ------- shared block -------
function Block({ index, title, subtitle, children }: { index: string; title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <section className="bg-white rounded-xl border border-line mb-4 p-5 md:p-6 shadow-[0_1px_2px_rgba(11,30,91,.04),0_8px_22px_-14px_rgba(11,30,91,.18)] grid gap-5 md:gap-6 md:grid-cols-[220px_minmax(0,1fr)] items-start">
      <header>
        <span className="block mb-2 font-mono text-[10px] tracking-[0.2em] text-muted-2">{index}</span>
        <h2 className="m-0 mb-1.5 font-display text-[26px] leading-tight">
          <em className="italic text-gradient-royal">{title}.</em>
        </h2>
        <p className="m-0 text-[13px] leading-relaxed text-muted max-w-[22ch]">{subtitle}</p>
      </header>
      <div className="min-w-0">{children}</div>
    </section>
  );
}
