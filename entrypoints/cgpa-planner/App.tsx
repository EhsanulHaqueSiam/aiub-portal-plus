import { useEffect, useMemo, useRef, useState } from 'react';
import { PortalShell } from '@/components/PortalShell';
import { useGraphData } from '@/hooks/useGraphData';
import type { SemesterCourseState, AiubGraphData } from '@/lib/graphData';
import {
  GRADE_POINTS, GRADE_ORDER, GRADUATION_CREDITS,
  fmt, toNum, projectCgpa, requiredAvg, feasibilityOf, standingOf,
} from '@/lib/grades';

// ---------- derived model ----------
type Ongoing = { key: string; name: string; classId: string; label: string; credit: number };
type Completed = { name: string; classId: string; credit: number; grade: string; gp: number; label: string };

type Model = {
  cgpa: number;
  completedCr: number;
  ongoingCr: number;
  notAttemptedCr: number;
  currentPoints: number;
  ongoing: Ongoing[];
  completed: Completed[];
  cgpaTrend: Array<{ label: string; cgpa: number }>;
};

function deriveModel(graph: AiubGraphData | null): Model | null {
  if (!graph) return null;
  const curriculum = graph.curriculum ?? null;
  const semester = graph.semester ?? null;
  if (!curriculum && !semester) return null;

  const cgpa =
    curriculum?.cgpa && curriculum.cgpa > 0 ? curriculum.cgpa
    : semester?.latestCgpa && semester.latestCgpa > 0 ? semester.latestCgpa
    : 0;

  const sc = curriculum?.stateCredits ?? { completed: 0, ongoing: 0, withdrawn: 0, notAttempted: 0 };
  const completedCr = toNum(sc.completed);
  const ongoingCr = toNum(sc.ongoing);
  const notAttemptedCr = toNum(sc.notAttempted);

  let ongoing: Ongoing[] = [];
  const sCourses: SemesterCourseState[] | undefined = semester?.courseStates;
  if (sCourses?.length) {
    ongoing = sCourses
      .filter((c) => c.state === 'ong' && c.name)
      .map((c) => ({
        key: `${c.classId || c.name}::${c.label || ''}`,
        name: String(c.name ?? ''),
        classId: String(c.classId ?? ''),
        label: String(c.label ?? ''),
        credit: toNum((c.credit as unknown) ?? c.creditValue),
      }));
  }
  if (!ongoing.length && curriculum?.courseStates?.length) {
    ongoing = curriculum.courseStates
      .filter((c) => c.state === 'ong' && c.name)
      .map((c) => ({
        key: `${c.code || c.name}::curriculum`,
        name: String(c.name ?? ''),
        classId: String(c.code ?? ''),
        label: '',
        credit: toNum(c.credit),
      }));
  }
  const seen = new Set<string>();
  ongoing = ongoing.filter((c) => {
    const k = c.name.toLowerCase().trim();
    if (!k || seen.has(k)) return false;
    seen.add(k);
    return true;
  });

  const completed: Completed[] = (sCourses ?? [])
    .filter((c) => c.state === 'done' && c.name && c.grade && GRADE_POINTS[c.grade] !== undefined)
    .map((c) => ({
      name: String(c.name ?? ''),
      classId: String(c.classId ?? ''),
      credit: toNum((c.credit as unknown) ?? c.creditValue),
      grade: c.grade,
      gp: GRADE_POINTS[c.grade],
      label: String(c.label ?? ''),
    }));

  const cgpaTrend = (semester?.cgpaTrend ?? []).map((p) => ({ label: String(p.label ?? ''), cgpa: toNum(p.cgpa) }));

  return {
    cgpa,
    completedCr,
    ongoingCr,
    notAttemptedCr,
    currentPoints: cgpa * completedCr,
    ongoing,
    completed,
    cgpaTrend,
  };
}

// ---------- main component ----------
export function App() {
  const { data, student, loaded } = useGraphData();
  const model = useMemo(() => deriveModel(data), [data]);

  if (!loaded) {
    return (
      <PortalShell active="cgpa-planner" student={student}>
        <div className="p-10 text-center text-muted">Loading…</div>
      </PortalShell>
    );
  }

  return (
    <PortalShell active="cgpa-planner" student={student}>
      <Hero model={model} />

      {!model ? <EmptyState /> : <Planner model={model} />}

      <p className="my-8 py-3.5 px-5 bg-royal-50 border border-royal-100 rounded-xl text-center text-[12px] leading-relaxed text-muted">
        AIUB CSE curriculum requires <strong className="text-ink-2">148 credits</strong> to graduate. This planner uses AIUB's
        standard grade scale (A+ 4.00 · A 3.75 · B+ 3.50 · B 3.25 · C+ 3.00 · C 2.75 · D+ 2.50 · D 2.25 · F 0.00).
        Elective credits beyond the core curriculum don't count toward the 148.
      </p>
    </PortalShell>
  );
}

function Hero({ model }: { model: Model | null }) {
  return (
    <section className="relative overflow-hidden rounded-2xl text-white p-6 md:p-7 mb-6 grid gap-6 md:grid-cols-[1.6fr_1fr] shadow-[0_28px_60px_-28px_rgba(11,30,91,.55)]"
             style={{ background: 'linear-gradient(135deg, var(--color-navy-900) 0%, var(--color-royal-600) 65%, var(--color-navy-900) 100%)' }}>
      <div className="absolute inset-0 -z-10 pointer-events-none"
           style={{
             background:
               'radial-gradient(320px 320px at 100% -20%, rgba(147,197,253,.28), transparent 60%),' +
               'radial-gradient(260px 260px at 0% 120%, rgba(56,189,248,.18), transparent 60%)',
           }} />
      <div>
        <p className="m-0 mb-2 text-[11px] font-bold tracking-[0.14em] uppercase text-white/70">
          AIUB Portal Plus
        </p>
        <h1 className="m-0 mb-2.5 font-display text-[40px] leading-[1.02] tracking-tight">
          CGPA <em className="italic text-sky-500">Planner</em>
        </h1>
        <p className="m-0 max-w-[62ch] text-sm leading-relaxed text-white/85">
          Set a target. See what each ongoing course needs to get you there, what average you need across future
          semesters, and how every remaining grade changes your graduation CGPA — all computed from your own
          Grade Report data, right here in your browser.
        </p>
      </div>
      <div className="self-center justify-self-end text-right min-w-[200px] p-4 border border-white/20 rounded-xl backdrop-blur-sm"
           style={{ background: 'rgba(255,255,255,0.10)' }}>
        <span className="block text-[11px] font-bold uppercase tracking-[0.14em] text-white/70 mb-1.5">
          Current CGPA
        </span>
        <span className="block text-[42px] font-extrabold leading-none tabular-nums tracking-tight">
          {fmt(model?.cgpa)}
        </span>
        <span className="block mt-2 text-[12px] text-white/70 tabular-nums">
          {model ? `${fmt(model.completedCr, 0)} completed · ${fmt(model.ongoingCr, 0)} ongoing` : 'no data synced yet'}
        </span>
      </div>
    </section>
  );
}

function EmptyState() {
  return (
    <section className="rounded-xl border-l-4 border-gold-500 bg-gold-400/15 p-5 mb-6">
      <h2 className="m-0 mb-1.5 text-base text-amber-900 font-bold">No grade data synced yet</h2>
      <p className="m-0 text-[13px] leading-relaxed text-amber-900">
        Open your Grade Report pages once —{' '}
        <a className="font-bold text-royal-600" href="https://portal.aiub.edu/Student/GradeReport/ByCurriculum">By Curriculum</a>
        {' '}and{' '}
        <a className="font-bold text-royal-600" href="https://portal.aiub.edu/Student/GradeReport/BySemester">By Semester</a>
        {' '}— and come back. The planner reads the cached data; nothing leaves your browser.
      </p>
    </section>
  );
}

// ---------- planner body ----------
function Planner({ model }: { model: Model }) {
  const [target, setTarget] = useState<number>(3.9);
  const [picks, setPicks] = useState<Map<string, string>>(new Map());
  const [remainingAvg, setRemainingAvg] = useState<number>(3.75);

  const creditsInPlay = Math.max(0, GRADUATION_CREDITS - model.completedCr);
  const req = requiredAvg(model.currentPoints, model.completedCr, creditsInPlay, target);
  const feas = feasibilityOf(req);

  // picks → projected CGPA
  const pickedPoints = useMemo(() => {
    let pts = 0, cr = 0;
    for (const c of model.ongoing) {
      const g = picks.get(c.key);
      if (!g) continue;
      const gp = GRADE_POINTS[g];
      if (gp === undefined) continue;
      pts += gp * c.credit;
      cr += c.credit;
    }
    return { pts, cr };
  }, [model.ongoing, picks]);

  const pickedCgpa = pickedPoints.cr > 0
    ? projectCgpa(model.currentPoints, model.completedCr, pickedPoints.pts, pickedPoints.cr)
    : model.cgpa;

  const pickedDelta = pickedCgpa - model.cgpa;

  const remainingCredits = Math.max(
    model.ongoingCr + model.notAttemptedCr,
    creditsInPlay,
  );
  const remainingProjection = projectCgpa(
    model.currentPoints, model.completedCr,
    remainingAvg * remainingCredits, remainingCredits,
  );

  function togglePick(key: string, grade: string) {
    setPicks((prev) => {
      const next = new Map(prev);
      if (next.get(key) === grade) next.delete(key);
      else next.set(key, grade);
      return next;
    });
  }

  function bulkPick(grade: 'A+' | 'A' | 'B+' | 'clear') {
    setPicks(() => {
      if (grade === 'clear') return new Map();
      const next = new Map<string, string>();
      for (const c of model.ongoing) next.set(c.key, grade);
      return next;
    });
  }

  return (
    <>
      <Snapshot model={model} />

      <Block index="01" title="Target" subtitle="Where do you want your final CGPA to land?">
        <TargetSetter
          value={target}
          onChange={setTarget}
          model={model}
          creditsInPlay={creditsInPlay}
          req={req}
          feas={feas}
        />
      </Block>

      {model.ongoing.length > 0 && (
        <Block index="02" title="Ongoing courses" subtitle="Pick a projected grade for each — the table shows how that choice moves your CGPA.">
          <OngoingMatrix
            model={model}
            picks={picks}
            onToggle={togglePick}
            pickedCgpa={pickedCgpa}
            pickedDelta={pickedDelta}
            pickedCredits={pickedPoints.cr}
            onBulk={bulkPick}
          />
        </Block>
      )}

      {model.notAttemptedCr > 0 && (
        <Block index="03" title="Remaining credits" subtitle="Drag the slider to see where different averages across your not-attempted courses land you.">
          <RemainingCard
            avg={remainingAvg}
            setAvg={setRemainingAvg}
            creditsInPlay={remainingCredits}
            projection={remainingProjection}
            target={target}
          />
        </Block>
      )}

      <Block index="04" title="Insights" subtitle="Quick reads from your actual data.">
        <InsightsGrid model={model} target={target} creditsInPlay={creditsInPlay} req={req} />
      </Block>

      <Block index="05" title="Trajectory" subtitle="Your semester-by-semester CGPA, with projected path to target.">
        <TrajectoryChart model={model} target={target} />
      </Block>
    </>
  );
}

function Snapshot({ model }: { model: Model }) {
  const done = model.completedCr;
  const ong = model.ongoingCr;
  const remaining = Math.max(0, GRADUATION_CREDITS - done - ong);
  const pct = Math.min(100, (done / GRADUATION_CREDITS) * 100);
  const st = standingOf(model.cgpa);
  const segTotal = Math.max(1, done + ong + remaining);

  return (
    <section className="grid gap-4 mb-7 grid-cols-[repeat(auto-fit,minmax(260px,1fr))]">
      <SnapCard title="Graduation progress">
        <div className="text-2xl font-extrabold tabular-nums text-ink">{fmt(done, 0)} / {GRADUATION_CREDITS}</div>
        <div className="mt-1 h-2 rounded-full bg-royal-50 overflow-hidden">
          <div className="h-full rounded-full transition-[width] duration-500"
               style={{ width: `${pct}%`, background: 'linear-gradient(90deg, var(--color-royal-600), var(--color-sky-500))' }} />
        </div>
        <span className="text-[12px] text-muted">
          {fmt(remaining, 0)} credits left · {fmt(pct, 0)}% of the BSc CSE minimum
        </span>
      </SnapCard>
      <SnapCard title="Credits breakdown">
        <div className="flex h-2 rounded-full overflow-hidden bg-royal-50">
          <div style={{ flexBasis: `${(done / segTotal) * 100}%`, background: 'var(--color-navy-500)' }} />
          <div style={{ flexBasis: `${(ong / segTotal) * 100}%`,  background: 'var(--color-gold-500)' }} />
          <div style={{ flexBasis: `${(remaining / segTotal) * 100}%`, background: 'var(--color-sky-500)' }} />
        </div>
        <ul className="flex flex-wrap gap-2.5 text-[12px] text-ink-2 m-0 p-0 list-none">
          <LegendDot tone="done">Completed <b className="font-mono ml-1">{fmt(done, 0)}</b></LegendDot>
          <LegendDot tone="ong">Ongoing <b className="font-mono ml-1">{fmt(ong, 0)}</b></LegendDot>
          <LegendDot tone="rem">Remaining <b className="font-mono ml-1">{fmt(remaining, 0)}</b></LegendDot>
        </ul>
      </SnapCard>
      <SnapCard title="Academic standing">
        <Pill tone={st.tone}>{st.label}</Pill>
        <span className="text-[12px] text-muted">{st.hint}</span>
      </SnapCard>
    </section>
  );
}

function SnapCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <article className="flex flex-col gap-2 p-4 bg-white rounded-xl border border-line shadow-[0_1px_2px_rgba(11,30,91,.04),0_8px_22px_-14px_rgba(11,30,91,.18)]">
      <span className="text-[11px] font-bold tracking-[0.12em] uppercase text-muted">{title}</span>
      {children}
    </article>
  );
}

function LegendDot({ tone, children }: { tone: 'done' | 'ong' | 'rem'; children: React.ReactNode }) {
  const color = tone === 'done' ? 'var(--color-navy-500)'
    : tone === 'ong' ? 'var(--color-gold-500)'
    : 'var(--color-sky-500)';
  return (
    <li className="inline-flex items-center gap-1.5">
      <span className="inline-block w-2 h-2 rounded-full" style={{ background: color }} />
      {children}
    </li>
  );
}

function Pill({ tone, children }: { tone: 'ok' | 'warn' | 'err' | 'muted'; children: React.ReactNode }) {
  const cls = tone === 'ok' ? 'bg-emerald-100 text-emerald-800'
    : tone === 'warn' ? 'bg-amber-100 text-amber-800'
    : tone === 'err' ? 'bg-red-100 text-red-800'
    : 'bg-line-soft text-muted';
  return (
    <span className={`inline-block self-start px-2.5 py-1 rounded-full text-[11px] font-bold tracking-wider uppercase ${cls}`}>
      {children}
    </span>
  );
}

// ---------- block wrapper ----------
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

// ---------- target setter ----------
function TargetSetter({ value, onChange, model, creditsInPlay, req, feas }: {
  value: number;
  onChange: (v: number) => void;
  model: Model;
  creditsInPlay: number;
  req: number;
  feas: ReturnType<typeof feasibilityOf>;
}) {
  const presets = [3.5, 3.75, 3.9, 4.0];
  let headline: React.ReactNode;
  if (!Number.isFinite(req)) {
    headline = 'No remaining credits — your CGPA is locked in.';
  } else if (req <= 0) {
    headline = <>You're already above your target ({fmt(value)}). Cruise mode.</>;
  } else if (req > 4.0) {
    headline = <>Reaching <b>{fmt(value)}</b> needs <b>{fmt(req)}</b> avg on {fmt(creditsInPlay, 0)} credits — above the 4.00 ceiling. Consider a closer target.</>;
  } else {
    headline = <>To reach <b>{fmt(value)} CGPA</b>, you need an average of <b>{fmt(req)} GPA</b> on your remaining <b>{fmt(creditsInPlay, 0)}</b> credits.</>;
  }

  return (
    <div className="flex flex-col gap-4.5">
      <div className="flex items-center gap-4.5 flex-wrap">
        <label htmlFor="targetCgpa" className="text-[12.5px] font-bold tracking-wide uppercase text-ink-2">
          Target CGPA
        </label>
        <div className="flex items-center gap-3 flex-wrap">
          <input id="targetCgpa"
                 type="number"
                 min={0} max={4} step={0.01}
                 value={value}
                 onChange={(e) => onChange(toNum(e.target.value))}
                 className="w-[120px] text-2xl font-extrabold tabular-nums px-3.5 py-2.5 rounded-lg border border-[1.5px] border-line text-ink bg-white outline-none focus:border-royal-600 focus:shadow-[0_0_0_4px_rgba(37,99,235,.12)]" />
          <div className="flex gap-1.5 flex-wrap">
            {presets.map((p) => (
              <button key={p} type="button"
                      onClick={() => onChange(p)}
                      className={`px-3 py-1.5 text-[12px] font-semibold font-mono rounded-full border cursor-pointer transition-colors ${
                        fmt(value) === fmt(p)
                          ? 'text-white border-transparent bg-[linear-gradient(135deg,var(--color-royal-600)_0%,var(--color-royal-500)_100%)]'
                          : 'bg-white text-ink-2 border-line hover:bg-royal-50 hover:text-royal-600 hover:border-royal-100'
                      }`}>
                {p.toFixed(2)}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-royal-100 p-4.5"
           style={{ background: 'linear-gradient(180deg, var(--color-royal-50) 0%, #fff 100%)' }}>
        <div className="text-[15px] leading-snug font-semibold text-ink-2 mb-3.5">{headline}</div>
        <div className="grid gap-3.5 grid-cols-[repeat(auto-fit,minmax(180px,1fr))]">
          <VerdictCell k="Required average on remaining" v={creditsInPlay > 0 && Number.isFinite(req) ? `${fmt(req)} GPA` : '—'} />
          <VerdictCell k="If you stop now" v={fmt(model.cgpa)} />
          <VerdictCell k="Feasibility">
            <Pill tone={feas.tone}>{feas.label}</Pill>
          </VerdictCell>
        </div>
      </div>
    </div>
  );
}

function VerdictCell({ k, v, children }: { k: string; v?: string; children?: React.ReactNode }) {
  return (
    <div>
      <span className="block mb-1.5 text-[10.5px] font-bold tracking-[0.12em] uppercase text-muted">{k}</span>
      <span className="text-[22px] font-extrabold tabular-nums text-ink">{children ?? v}</span>
    </div>
  );
}

// ---------- ongoing matrix ----------
function OngoingMatrix({ model, picks, onToggle, pickedCgpa, pickedDelta, pickedCredits, onBulk }: {
  model: Model;
  picks: Map<string, string>;
  onToggle: (key: string, grade: string) => void;
  pickedCgpa: number;
  pickedDelta: number;
  pickedCredits: number;
  onBulk: (g: 'A+' | 'A' | 'B+' | 'clear') => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="overflow-x-auto rounded-xl border border-line bg-paper-soft">
        <table className="w-full border-collapse text-[12.5px] tabular-nums">
          <thead>
            <tr>
              <th className="text-left min-w-[220px] bg-white px-2.5 py-2.5 text-[11px] font-bold uppercase tracking-wider text-muted border-b border-line">Course</th>
              <th className="bg-white px-2.5 py-2.5 text-[11px] font-bold uppercase tracking-wider text-muted border-b border-line min-w-[40px]">Cr</th>
              <th colSpan={GRADE_ORDER.length}
                  className="bg-paper-soft px-2.5 py-2.5 text-[11px] font-bold uppercase tracking-wider text-muted border-b border-line">
                Projected CGPA at each grade
              </th>
            </tr>
            <tr className="bg-paper-soft">
              <th></th><th></th>
              {GRADE_ORDER.map((g) => (
                <th key={g} className="px-2 py-2 font-mono text-[11px] text-ink-3 border-b-2 border-line">
                  {g}
                  <span className="block text-[9.5px] text-muted-2 mt-0.5 tracking-[0.04em]">
                    {GRADE_POINTS[g].toFixed(2)}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {model.ongoing.map((c) => (
              <tr key={c.key} className="border-b border-line-soft last:border-b-0">
                <td className="text-left font-semibold text-ink px-2.5 py-2.5">
                  <strong className="block">{c.name}</strong>
                  {c.classId && (
                    <small className="block font-mono font-medium text-[10.5px] text-muted mt-0.5">
                      {c.classId}{c.label && ` · ${c.label}`}
                    </small>
                  )}
                </td>
                <td className="px-2.5 py-2.5 text-center">{fmt(c.credit, 0)}</td>
                {GRADE_ORDER.map((grade) => {
                  const proj = projectCgpa(model.currentPoints, model.completedCr, GRADE_POINTS[grade] * c.credit, c.credit);
                  const active = picks.get(c.key) === grade;
                  return (
                    <td key={grade}
                        onClick={() => onToggle(c.key, grade)}
                        title={`If this course ends at ${grade} your CGPA would be ${fmt(proj)}`}
                        className={`cursor-pointer text-center font-mono text-[12px] select-none px-2 py-2.5 transition-colors ${
                          active
                            ? 'text-white font-extrabold bg-[linear-gradient(135deg,var(--color-royal-600)_0%,var(--color-royal-500)_100%)] shadow-[inset_0_1px_0_rgba(255,255,255,.2)]'
                            : 'text-ink-3 hover:bg-royal-50 hover:text-royal-600'
                        }`}>
                      {fmt(proj)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap gap-4 items-center justify-between p-3.5 rounded-xl border border-royal-100 bg-royal-50">
        <div className="flex items-baseline gap-3.5 flex-wrap">
          <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted">With your current picks</span>
          <span className="text-[26px] font-extrabold tabular-nums text-royal-600">{fmt(pickedCgpa)}</span>
          <span className="text-[12px] text-muted tabular-nums">
            {pickedCredits === 0
              ? 'Pick grades above to see the projection.'
              : `${pickedDelta >= 0 ? '+' : ''}${fmt(pickedDelta)} vs. current · ${fmt(pickedCredits, 0)} of ${fmt(model.ongoingCr, 0)} ongoing credits picked`}
          </span>
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {(['A+', 'A', 'B+', 'clear'] as const).map((g) => (
            <button key={g} type="button" onClick={() => onBulk(g)}
                    className="px-3 py-1.5 text-[11.5px] font-semibold text-ink-3 bg-white border border-line rounded-lg cursor-pointer transition-colors hover:bg-royal-600 hover:text-white hover:border-royal-600">
              {g === 'clear' ? 'Clear' : `All ${g}`}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ---------- remaining ----------
function RemainingCard({ avg, setAvg, creditsInPlay, projection, target }: {
  avg: number;
  setAvg: (v: number) => void;
  creditsInPlay: number;
  projection: number;
  target: number;
}) {
  const gap = (Number.isFinite(target) && target > 0) ? projection - target : NaN;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2.5">
        <label htmlFor="remainingSlider" className="text-[11.5px] font-bold uppercase tracking-wider text-muted">
          Average GPA you assume you'll get
        </label>
        <div className="flex items-center gap-4.5">
          <input id="remainingSlider" type="range"
                 min={0} max={4} step={0.05} value={avg}
                 onChange={(e) => setAvg(toNum(e.target.value))}
                 className="flex-1 h-1.5 rounded-full appearance-none outline-none cursor-pointer"
                 style={{ background: 'linear-gradient(90deg, #991b1b, #b45309, #15803d)' }} />
          <output className="text-xl font-extrabold tabular-nums text-royal-600 min-w-[60px] text-right">
            {fmt(avg)}
          </output>
        </div>
      </div>
      <div className="grid gap-3.5 p-4 rounded-xl border border-line bg-paper-soft grid-cols-[repeat(auto-fit,minmax(180px,1fr))]">
        <Stat k="Projected graduation CGPA" v={fmt(projection)} />
        <Stat k="Credits in play" v={`${fmt(creditsInPlay, 0)} cr`} />
        <Stat k="Gap vs. target"
              v={Number.isFinite(gap) ? `${gap >= 0 ? '+' : ''}${fmt(gap)}` : '—'}
              tone={Number.isFinite(gap) ? (gap >= 0 ? 'ok' : 'err') : undefined} />
      </div>
    </div>
  );
}

function Stat({ k, v, tone }: { k: string; v: string; tone?: 'ok' | 'err' }) {
  const color = tone === 'ok' ? 'text-emerald-700' : tone === 'err' ? 'text-red-700' : 'text-ink';
  return (
    <div>
      <span className="block mb-1.5 text-[11px] font-bold tracking-[0.12em] uppercase text-muted">{k}</span>
      <span className={`block text-[22px] font-extrabold tabular-nums ${color}`}>{v}</span>
    </div>
  );
}

// ---------- insights ----------
type Insight = { icon: string; tone: 'ok' | 'warn' | 'err' | 'muted'; title: string; value: string; hint: string };

function InsightsGrid({ model, target, creditsInPlay, req }: { model: Model; target: number; creditsInPlay: number; req: number }) {
  const cards: Insight[] = useMemo(() => buildInsights(model, target, creditsInPlay, req), [model, target, creditsInPlay, req]);
  return (
    <div className="grid gap-3.5 grid-cols-[repeat(auto-fit,minmax(220px,1fr))]">
      {cards.map((c, i) => (
        <article key={i} className="bg-white border border-line rounded-xl p-4 shadow-[0_1px_2px_rgba(11,30,91,.04),0_8px_22px_-14px_rgba(11,30,91,.18)] flex flex-col gap-1.5">
          <span className={`inline-flex items-center justify-center w-8 h-8 rounded-lg text-sm mb-1 ${toneBg(c.tone)}`}>
            {c.icon}
          </span>
          <span className="text-[10.5px] font-bold uppercase tracking-[0.12em] text-muted">{c.title}</span>
          <span className="text-[18px] font-extrabold tabular-nums leading-tight text-ink">{c.value}</span>
          <span className="text-[12px] leading-relaxed text-muted">{c.hint}</span>
        </article>
      ))}
    </div>
  );
}

function toneBg(tone: Insight['tone']) {
  switch (tone) {
    case 'ok':   return 'bg-emerald-100 text-emerald-800';
    case 'warn': return 'bg-amber-100 text-amber-800';
    case 'err':  return 'bg-red-100 text-red-800';
    default:     return 'bg-royal-50 text-royal-600';
  }
}

function buildInsights(model: Model, target: number, creditsInPlay: number, req: number): Insight[] {
  const cards: Insight[] = [];
  const typicalCr = 3;

  if (Number.isFinite(target) && creditsInPlay > 0) {
    if (req <= model.cgpa + 0.01) {
      cards.push({ icon: '✓', tone: 'ok', title: 'Trajectory', value: 'Ahead of target',
        hint: `Your current CGPA of ${fmt(model.cgpa)} already exceeds what you need for ${fmt(target)}.` });
    } else if (req <= 4.0) {
      cards.push({ icon: '→', tone: 'ok', title: 'Trajectory', value: `Need ${fmt(req)} avg`,
        hint: `Average this GPA over the remaining ${fmt(creditsInPlay, 0)} credits to hit ${fmt(target)}.` });
    } else {
      cards.push({ icon: '!', tone: 'err', title: 'Trajectory', value: 'Target unreachable',
        hint: `Would need ${fmt(req)} avg — above the 4.00 ceiling. Pick a lower target.` });
    }
  }

  const aPlusProj = projectCgpa(model.currentPoints, model.completedCr, 4.0 * typicalCr, typicalCr);
  const aPlusDelta = aPlusProj - model.cgpa;
  cards.push({ icon: 'A+', tone: 'ok', title: 'Single A+ impact',
    value: `${aPlusDelta >= 0 ? '+' : ''}${fmt(aPlusDelta)}`,
    hint: `A single A+ on a 3-credit course moves your CGPA from ${fmt(model.cgpa)} to ${fmt(aPlusProj)}.` });

  const cProj = projectCgpa(model.currentPoints, model.completedCr, 2.75 * typicalCr, typicalCr);
  const cDelta = cProj - model.cgpa;
  cards.push({ icon: 'C', tone: cDelta >= 0 ? 'ok' : 'warn', title: 'Single C impact',
    value: `${cDelta >= 0 ? '+' : ''}${fmt(cDelta)}`,
    hint: `A single C on a 3-credit course drops you to ${fmt(cProj)}.` });

  if (Number.isFinite(target) && creditsInPlay > 0) {
    const low = Math.max(0, req);
    const nearest = [...GRADE_ORDER].reverse().find((g) => GRADE_POINTS[g] >= low) ?? 'F';
    cards.push({
      icon: '⇣', tone: req > 4.0 ? 'err' : req > 3.5 ? 'warn' : 'ok',
      title: 'Lowest affordable average',
      value: Number.isFinite(req) ? (req > 4.0 ? '> 4.00' : fmt(req)) : '—',
      hint: req > 4.0
        ? `Even all A+ won't reach ${fmt(target)}.`
        : `Averaging ${nearest} (${fmt(GRADE_POINTS[nearest])}) or better on remaining credits hits ${fmt(target)}.`,
    });
  }

  if (Number.isFinite(target) && creditsInPlay > 0) {
    const semestersLeft = Math.ceil(creditsInPlay / 15);
    cards.push({ icon: '⏱', tone: 'ok', title: 'Semesters to graduation',
      value: `~${semestersLeft}`,
      hint: `At 15 credits / semester, roughly ${semestersLeft} more semester${semestersLeft === 1 ? '' : 's'} of coursework ahead.` });
  }

  const retakes = model.completed.filter((c) => c.gp < 3.25);
  if (retakes.length > 0) {
    let best: { course: Completed; delta: number; newCgpa: number } | null = null;
    for (const c of retakes) {
      const replacedPoints = model.currentPoints - c.gp * c.credit + 4.0 * c.credit;
      const newCgpa = model.completedCr > 0 ? replacedPoints / model.completedCr : 0;
      const delta = newCgpa - model.cgpa;
      if (!best || delta > best.delta) best = { course: c, delta, newCgpa };
    }
    if (best) {
      cards.push({ icon: '↻', tone: 'warn', title: 'Biggest retake lift',
        value: `${best.delta >= 0 ? '+' : ''}${fmt(best.delta)}`,
        hint: `Retaking ${best.course.name} (current ${best.course.grade}) as A+ would lift CGPA to ${fmt(best.newCgpa)}.` });
    }
  } else {
    cards.push({ icon: '★', tone: 'ok', title: 'Retake candidates',
      value: 'None',
      hint: 'All your completed grades are already B or better — no retake obviously helps.' });
  }

  if (model.cgpa < 3.75 && creditsInPlay > 0) {
    const r = requiredAvg(model.currentPoints, model.completedCr, creditsInPlay, 3.75);
    cards.push({ icon: '☆', tone: r <= 4.0 ? 'ok' : 'warn', title: "Dean's list (3.75)",
      value: r <= 4.0 ? `${fmt(r)} avg` : 'Not reachable',
      hint: r <= 4.0
        ? `Average ${fmt(r)} or better on remaining credits to graduate on the Dean's list.`
        : 'Would require above a 4.00 average. Focus on target CGPA instead.' });
  } else if (model.cgpa >= 3.75) {
    cards.push({ icon: '☆', tone: 'ok', title: "Dean's list", value: 'Qualifying',
      hint: `Your ${fmt(model.cgpa)} CGPA already clears the 3.75 Dean's list threshold.` });
  }

  if (creditsInPlay > 0) {
    const ceiling = projectCgpa(model.currentPoints, model.completedCr, 4.0 * creditsInPlay, creditsInPlay);
    cards.push({ icon: '⇧', tone: 'ok', title: 'Ceiling (all A+)',
      value: fmt(ceiling),
      hint: `The absolute best CGPA reachable from here is ${fmt(ceiling)}, if every remaining credit is an A+.` });
  }

  return cards;
}

// ---------- trajectory chart (Chart.js via dynamic import) ----------
function TrajectoryChart({ model, target }: { model: Model; target: number }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    let chart: { destroy(): void } | null = null;

    (async () => {
      const mod = await import('chart.js/auto');
      if (cancelled) return;
      const Chart = mod.default;

      const canvas = canvasRef.current;
      if (!canvas) return;

      const history = model.cgpaTrend.map((p) => ({ label: p.label, value: p.cgpa }));
      const creditsInPlay = Math.max(0, GRADUATION_CREDITS - model.completedCr);
      const semestersLeft = Math.max(1, Math.ceil(creditsInPlay / 15));
      const req = requiredAvg(model.currentPoints, model.completedCr, creditsInPlay, target);

      const projected: Array<{ label: string; value: number }> = [];
      if (Number.isFinite(req) && Number.isFinite(target) && creditsInPlay > 0) {
        let runPts = model.currentPoints;
        let runCr = model.completedCr;
        const perSem = creditsInPlay / semestersLeft;
        for (let i = 1; i <= semestersLeft; i++) {
          runPts += req * perSem;
          runCr += perSem;
          projected.push({ label: `+${i}`, value: runPts / runCr });
        }
      }

      const allLabels = [...history.map((h) => h.label), ...projected.map((p) => p.label)];
      const historyValues: Array<number | null> = [...history.map((h) => h.value), ...Array(projected.length).fill(null)];
      const projectedValues: Array<number | null> = [...Array(history.length).fill(null), ...projected.map((p) => p.value)];
      if (history.length && projected.length) projectedValues[history.length - 1] = history[history.length - 1].value;

      const datasets: Array<Record<string, unknown>> = [
        { label: 'CGPA (actual)', data: historyValues, borderColor: '#1d4ed8', backgroundColor: 'rgba(37,99,235,0.12)', fill: true, tension: 0.3, pointRadius: 4, pointBackgroundColor: '#1d4ed8' },
        { label: 'Projected path to target', data: projectedValues, borderColor: '#f59e0b', backgroundColor: 'rgba(245,158,11,0.1)', borderDash: [6, 4], fill: false, tension: 0.2, pointRadius: 3, pointBackgroundColor: '#f59e0b', spanGaps: true },
      ];
      if (Number.isFinite(target) && target > 0) {
        datasets.push({ label: `Target ${fmt(target)}`, data: allLabels.map(() => target), borderColor: '#059669', borderDash: [2, 4], fill: false, tension: 0, pointRadius: 0, borderWidth: 1.5 });
      }

      chart = new Chart(canvas, {
        type: 'line',
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        data: { labels: allLabels, datasets: datasets as any },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          interaction: { mode: 'index', intersect: false },
          plugins: {
            legend: { position: 'top', labels: { boxWidth: 10, font: { size: 12 } } },
            tooltip: {
              callbacks: {
                label: (ctx: { dataset: { label?: string }; raw: unknown }) =>
                  `${ctx.dataset.label}: ${ctx.raw == null ? '—' : fmt(Number(ctx.raw))}`,
              },
            },
          },
          scales: {
            y: {
              min: Math.max(0, Math.min(2, (model.cgpa || 2) - 0.8)),
              max: 4,
              ticks: { stepSize: 0.25 },
            },
          },
        },
      });
    })();

    return () => { cancelled = true; chart?.destroy(); };
  }, [model, target]);

  return (
    <article className="bg-white border border-line rounded-xl p-4 md:p-5 shadow-[0_1px_2px_rgba(11,30,91,.04),0_8px_22px_-14px_rgba(11,30,91,.18)]">
      <div className="relative h-[340px]">
        <canvas ref={canvasRef} />
      </div>
    </article>
  );
}
