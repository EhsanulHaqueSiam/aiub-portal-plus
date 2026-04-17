import type { ReactNode } from 'react';
import { runtimeURL } from '@/lib/runtime';
import type { AiubStudent } from '@/lib/graphData';

export type ToolId = 'graphs' | 'cgpa-planner' | 'routine-generator';

type Props = {
  active: ToolId;
  student: AiubStudent | null;
  children: ReactNode;
};

const topLinks = [
  { href: 'https://portal.aiub.edu/Student/Course',                  label: 'Courses & Results', icon: '≡' },
  { href: 'https://portal.aiub.edu/Student/Registration',            label: 'Registration',       icon: '⚡' },
  { href: 'https://portal.aiub.edu/Student/GradeReport/ByCurriculum', label: 'Grade Report',      icon: '✦' },
];

const academics = [
  ['https://portal.aiub.edu/Student/Course',              'Courses & Results'],
  ['https://portal.aiub.edu/Student/Registration',        'Registration'],
  ['https://portal.aiub.edu/Student/Adrop/DropApplication','Drop Application'],
  ['https://portal.aiub.edu/Student/Section/Offered',     'Offered Courses'],
  ['https://portal.aiub.edu/Student/Curriculum',          'My Curriculum'],
  ['https://portal.aiub.edu/Student/Accounts',            'Financials'],
] as const;

const gradeReports = [
  ['https://portal.aiub.edu/Student/GradeReport/ByCurriculum', 'By Curriculum'],
  ['https://portal.aiub.edu/Student/GradeReport/BySemester',  'By Semester'],
] as const;

export function PortalShell({ active, student, children }: Props) {
  const tools: Array<{ id: ToolId; href: string; label: string }> = [
    { id: 'graphs',           href: runtimeURL('/Grade/Graphs.html'),             label: 'Graphs' },
    { id: 'cgpa-planner',     href: runtimeURL('/cgpa-planner.html'),             label: 'CGPA Planner' },
    { id: 'routine-generator',href: runtimeURL('/RoutineGenerator/index.html'),   label: 'Routine Generator' },
  ];

  return (
    <>
      <header className="sticky top-0 z-40 h-[60px] min-h-[60px] text-white border-b border-white/10 shadow-[0_2px_12px_rgba(37,99,235,.3)]"
              style={{ background: 'linear-gradient(135deg, var(--color-royal-600) 0%, var(--color-royal-500) 60%, var(--color-navy-500) 100%)' }}>
        <div className="mx-auto h-full px-6 flex items-center gap-2 w-full">
          <a href="https://portal.aiub.edu/Student" className="inline-flex items-center gap-2.5 pr-5 text-white font-extrabold text-base tracking-tight whitespace-nowrap no-underline!">
            <span className="w-7 h-7 rounded-md bg-white/20 border-[1.5px] border-white/40 shadow-[inset_0_0_0_2px_rgba(255,255,255,.1)]" aria-hidden />
            <span className="leading-none">AIUB Portal<span className="text-gold-400">+</span></span>
          </a>
          <nav className="hidden md:flex items-center gap-0.5 ml-1.5" aria-label="Portal sections">
            {topLinks.map((l) => (
              <a key={l.href} href={l.href}
                 className="inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-[12.5px] font-semibold text-white/85 whitespace-nowrap no-underline! transition-colors hover:bg-white/15 hover:text-white">
                <span className="font-mono text-[12px] opacity-75">{l.icon}</span> {l.label}
              </a>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-1">
            <span className="hidden sm:block text-[12px] text-white/85 pr-2.5 mr-1.5 whitespace-nowrap">
              Welcome <span className="text-white font-bold">{student?.name || 'student'}</span>
            </span>
            <a href="https://portal.aiub.edu/Student"
               title="Portal home" aria-label="Portal home"
               className="inline-flex items-center justify-center w-8.5 h-8.5 rounded-lg text-white/85 text-sm no-underline! transition-colors hover:bg-white/15 hover:text-white">🏠</a>
            <a href="https://portal.aiub.edu/Login/Logout"
               title="Log out" aria-label="Log out"
               className="inline-flex items-center justify-center w-8.5 h-8.5 rounded-lg text-white/85 text-sm no-underline! transition-colors hover:bg-red-500/25 hover:text-red-200">↪</a>
          </div>
        </div>
      </header>

      <div className="mx-auto w-full px-6 py-5 pb-12 grid gap-6 items-start"
           style={{ gridTemplateColumns: '260px minmax(0, 1fr)' }}>
        <aside className="sticky top-20 max-h-[calc(100vh-80px)] overflow-y-auto flex flex-col gap-2.5 p-1 [scrollbar-width:thin]"
               aria-label="Navigation">
          <div className="relative overflow-hidden rounded-xl p-4.5 text-white shadow-[0_4px_16px_-6px_rgba(11,30,91,.35)]"
               style={{ background: 'linear-gradient(135deg, var(--color-navy-900) 0%, var(--color-royal-600) 65%, var(--color-navy-700) 100%)' }}>
            <div className="absolute -top-[40%] -right-[20%] w-[180px] h-[180px] pointer-events-none"
                 style={{ background: 'radial-gradient(circle, rgba(251,191,36,.18) 0%, transparent 70%)' }} />
            <div className="font-display text-[17px] font-medium leading-tight tracking-tight whitespace-nowrap overflow-hidden text-ellipsis">
              {student?.name || 'Student'}
            </div>
            <div className="font-mono text-[11px] tracking-widest mt-1 text-white/75">
              {student?.studentId || ''}
            </div>
          </div>

          <SidebarGroup>
            <SidebarSection title="Academics" icon="📊">
              {academics.map(([href, label]) => (
                <SidebarLink key={href} href={href}>{label}</SidebarLink>
              ))}
            </SidebarSection>
            <SidebarSection title="Grade Reports" icon="✦">
              {gradeReports.map(([href, label]) => (
                <SidebarLink key={href} href={href}>{label}</SidebarLink>
              ))}
            </SidebarSection>
            <SidebarSection title="Tools" icon="⚙">
              {tools.map((t) => (
                <SidebarLink key={t.id} href={t.href} active={t.id === active}>{t.label}</SidebarLink>
              ))}
            </SidebarSection>
          </SidebarGroup>

          <footer className="mt-auto p-3.5 text-[11px] leading-relaxed rounded-xl border border-royal-100 bg-royal-50 text-muted">
            <span className="inline-block font-mono text-[9.5px] tracking-[0.2em] uppercase font-bold text-royal-600 px-2 py-0.5 bg-white border border-royal-100 rounded-full">
              Unofficial extension
            </span>
            <p className="mt-1.5">No credentials handled. Verify every action on the official AIUB Portal before relying on it.</p>
          </footer>
        </aside>

        <main className="min-w-0">
          {children}
        </main>
      </div>
    </>
  );
}

function SidebarGroup({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col rounded-xl border border-line overflow-hidden bg-white shadow-[0_1px_2px_rgba(11,30,91,.04),0_8px_22px_-14px_rgba(11,30,91,.18)]">
      {children}
    </div>
  );
}

function SidebarSection({ title, icon, children }: { title: string; icon: string; children: ReactNode }) {
  return (
    <section className="border-b border-line-soft last:border-b-0">
      <div className="flex items-center gap-2.5 px-3.5 py-2.5 text-[12.5px] font-bold text-ink-2 tracking-tight select-none">
        <span className="font-mono text-[12px] text-muted-2 w-[18px] text-center">{icon}</span>
        {title}
        <span className="ml-auto font-mono text-[10px] text-muted-2">▾</span>
      </div>
      <div className="flex flex-col gap-0.5 px-1.5 pt-1 pb-2 bg-paper-soft border-t border-line-soft">
        {children}
      </div>
    </section>
  );
}

function SidebarLink({ href, active, children }: { href: string; active?: boolean; children: ReactNode }) {
  const base = 'block px-3 py-2 text-[12px] font-medium leading-tight rounded-md transition-colors no-underline!';
  const inactive = 'text-ink-3 hover:bg-royal-50 hover:text-royal-600';
  const activeCls = 'text-white font-bold shadow-[0_2px_8px_-3px_rgba(37,99,235,.45)]';
  return (
    <a href={href}
       aria-current={active ? 'page' : undefined}
       className={[base, active ? activeCls : inactive].join(' ')}
       style={active ? { background: 'linear-gradient(135deg, var(--color-royal-600) 0%, var(--color-royal-500) 100%)' } : undefined}
    >
      {children}
    </a>
  );
}
