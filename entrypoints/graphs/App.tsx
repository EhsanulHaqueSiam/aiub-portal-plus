import { useMemo } from 'react';
import type { ChartConfiguration } from 'chart.js';
import { PortalShell } from '@/components/PortalShell';
import { ChartCanvas } from '@/components/ChartCanvas';
import { useGraphData } from '@/hooks/useGraphData';
import type { AiubGraphData, Curriculum, Semester } from '@/lib/graphData';
import { fmt, toNum } from '@/lib/grades';

// AIUB grade / status color palette, matching the original Graphs page.
const COLORS: Record<string, string> = {
  'A+': '#059669', 'A': '#10b981', 'B+': '#2563eb', 'B': '#3b82f6',
  'C+': '#d97706', 'C': '#f59e0b', 'D+': '#dc2626', 'D': '#ef4444',
  'F': '#991b1b', 'W': '#6b7280', 'Ongoing': '#7c3aed', 'N/A': '#94a3b8',
  Completed: '#059669', Attempted: '#0ea5e9', Withdrawn: '#ef4444',
  'Not Attempted': '#94a3b8', Passed: '#059669', Dropped: '#6b7280',
  Failed: '#991b1b', Locked: '#dc2626', Unlocked: '#16a34a',
  Credits: '#0369a1', GPA: '#0f766e', CGPA: '#1d4ed8', Unattempted: '#cbd5e1',
};

export function App() {
  const { data, student, loaded } = useGraphData();
  return (
    <PortalShell active="graphs" student={student}>
      <Hero updatedAt={data?.updatedAt ?? data?.curriculum?.capturedAt ?? data?.semester?.capturedAt} />

      {!loaded ? (
        <div className="p-10 text-center text-muted">Loading…</div>
      ) : !data?.curriculum && !data?.semester ? (
        <EmptyState />
      ) : (
        <Dashboard data={data} />
      )}
    </PortalShell>
  );
}

function Hero({ updatedAt }: { updatedAt?: string }) {
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
        <p className="m-0 mb-2 text-[11px] font-bold tracking-[0.14em] uppercase text-white/70">AIUB Portal Plus</p>
        <h1 className="m-0 mb-2.5 font-display text-[40px] leading-[1.02] tracking-tight">
          Grade Analytics <em className="italic text-sky-500">Graphs</em>
        </h1>
        <p className="m-0 max-w-[62ch] text-sm leading-relaxed text-white/85">
          Nine charts computed locally from your own Grade Report data. Open
          the{' '}
          <a className="underline hover:no-underline" href="https://portal.aiub.edu/Student/GradeReport/ByCurriculum">By Curriculum</a>
          {' '}and{' '}
          <a className="underline hover:no-underline" href="https://portal.aiub.edu/Student/GradeReport/BySemester">By Semester</a>
          {' '}Grade Report pages to sync. Elective credits are excluded from curriculum metrics.
        </p>
      </div>
      <div className="self-center justify-self-end text-right min-w-[200px] p-4 border border-white/15 rounded-xl bg-white/5">
        <span className="block text-[11px] font-bold uppercase tracking-[0.14em] text-white/70 mb-1.5">
          Data freshness
        </span>
        <span className="block text-[18px] font-semibold text-white tabular-nums">
          {updatedAt ? new Date(updatedAt).toLocaleString() : '—'}
        </span>
        <span className="block mt-1 text-[11px] text-white/70">
          {updatedAt ? 'last synced' : 'Open the Grade Report pages to sync.'}
        </span>
      </div>
    </section>
  );
}

function EmptyState() {
  return (
    <section className="relative rounded-xl border border-gold-500/50 bg-gold-400/15 pl-11 pr-5 py-5 mb-6">
      <span aria-hidden="true" className="absolute left-4 top-[24px] w-2 h-2 rounded-full bg-gold-500" />
      <h2 className="m-0 mb-1.5 text-base text-amber-900 font-bold">No graph data synced yet</h2>
      <p className="m-0 text-[13px] leading-relaxed text-amber-900">
        Visit your{' '}
        <a className="font-bold text-royal-600" href="https://portal.aiub.edu/Student/GradeReport/ByCurriculum">Curriculum Grade Report</a>
        {' '}and{' '}
        <a className="font-bold text-royal-600" href="https://portal.aiub.edu/Student/GradeReport/BySemester">Semester Grade Report</a>
        {' '}pages once. The dashboard builds itself from the data your browser cached.
      </p>
    </section>
  );
}

// ---------- dashboard ----------
function Dashboard({ data }: { data: AiubGraphData }) {
  const curriculum = data.curriculum ?? null;
  const semester = data.semester ?? null;

  const gradeBars = useMemo(() => gradeDistributionData(curriculum), [curriculum]);
  const statusBars = useMemo(() => statusDistributionData(curriculum, semester), [curriculum, semester]);
  const prereqParts = useMemo(() => prerequisiteData(curriculum), [curriculum]);
  const cgpaPoints = useMemo(() => cgpaTrendData(semester), [semester]);
  const gpaPoints = useMemo(() => gpaTrendData(semester), [semester]);
  const progressGroups = useMemo(() => semesterProgressData(curriculum), [curriculum]);
  const attemptRows = useMemo(() => attemptRateData(curriculum), [curriculum]);
  const scatterPoints = useMemo(() => gpaCreditsScatterData(semester), [semester]);
  const creditsPoints = useMemo(() => creditsData(semester), [semester]);

  return (
    <>
      <KpiGrid curriculum={curriculum} semester={semester} />
      <InsightsRow curriculum={curriculum} semester={semester} />

      <section className="grid gap-4 grid-cols-1 lg:grid-cols-2">
        <ChartCard title="Grade Distribution by Credits" subtitle="Credit totals grouped by final grade and ongoing courses.">
          <BarOrEmpty key="grades" series={gradeBars}
            fallback="No curriculum grade distribution available yet."
            ariaLabel="Bar chart of credit totals grouped by final grade, including ongoing courses." />
        </ChartCard>

        <ChartCard title="Status Split by Credits" subtitle="Completed, ongoing, withdrawn, and not-attempted credit totals.">
          <BarOrEmpty key="status" series={statusBars}
            fallback="No credit status distribution available yet."
            ariaLabel="Bar chart of credit totals grouped by status: completed, ongoing, withdrawn, and not attempted." />
        </ChartCard>

        <ChartCard title="Prerequisite Unlock Ratio" subtitle="How many not-attempted courses are currently unlocked.">
          <DonutOrEmpty parts={prereqParts}
            fallback="Visit Curriculum Grade Report to capture prerequisite lock data."
            ariaLabel="Donut chart showing the proportion of not-attempted courses that are currently unlocked by prerequisites versus still locked." />
        </ChartCard>

        <ChartCard title="CGPA Trend" subtitle="Cumulative GPA movement across completed semesters.">
          <LineOrEmpty points={cgpaPoints} fallback="Visit Semester Grade Report to capture CGPA trend data."
            label="CGPA" stroke={COLORS.CGPA}
            ariaLabel="Line chart of cumulative GPA across each completed semester." />
        </ChartCard>

        <ChartCard wide title="Semester GPA Trend" subtitle="Semester GPA over time based on your semester report.">
          <LineOrEmpty points={gpaPoints} fallback="Visit Semester Grade Report to capture GPA trend data."
            label="Semester GPA" stroke={COLORS.GPA}
            ariaLabel="Line chart of per-semester GPA over time." />
        </ChartCard>

        <ChartCard wide title="Semester Credit Completion" subtitle="Attempted and completed credits by curriculum semester block.">
          <GroupedBarsOrEmpty groups={progressGroups}
            fallback="Visit Curriculum Grade Report to capture semester progression."
            ariaLabel="Grouped bar chart showing attempted credits versus completed credits for each curriculum semester block." />
        </ChartCard>

        <ChartCard wide title="Semester Attempt Rate" subtitle="Attempted and completed percentages against total listed credits.">
          <AttemptRateOrEmpty rows={attemptRows}
            fallback="Visit Curriculum Grade Report to capture attempt rate data."
            ariaLabel="Stacked horizontal bar chart of completed, attempted-not-completed, and unattempted percentages per semester." />
        </ChartCard>

        <ChartCard wide title="GPA vs Credits Correlation" subtitle="Relation between semester credit load and GPA.">
          <ScatterOrEmpty points={scatterPoints}
            fallback="Need both credits and GPA per semester — visit both Grade Report pages."
            ariaLabel="Scatter plot of semester GPA on the vertical axis against credits earned on the horizontal axis, one point per semester." />
        </ChartCard>

        <ChartCard wide title="Credits Earned by Semester" subtitle="Credits earned trend from semester summaries.">
          <BarOrEmpty key="credits" series={creditsPoints}
            fallback="Visit Semester Grade Report to capture credit summaries."
            ariaLabel="Bar chart of credits earned each semester." />
        </ChartCard>
      </section>
    </>
  );
}

// ---------- KPIs ----------
function KpiGrid({ curriculum, semester }: { curriculum: Curriculum | null; semester: Semester | null }) {
  const stateCredits = curriculum?.stateCredits ?? {} as NonNullable<Curriculum['stateCredits']>;
  const passFailCredits = semester?.passFailCredits ?? {} as NonNullable<Semester['passFailCredits']>;
  const cgpa = (curriculum?.cgpa ?? 0) > 0 ? curriculum!.cgpa! : (semester?.latestCgpa ?? 0);
  const totalCredits = toNum(curriculum?.totalCredits ?? semester?.totalCredits);
  const prerequisite = curriculum?.prerequisite;

  const cards: Array<{ label: string; value: string; note: string }> = [
    { label: 'Student', value: curriculum?.studentName || semester?.studentName || 'Unknown',
      note: curriculum?.studentId || semester?.studentId || 'ID unavailable' },
    { label: 'Program', value: curriculum?.program || semester?.program || 'N/A', note: 'Academic profile' },
    { label: 'CGPA', value: cgpa > 0 ? fmt(cgpa) : 'N/A', note: 'Latest cumulative GPA' },
    { label: 'Completed Credits', value: fmt(toNum(stateCredits.completed ?? passFailCredits.passed), 0),
      note: totalCredits ? `Out of ${fmt(totalCredits, 0)} credits` : 'Earned and passed credits' },
    { label: 'Ongoing Credits', value: fmt(toNum(stateCredits.ongoing ?? passFailCredits.ongoing), 0),
      note: 'Credits currently running' },
    { label: 'Remaining Credits', value: fmt(toNum(stateCredits.notAttempted), 0),
      note: prerequisite ? `Locked: ${fmt(prerequisite.lockedCredits, 0)}` : 'Curriculum page needed' },
  ];

  return (
    <section className="grid gap-3.5 mb-4 grid-cols-[repeat(auto-fit,minmax(200px,1fr))]">
      {cards.map((c) => (
        <article key={c.label} className="bg-white border border-line rounded-xl p-4 shadow-card">
          <span className="block text-[11px] font-bold tracking-[0.12em] uppercase text-muted">{c.label}</span>
          <span className="block text-[22px] font-extrabold tabular-nums leading-tight text-ink mt-1.5 mb-1">{c.value}</span>
          <span className="block text-[12px] text-muted">{c.note}</span>
        </article>
      ))}
    </section>
  );
}

function InsightsRow({ curriculum, semester }: { curriculum: Curriculum | null; semester: Semester | null }) {
  const chips: Array<{ color: string; text: string }> = [];

  if (curriculum?.prerequisite) {
    const locked = toNum(curriculum.prerequisite.lockedCredits);
    const unlocked = toNum(curriculum.prerequisite.unlockedCredits);
    const total = locked + unlocked;
    const rate = total > 0 ? ((unlocked / total) * 100).toFixed(1) : '0.0';
    chips.push({ color: COLORS.Unlocked, text: `Unlock rate ${rate}%` });
  }

  const trend = semester?.semesterGpaTrend ?? [];
  if (trend.length > 1) {
    const delta = toNum(trend[trend.length - 1].gpa) - toNum(trend[0].gpa);
    chips.push({
      color: delta >= 0 ? COLORS.Completed : COLORS.Failed,
      text: `Semester GPA change ${delta >= 0 ? '+' : ''}${delta.toFixed(2)}`,
    });
  }

  if (semester?.creditBySemester?.length) {
    const peak = Math.max(...semester.creditBySemester.map((p) => toNum(p.credits)));
    chips.push({ color: COLORS.Credits, text: `Peak credit load ${fmt(peak, 0)}` });
  }

  if (curriculum?.stateCredits) {
    const s = curriculum.stateCredits;
    const attempted = toNum(s.completed) + toNum(s.ongoing) + toNum(s.withdrawn);
    const totalCredits = toNum(curriculum.totalCredits);
    const rate = totalCredits > 0 ? ((attempted / totalCredits) * 100).toFixed(1) : '0.0';
    chips.push({ color: COLORS.Attempted, text: `Curriculum credit attempt rate ${rate}%` });
  }

  if (chips.length === 0) return null;

  return (
    <section className="flex flex-wrap gap-2 mb-4">
      {chips.map((c) => (
        <span key={c.text} className="inline-flex items-center gap-1.5 rounded-full border border-line bg-white px-3 py-1.5 text-[11.5px] font-semibold text-ink-2 shadow-[0_1px_2px_rgba(11,30,91,.04)]">
          <span className="inline-block w-2 h-2 rounded-full" style={{ background: c.color }} />
          {c.text}
        </span>
      ))}
    </section>
  );
}

// ---------- chart wrappers ----------
function ChartCard({ title, subtitle, wide, children }: {
  title: string; subtitle: string; wide?: boolean; children: React.ReactNode;
}) {
  return (
    <article className={`bg-white border border-line rounded-xl p-4 md:p-5 shadow-card ${wide ? 'lg:col-span-2' : ''}`}>
      <div className="mb-3">
        <h3 className="m-0 text-[14px] font-bold text-ink-2">{title}</h3>
        <p className="m-0 mt-0.5 text-[12px] text-muted leading-relaxed">{subtitle}</p>
      </div>
      {children}
    </article>
  );
}

function EmptyChart({ text }: { text: string }) {
  return (
    <div className="h-[240px] grid place-items-center rounded-lg border border-dashed border-line bg-paper-soft text-[12.5px] text-muted px-4 text-center leading-relaxed">
      {text}
    </div>
  );
}

// ---------- common plugin options ----------
function basePlugins() {
  return {
    legend: {
      display: true,
      position: 'bottom' as const,
      labels: { color: '#334155', usePointStyle: true, boxWidth: 10, font: { size: 11 } },
    },
    tooltip: {
      callbacks: {
        label(ctx: { dataset: { label?: string }; parsed: number | { x: number; y: number } }) {
          const raw = typeof ctx.parsed === 'number' ? ctx.parsed : ctx.parsed.y;
          return `${ctx.dataset.label ? ctx.dataset.label + ': ' : ''}${fmt(raw)}`;
        },
      },
    },
  };
}

// ---------- bar chart ----------
type BarSeries = { label: string; value: number; color?: string };
function BarOrEmpty({ series, fallback, ariaLabel }: { series: BarSeries[]; fallback: string; ariaLabel: string }) {
  const config = useMemo<ChartConfiguration | null>(() => {
    if (!series.length) return null;
    return {
      type: 'bar',
      data: {
        labels: series.map((s) => s.label),
        datasets: [{
          label: 'Credits',
          data: series.map((s) => toNum(s.value)),
          backgroundColor: series.map((s) => s.color ?? '#0369a1'),
          borderRadius: 8,
          maxBarThickness: 42,
        }],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        animation: { duration: 420 },
        plugins: basePlugins(),
        scales: {
          x: { ticks: { color: '#64748b' }, grid: { display: false } },
          y: { beginAtZero: true, ticks: { color: '#64748b' }, grid: { color: '#e2e8f0' } },
        },
      },
    };
  }, [series]);

  if (!config) return <EmptyChart text={fallback} />;
  return <ChartCanvas config={config} height={300} ariaLabel={ariaLabel} />;
}

// ---------- donut ----------
function DonutOrEmpty({ parts, fallback, ariaLabel }: { parts: BarSeries[]; fallback: string; ariaLabel: string }) {
  const config = useMemo<ChartConfiguration | null>(() => {
    if (!parts.length) return null;
    const total = parts.reduce((sum, p) => sum + toNum(p.value), 0);
    if (total === 0) return null;
    return {
      type: 'doughnut',
      data: {
        labels: parts.map((p) => p.label),
        datasets: [{
          label: 'Credits',
          data: parts.map((p) => toNum(p.value)),
          backgroundColor: parts.map((p) => p.color ?? '#0369a1'),
          borderWidth: 0,
        }],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        cutout: '62%',
        animation: { duration: 420 },
        plugins: basePlugins(),
      },
    };
  }, [parts]);

  if (!config) return <EmptyChart text={fallback} />;
  return <ChartCanvas config={config} height={300} ariaLabel={ariaLabel} />;
}

// ---------- line ----------
type LinePoint = { label: string; value: number };
function LineOrEmpty({ points, fallback, label, stroke, ariaLabel }: { points: LinePoint[]; fallback: string; label: string; stroke: string; ariaLabel: string }) {
  const config = useMemo<ChartConfiguration | null>(() => {
    if (points.length < 2) return null;
    return {
      type: 'line',
      data: {
        labels: points.map((p) => p.label),
        datasets: [{
          label,
          data: points.map((p) => toNum(p.value)),
          borderColor: stroke,
          backgroundColor: stroke + '22',
          pointBackgroundColor: stroke,
          pointBorderColor: '#ffffff',
          pointBorderWidth: 1.5,
          pointRadius: 4,
          pointHoverRadius: 5,
          borderWidth: 2.7,
          fill: false,
          tension: 0.32,
        }],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        animation: { duration: 420 },
        plugins: basePlugins(),
        scales: {
          x: { ticks: { color: '#64748b' }, grid: { display: false } },
          y: { beginAtZero: true, max: 4, ticks: { color: '#64748b' }, grid: { color: '#e2e8f0' } },
        },
      },
    };
  }, [points, label, stroke]);

  if (!config) return <EmptyChart text={fallback} />;
  return <ChartCanvas config={config} height={300} ariaLabel={ariaLabel} />;
}

// ---------- grouped bars (semester progress) ----------
type ProgressGroup = { label: string; total: number; attempted: number; completed: number };
function GroupedBarsOrEmpty({ groups, fallback, ariaLabel }: { groups: ProgressGroup[]; fallback: string; ariaLabel: string }) {
  const config = useMemo<ChartConfiguration | null>(() => {
    if (!groups.length) return null;
    return {
      type: 'bar',
      data: {
        labels: groups.map((g) => g.label),
        datasets: [
          { label: 'Attempted Credits', data: groups.map((g) => toNum(g.attempted)), backgroundColor: COLORS.Attempted, borderRadius: 7, maxBarThickness: 36 },
          { label: 'Completed Credits', data: groups.map((g) => toNum(g.completed)), backgroundColor: COLORS.Completed, borderRadius: 7, maxBarThickness: 36 },
        ],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        animation: { duration: 420 },
        plugins: basePlugins(),
        scales: {
          x: { ticks: { color: '#64748b' }, grid: { display: false } },
          y: { beginAtZero: true, ticks: { color: '#64748b' }, grid: { color: '#e2e8f0' } },
        },
      },
    };
  }, [groups]);

  if (!config) return <EmptyChart text={fallback} />;
  return <ChartCanvas config={config} height={320} ariaLabel={ariaLabel} />;
}

// ---------- attempt rate (stacked horizontal) ----------
type AttemptRow = { label: string; total: number; attempted: number; completed: number };
function AttemptRateOrEmpty({ rows, fallback, ariaLabel }: { rows: AttemptRow[]; fallback: string; ariaLabel: string }) {
  const config = useMemo<ChartConfiguration | null>(() => {
    if (!rows.length) return null;
    const completedPct = rows.map((r) => r.total > 0 ? (r.completed / r.total) * 100 : 0);
    const inProgressPct = rows.map((r) => r.total > 0 ? Math.max(0, (r.attempted - r.completed) / r.total * 100) : 0);
    const unattemptedPct = rows.map((r, i) => Math.max(0, 100 - completedPct[i] - inProgressPct[i]));
    return {
      type: 'bar',
      data: {
        labels: rows.map((r) => r.label),
        datasets: [
          { label: 'Completed %', data: completedPct, backgroundColor: COLORS.Completed, stack: 'rate' },
          { label: 'Attempted Not Completed %', data: inProgressPct, backgroundColor: COLORS.Attempted, stack: 'rate' },
          { label: 'Unattempted %', data: unattemptedPct, backgroundColor: COLORS.Unattempted, stack: 'rate' },
        ],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        indexAxis: 'y' as const,
        animation: { duration: 420 },
        plugins: basePlugins(),
        scales: {
          x: { stacked: true, min: 0, max: 100, ticks: { color: '#64748b', callback: (v: string | number) => `${v}%` }, grid: { color: '#e2e8f0' } },
          y: { stacked: true, ticks: { color: '#64748b' }, grid: { display: false } },
        },
      },
    };
  }, [rows]);

  if (!config) return <EmptyChart text={fallback} />;
  return <ChartCanvas config={config} height={Math.max(280, rows.length * 50)} ariaLabel={ariaLabel} />;
}

// ---------- scatter ----------
type Scatter = { x: number; y: number; label: string };
function ScatterOrEmpty({ points, fallback, ariaLabel }: { points: Scatter[]; fallback: string; ariaLabel: string }) {
  const config = useMemo<ChartConfiguration | null>(() => {
    if (points.length < 2) return null;
    return {
      type: 'scatter',
      data: {
        datasets: [{
          label: 'Semester',
          data: points.map((p) => ({ x: toNum(p.x), y: toNum(p.y), label: p.label })),
          pointBackgroundColor: 'rgba(30, 64, 175, 0.72)',
          pointBorderColor: '#1e40af',
          pointBorderWidth: 1.2,
          pointRadius: 5,
        }],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        animation: { duration: 420 },
        plugins: {
          legend: basePlugins().legend,
          tooltip: {
            callbacks: {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              title: (items: any[]) => (items[0]?.raw?.label ?? 'Semester') as string,
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              label: (ctx: any) => `Credits ${fmt(ctx.raw.x, 0)}, GPA ${fmt(ctx.raw.y)}`,
            },
          },
        },
        scales: {
          x: { beginAtZero: true, title: { display: true, text: 'Credits Earned', color: '#64748b' }, ticks: { color: '#64748b' }, grid: { color: '#e2e8f0' } },
          y: { min: 0, max: 4, title: { display: true, text: 'Semester GPA', color: '#64748b' }, ticks: { color: '#64748b' }, grid: { color: '#e2e8f0' } },
        },
      },
    };
  }, [points]);

  if (!config) return <EmptyChart text={fallback} />;
  return <ChartCanvas config={config} height={320} ariaLabel={ariaLabel} />;
}

// ---------- data-shape helpers ----------
function gradeDistributionData(c: Curriculum | null): BarSeries[] {
  if (!c?.gradeDistribution) return [];
  const order = ['A+', 'A', 'B+', 'B', 'C+', 'C', 'D+', 'D', 'F', 'W', 'Ongoing', 'N/A'];
  const out: BarSeries[] = [];
  const used = new Set<string>();
  for (const k of order) {
    if (Object.prototype.hasOwnProperty.call(c.gradeDistribution, k)) {
      out.push({ label: k, value: toNum(c.gradeDistribution[k]), color: COLORS[k] ?? '#0369a1' });
      used.add(k);
    }
  }
  for (const k of Object.keys(c.gradeDistribution)) {
    if (used.has(k)) continue;
    out.push({ label: k, value: toNum(c.gradeDistribution[k]), color: COLORS[k] ?? '#0369a1' });
  }
  return out;
}

function statusDistributionData(c: Curriculum | null, s: Semester | null): BarSeries[] {
  if (c?.stateCredits) {
    return [
      { label: 'Completed Credits', value: toNum(c.stateCredits.completed), color: COLORS.Completed },
      { label: 'Ongoing Credits', value: toNum(c.stateCredits.ongoing), color: COLORS.Ongoing },
      { label: 'Withdrawn Credits', value: toNum(c.stateCredits.withdrawn), color: COLORS.Withdrawn },
      { label: 'Not Attempted Credits', value: toNum(c.stateCredits.notAttempted), color: COLORS['Not Attempted'] },
    ];
  }
  if (s?.passFailCredits) {
    return [
      { label: 'Passed Credits', value: toNum(s.passFailCredits.passed), color: COLORS.Passed },
      { label: 'Ongoing Credits', value: toNum(s.passFailCredits.ongoing), color: COLORS.Ongoing },
      { label: 'Dropped Credits', value: toNum(s.passFailCredits.dropped), color: COLORS.Dropped },
      { label: 'Failed Credits', value: toNum(s.passFailCredits.failed), color: COLORS.Failed },
    ];
  }
  return [];
}

function prerequisiteData(c: Curriculum | null): BarSeries[] {
  if (!c?.prerequisite) return [];
  return [
    { label: 'Unlocked Credits', value: toNum(c.prerequisite.unlockedCredits), color: COLORS.Unlocked },
    { label: 'Locked Credits', value: toNum(c.prerequisite.lockedCredits), color: COLORS.Locked },
  ];
}

function cgpaTrendData(s: Semester | null): LinePoint[] {
  if (!s?.cgpaTrend) return [];
  return s.cgpaTrend.map((p) => ({ label: String(p.label), value: toNum(p.cgpa) }));
}

function gpaTrendData(s: Semester | null): LinePoint[] {
  if (!s?.semesterGpaTrend) return [];
  return s.semesterGpaTrend.map((p) => ({ label: String(p.label), value: toNum(p.gpa) }));
}

function semesterProgressData(c: Curriculum | null): ProgressGroup[] {
  if (!c?.semesterProgress) return [];
  return c.semesterProgress.map((p) => ({
    label: String(p.label),
    total: toNum(p.total), attempted: toNum(p.attempted), completed: toNum(p.completed),
  }));
}

function attemptRateData(c: Curriculum | null): AttemptRow[] {
  if (!c?.semesterProgress) return [];
  return c.semesterProgress.map((p) => ({
    label: String(p.label),
    total: toNum(p.total), attempted: toNum(p.attempted), completed: toNum(p.completed),
  }));
}

function creditsData(s: Semester | null): BarSeries[] {
  if (!s?.creditBySemester) return [];
  return s.creditBySemester.map((p) => ({ label: String(p.label), value: toNum(p.credits), color: COLORS.Credits }));
}

function gpaCreditsScatterData(s: Semester | null): Scatter[] {
  if (!s?.creditBySemester || !s?.semesterGpaTrend) return [];
  const creditsByLabel = new Map<string, number>();
  for (const p of s.creditBySemester) creditsByLabel.set(String(p.label), toNum(p.credits));
  const points = s.semesterGpaTrend
    .map((g) => ({
      label: String(g.label),
      x: creditsByLabel.get(String(g.label)) ?? 0,
      y: toNum(g.gpa),
    }))
    .filter((p) => p.x > 0 && p.y > 0);
  return points;
}
