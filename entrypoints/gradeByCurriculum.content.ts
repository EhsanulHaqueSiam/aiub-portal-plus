import { extensionEnabled } from '@/utils/storage';
import { escHtml, loadCSS, replaceChildrenHTML } from '@/utils/portal';

declare global {
  interface Window {
    __aiubGradeEnhanced?: boolean;
  }
}

const GRADE_BG: Record<string, string> = {
  'A+': '#059669', A: '#10b981',
  'B+': '#2563eb', B: '#3b82f6',
  'C+': '#d97706', C: '#f59e0b',
  'D+': '#dc2626', D: '#ef4444',
  F: '#7f1d1d', W: '#6b7280', '-': '#7c3aed',
};

const NIL_TOKENS = new Set(['', 'NIL', 'NILL', 'N/A', 'NA', '-']);

type CatalogItem = {
  course: string;
  course_name: string;
  credit?: string | number;
  prerequisite?: string;
  prerequisites?: string[];
};
type GradeEntry = { sem: string; grade: string };
type RowState = 'done' | 'ong' | 'wdn' | 'nd';
type Row = {
  code: string;
  name: string;
  credit: number;
  grades: GradeEntry[];
  prerequisite: string;
  state: RowState;
  locked?: boolean;
  missingPrerequisites?: string[];
  prerequisiteStatus?: string;
  needToComplete?: string;
};
type SemSection = { label: string; rows: Row[] };
type InfoItem = { k: string; v: string };

let courseCatalog: CatalogItem[] = [];
const metaByName = new Map<string, CatalogItem>();
const metaByCode = new Map<string, CatalogItem>();

const norm = (v: unknown) => String(v ?? '').replace(/\s+/g, ' ').trim().toUpperCase();
const normCode = (v: unknown) => norm(v).replace(/\s+/g, '');

function normalizePrereqText(raw: unknown): string {
  const s = String(raw ?? '').trim();
  if (!s || NIL_TOKENS.has(norm(s))) return 'Nil';
  return s;
}

function prerequisiteFromMeta(meta: CatalogItem | null): string {
  if (!meta) return 'Nil';
  if (Array.isArray(meta.prerequisites) && meta.prerequisites.length) {
    return meta.prerequisites.join(', ');
  }
  return normalizePrereqText(meta.prerequisite);
}

function splitPrerequisiteTokens(text: unknown): string[] {
  const raw = normalizePrereqText(text);
  if (raw === 'Nil') return [];
  if (/\bCREDITS?\b/i.test(raw)) return [raw];

  const dense = raw.replace(/\s+/g, ' ').trim();
  const codeMatches = dense.match(/[A-Z]{2,4}\s*[0-9#*]{4}/gi);

  if (codeMatches && codeMatches.length > 1) {
    return codeMatches.map((t) => t.replace(/\s+/g, ' ').trim());
  }

  return dense
    .split(/\s*(?:,|&|\bAND\b)\s*/i)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => s.replace(/\s+/g, ' '));
}

function prerequisiteListFromMeta(meta: CatalogItem | null): string[] {
  if (!meta) return [];
  if (Array.isArray(meta.prerequisites) && meta.prerequisites.length) {
    return meta.prerequisites.map((s) => String(s).trim()).filter(Boolean);
  }
  return splitPrerequisiteTokens(meta.prerequisite);
}

function buildCatalogIndex(items: CatalogItem[]) {
  items.forEach((item) => {
    const nameKey = norm(item.course_name);
    const codeKey = normCode(item.course);
    if (nameKey && !metaByName.has(nameKey)) metaByName.set(nameKey, item);
    if (codeKey && !metaByCode.has(codeKey)) metaByCode.set(codeKey, item);
  });
}

function loadCourseCatalog(): Promise<void> {
  return fetch(browser.runtime.getURL('/Academic/CSE.json'))
    .then((r) => (r.ok ? r.json() : []))
    .then((items: unknown) => {
      if (!Array.isArray(items)) return;
      courseCatalog = items as CatalogItem[];
      buildCatalogIndex(courseCatalog);
    })
    .catch(() => {
      courseCatalog = [];
    });
}

function findCourseMeta(code: string, name: string): CatalogItem | null {
  const byName = metaByName.get(norm(name));
  if (byName) return byName;

  const byCode = metaByCode.get(normCode(code));
  if (byCode) return byCode;

  if (courseCatalog.length) {
    const nameKey = norm(name);
    const fuzzy = courseCatalog.find((item) => {
      const n = norm(item.course_name);
      return n === nameKey || n.includes(nameKey) || nameKey.includes(n);
    });
    if (fuzzy) return fuzzy;
  }
  return null;
}

function findPrerequisite(code: string, name: string): string {
  return prerequisiteFromMeta(findCourseMeta(code, name));
}

function findPrerequisiteList(code: string, name: string): string[] {
  return prerequisiteListFromMeta(findCourseMeta(code, name));
}

function parseCreditValue(raw: unknown): number {
  const m = String(raw ?? '').match(/\d+(?:\.\d+)?/);
  return m ? parseFloat(m[0]) : 0;
}

function findCourseCredit(code: string, name: string): number {
  const meta = findCourseMeta(code, name);
  if (!meta) return 0;
  return parseCreditValue(meta.credit);
}

function isRequirementSatisfied(req: string, completedCodes: Set<string>): boolean {
  const normalized = normalizePrereqText(req);
  if (normalized === 'Nil') return true;
  if (/\bCREDITS?\b/i.test(normalized)) return false;
  return completedCodes.has(normCode(normalized));
}

function addLockInfoToNotAttempted(semSections: SemSection[], electiveRows: Row[]) {
  const allRows: Row[] = [];
  semSections.forEach((sec) => allRows.push(...sec.rows));
  allRows.push(...electiveRows);

  const completedCodes = new Set(
    allRows.filter((r) => r.state === 'done' || r.state === 'ong').map((r) => normCode(r.code)),
  );

  allRows.forEach((r) => {
    if (r.state !== 'nd') return;
    const reqList = findPrerequisiteList(r.code, r.name);
    const missing = reqList.filter((req) => !isRequirementSatisfied(req, completedCodes));
    r.locked = missing.length > 0;
    r.missingPrerequisites = missing;
    r.prerequisiteStatus = r.locked ? 'Locked' : 'Unlocked';
    r.needToComplete = r.locked ? missing.join(', ') : '-';
  });
}

function parseGrades(text: string): GradeEntry[] {
  const out: GradeEntry[] = [];
  const pattern = /\(([^)]+)\)\s*\[([^\]]*)\]/g;
  for (const match of text.matchAll(pattern)) {
    out.push({ sem: match[1].trim(), grade: match[2].trim() || '-' });
  }
  return out;
}

function getState(grades: GradeEntry[]): RowState {
  if (!grades.length) return 'nd';
  const last = grades[grades.length - 1].grade;
  if (last === '-') return 'ong';
  if (last === 'W') return 'wdn';
  return 'done';
}

function gradePill(grades: GradeEntry[]): string {
  if (!grades.length) return `<span class="cgr-gp-nd">—</span>`;
  const last = grades[grades.length - 1];
  const bg = GRADE_BG[last.grade] || '#90a4ae';
  const lbl = last.grade === '-' ? 'Ongoing' : last.grade;
  return `<span class="cgr-gp" style="color:${bg}">${escHtml(lbl)}</span>`;
}

function semLines(grades: GradeEntry[]): string {
  if (!grades.length) return `<span class="cgr-gp-nd">—</span>`;
  return grades.map((g) => `<div class="cgr-sem-ln">${escHtml(g.sem)}</div>`).join('');
}

function parseInfo(tbl: Element): InfoItem[] {
  const items: InfoItem[] = [];
  tbl.querySelectorAll('tr').forEach((tr) => {
    const tds = Array.from(tr.querySelectorAll('td'));
    if (tds[0] && tds[2]) items.push({ k: tds[0].textContent?.trim() ?? '', v: tds[2].textContent?.trim() ?? '' });
    if (tds[3] && tds[5]) items.push({ k: tds[3].textContent?.trim() ?? '', v: tds[5].textContent?.trim() ?? '' });
  });
  return items;
}

function normalizeInfoKey(v: string): string {
  return String(v).toLowerCase().replace(/[^a-z0-9]/g, '');
}

function getInfoValue(items: InfoItem[], keys: string[]): string {
  const wanted = new Set(keys.map(normalizeInfoKey));
  for (const item of items) {
    if (wanted.has(normalizeInfoKey(item.k))) return String(item.v ?? '').trim();
  }
  return '';
}

function extractNumber(text: string): number {
  const m = String(text ?? '').match(/-?\d+(?:\.\d+)?/);
  return m ? parseFloat(m[0]) : 0;
}

type GraphStore = Record<string, unknown> & { updatedAt?: string };

function saveGraphData(mutator: (store: GraphStore) => void) {
  if (!browser?.storage?.local) return;
  browser.storage.local.get({ aiubGraphData: {} }).then((res) => {
    const current = (res.aiubGraphData ?? {}) as GraphStore;
    const next: GraphStore = { ...current };
    mutator(next);
    next.updatedAt = new Date().toISOString();
    browser.storage.local.set({ aiubGraphData: next });
  });
}

function persistCurriculumGraphData(
  infoItems: InfoItem[],
  semSections: SemSection[],
  electiveRows: Row[],
) {
  const coreRows: Row[] = [];
  semSections.forEach((sec) => coreRows.push(...sec.rows));

  const sumCredit = (rows: Row[], pred: (r: Row) => boolean) =>
    rows.filter(pred).reduce((sum, r) => sum + parseCreditValue(r.credit), 0);

  const stateCredits = {
    completed: sumCredit(coreRows, (r) => r.state === 'done'),
    ongoing: sumCredit(coreRows, (r) => r.state === 'ong'),
    withdrawn: sumCredit(coreRows, (r) => r.state === 'wdn'),
    notAttempted: sumCredit(coreRows, (r) => r.state === 'nd'),
  };

  const stateCounts = {
    completed: coreRows.filter((r) => r.state === 'done').length,
    ongoing: coreRows.filter((r) => r.state === 'ong').length,
    withdrawn: coreRows.filter((r) => r.state === 'wdn').length,
    notAttempted: coreRows.filter((r) => r.state === 'nd').length,
  };

  const gradeDistribution: Record<string, number> = {};
  coreRows.forEach((r) => {
    const grade = r.grades.length ? r.grades[r.grades.length - 1].grade : '-';
    const key = !r.grades.length ? 'N/A' : grade === '-' ? 'Ongoing' : grade;
    gradeDistribution[key] = (gradeDistribution[key] ?? 0) + parseCreditValue(r.credit);
  });

  const notAttemptedRows = coreRows.filter((r) => r.state === 'nd');
  const locked = notAttemptedRows.filter((r) => r.locked);
  const unlocked = notAttemptedRows.filter((r) => !r.locked);

  const lockedCredits = locked.reduce((s, r) => s + parseCreditValue(r.credit), 0);
  const unlockedCredits = unlocked.reduce((s, r) => s + parseCreditValue(r.credit), 0);

  const semesterProgress = semSections.map((sec) => {
    const total = sec.rows.reduce((s, r) => s + parseCreditValue(r.credit), 0);
    const attempted = sec.rows
      .filter((r) => r.state !== 'nd')
      .reduce((s, r) => s + parseCreditValue(r.credit), 0);
    const completed = sec.rows
      .filter((r) => r.state === 'done')
      .reduce((s, r) => s + parseCreditValue(r.credit), 0);
    return { label: sec.label || 'Semester', total, attempted, completed };
  });

  // Per-course state snapshot for eligibility computation downstream
  // (Routine Generator reads this to know which courses you can take now).
  const courseStates = [...coreRows, ...electiveRows].map((r) => ({
    code: r.code,
    name: r.name,
    credit: r.credit,
    state: r.state,
    prerequisite: r.prerequisite,
    locked: r.locked ?? false,
    missingPrerequisites: r.missingPrerequisites ?? [],
  }));

  const payload = {
    studentName: getInfoValue(infoItems, ['Name', 'Student Name']),
    studentId: getInfoValue(infoItems, ['Id', 'Student Id']),
    program: getInfoValue(infoItems, ['Program', 'Department']),
    cgpa: extractNumber(getInfoValue(infoItems, ['Cgpa', 'CGPA'])),
    totalCredits: coreRows.reduce((s, r) => s + parseCreditValue(r.credit), 0),
    totalCourses: coreRows.length,
    coreCourseCodes: [...new Set(coreRows.map((r) => normCode(r.code)).filter(Boolean))],
    coreCourseNames: [...new Set(coreRows.map((r) => norm(r.name)).filter(Boolean))],
    electiveCreditsExcluded: electiveRows.reduce((s, r) => s + parseCreditValue(r.credit), 0),
    stateCredits,
    stateCounts,
    gradeDistribution,
    prerequisite: {
      lockedCredits,
      unlockedCredits,
      lockedCourses: locked.length,
      unlockedCourses: unlocked.length,
    },
    semesterProgress,
    courseStates,
    capturedAt: new Date().toISOString(),
  };

  saveGraphData((store) => {
    store.curriculum = payload;
  });
}

function getGraphPageUrl(): string {
  try {
    return browser.runtime.getURL('/graphs.html');
  } catch {
    return '';
  }
}

function infoHTML(items: InfoItem[], printHref: string | null): string {
  const cells = items
    .map(
      ({ k, v }) =>
        `<div class="cgr-info-cell">
          <div class="cgr-info-lbl">${escHtml(k)}</div>
          <div class="cgr-info-val${k === 'Cgpa' ? ' cgpa' : ''}">${escHtml(v) || '—'}</div>
        </div>`,
    )
    .join('');
  const safeHref = printHref && /^[/?#]/.test(printHref) ? printHref : '#';
  const graphHref = getGraphPageUrl();
  const actions: string[] = [];
  if (printHref) {
    actions.push(`<a class="cgr-action-link cgr-print" href="${escHtml(safeHref)}">&#128438; Print</a>`);
  }
  if (graphHref) {
    actions.push(`<a class="cgr-action-link cgr-graph" href="${escHtml(graphHref)}">&#128202; Graph</a>`);
  }

  return `
    <div class="cgr-top">
      <h2 class="cgr-title">Curriculum <span>Grade Report</span></h2>
      <div class="cgr-actions">${actions.join('')}</div>
    </div>
    <div class="cgr-info">${cells}</div>`;
}

function notAttemptedHTML(semSections: SemSection[], electiveRows: Row[]): string {
  type Tab = { label: string; rows: Row[] };
  const tabs: Tab[] = [];
  semSections.forEach((sec, i) => {
    const nd = sec.rows.filter((r) => r.state === 'nd');
    if (nd.length) tabs.push({ label: sec.label || `Semester ${i + 1}`, rows: nd });
  });
  const electiveNA = electiveRows.filter((r) => r.state === 'nd');
  if (electiveNA.length) tabs.push({ label: 'Elective', rows: electiveNA });

  if (!tabs.length) {
    return `<div class="cgr-na-section"><div class="cgr-na-all-done">&#10003; All courses have been attempted!</div></div>`;
  }

  const total = tabs.reduce((s, t) => s + t.rows.length, 0);
  const tabBtns = tabs
    .map(
      (t, i) =>
        `<button class="cgr-tab-btn${i === 0 ? ' active' : ''}" data-group="na" data-idx="${i}">
          ${escHtml(t.label)}<span class="cgr-tab-cnt">${t.rows.length}</span>
        </button>`,
    )
    .join('');

  const tabPanels = tabs
    .map((t, i) => {
      const rows = t.rows
        .map(
          (r) =>
            `<tr>
              <td class="cgr-code">${escHtml(r.code)}</td>
              <td class="cgr-cn">${escHtml(r.name)}</td>
              <td class="cgr-pr">${escHtml(r.prerequisite || 'Nil')}</td>
              <td class="tc">
                <span class="cgr-lock-badge ${r.locked ? 'is-locked' : 'is-unlocked'}">${escHtml(r.prerequisiteStatus ?? 'Unlocked')}</span>
              </td>
              <td class="cgr-need">${escHtml(r.needToComplete ?? '-')}</td>
            </tr>`,
        )
        .join('');
      return `
        <div class="cgr-tab-panel${i === 0 ? ' active' : ''}" data-group="na" data-idx="${i}">
          <div class="cgr-tbl-wrap">
            <table class="cgr-tbl">
              <thead><tr>
                <th style="width:12%">Code</th>
                <th>Course Name</th>
                <th style="width:22%">Prerequisite</th>
                <th class="tc" style="width:10%">Status</th>
                <th style="width:26%">Need To Complete</th>
              </tr></thead>
              <tbody>${rows}</tbody>
            </table>
          </div>
        </div>`;
    })
    .join('');

  return `
    <div class="cgr-na-section">
      <div class="cgr-sh">&#9203; Not Attempted Yet<span class="cgr-sh-badge">${total}</span></div>
      <div class="cgr-tabs-nav">${tabBtns}</div>
      <div>${tabPanels}</div>
    </div>`;
}

function sectionHeadHTML(label: string, type: 'core' | 'elective'): string {
  const cls = type === 'elective' ? ' el' : '';
  return `<div class="cgr-sh${cls}">${escHtml(label)}</div>`;
}

function semTableHTML(sec: SemSection): string {
  const rowsHTML = sec.rows
    .map(
      (r) =>
        `<tr class="cgr-${r.state}">
          <td class="cgr-code">${escHtml(r.code)}</td>
          <td class="cgr-cn">${escHtml(r.name)}</td>
          <td class="cgr-pr">${escHtml(r.prerequisite || 'Nil')}</td>
          <td>${semLines(r.grades)}</td>
          <td class="tc">${gradePill(r.grades)}</td>
        </tr>`,
    )
    .join('');
  return `
    <div class="cgr-sl">${escHtml(sec.label)}</div>
    <div class="cgr-tbl-wrap">
      <table class="cgr-tbl">
        <thead><tr>
          <th style="width:11%">Code</th>
          <th>Course</th>
          <th style="width:25%">Prerequisite</th>
          <th style="width:23%">Semester Taken</th>
          <th class="tc" style="width:8%">Grade</th>
        </tr></thead>
        <tbody>${rowsHTML}</tbody>
      </table>
    </div>`;
}

function electiveTableHTML(rows: Row[]): string {
  const rowsHTML = rows
    .map(
      (r) =>
        `<tr class="cgr-${r.state}">
          <td class="cgr-code">${escHtml(r.code)}</td>
          <td class="cgr-cn">${escHtml(r.name)}</td>
          <td class="cgr-pr">${escHtml(r.prerequisite || 'Nil')}</td>
          <td>${semLines(r.grades)}</td>
          <td class="tc">${gradePill(r.grades)}</td>
        </tr>`,
    )
    .join('');
  return `
    <div class="cgr-tbl-wrap">
      <table class="cgr-tbl">
        <thead><tr>
          <th style="width:11%">Code</th>
          <th>Course</th>
          <th style="width:25%">Prerequisite</th>
          <th style="width:23%">Semester Taken</th>
          <th class="tc" style="width:8%">Grade</th>
        </tr></thead>
        <tbody>${rowsHTML}</tbody>
      </table>
    </div>`;
}

function legendHTML(): string {
  return `
    <div class="cgr-legend">
      <span><span class="cgr-legend-dot" style="background:#2563eb"></span>Ongoing</span>
      <span><span class="cgr-legend-dot" style="background:#059669"></span>Completed</span>
      <span><span class="cgr-legend-dot" style="background:#dc2626"></span>Withdrawn</span>
      <span><span class="cgr-legend-dot" style="background:#cbd5e1"></span>Not Attempted</span>
    </div>`;
}

function initTabs(container: HTMLElement) {
  container.querySelectorAll<HTMLButtonElement>('.cgr-tab-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const group = btn.dataset.group;
      const idx = btn.dataset.idx;
      if (!group) return;
      container
        .querySelectorAll(`.cgr-tab-btn[data-group="${group}"]`)
        .forEach((b) => b.classList.remove('active'));
      container
        .querySelectorAll(`.cgr-tab-panel[data-group="${group}"]`)
        .forEach((p) => p.classList.remove('active'));
      btn.classList.add('active');
      const panel = container.querySelector(
        `.cgr-tab-panel[data-group="${group}"][data-idx="${idx}"]`,
      );
      panel?.classList.add('active');
    });
  });
}

function enhance() {
  const gr = document.querySelector<HTMLElement>('.grade-report');
  if (!gr) return;

  gr.closest('.panel')?.classList.add('cgr-root-panel');

  const printLink = document.querySelector<HTMLAnchorElement>('a[href*="PrintGradeReport"]');
  const printHref = printLink?.getAttribute('href') ?? null;

  let infoItems: InfoItem[] | null = null;
  let inElective = false;
  let semLabel: string | null = null;
  const semSections: SemSection[] = [];
  const electiveRows: Row[] = [];

  for (const el of Array.from(gr.children)) {
    const tag = el.tagName;
    if (tag === 'TABLE' && !infoItems) {
      infoItems = parseInfo(el);
    } else if (tag === 'DIV' && el.classList.contains('text-center')) {
      if ((el.textContent ?? '').toLowerCase().includes('elective')) inElective = true;
    } else if (tag === 'LABEL') {
      semLabel = el.textContent?.trim() ?? null;
    } else if (tag === 'TABLE' && infoItems) {
      const rows = Array.from(el.querySelectorAll('tbody tr'))
        .slice(1)
        .map((tr): Row | null => {
          const tds = Array.from(tr.querySelectorAll('td'));
          if (tds.length < 3) return null;
          const code = tds[0].textContent?.trim() ?? '';
          const name = tds[1].textContent?.trim() ?? '';
          const grades = parseGrades(tds[2].textContent ?? '');
          return {
            code,
            name,
            credit: findCourseCredit(code, name),
            grades,
            prerequisite: findPrerequisite(code, name),
            state: getState(grades),
          };
        })
        .filter((r): r is Row => r !== null);

      if (inElective) {
        electiveRows.push(...rows);
      } else {
        semSections.push({ label: semLabel ?? '', rows });
        semLabel = null;
      }
    }
  }

  addLockInfoToNotAttempted(semSections, electiveRows);
  persistCurriculumGraphData(infoItems ?? [], semSections, electiveRows);

  let html = '';
  html += infoHTML(infoItems ?? [], printHref);
  html += notAttemptedHTML(semSections, electiveRows);
  html += sectionHeadHTML('Core Curriculum', 'core');
  semSections.forEach((sec) => {
    html += semTableHTML(sec);
  });
  if (electiveRows.length) {
    html += sectionHeadHTML('Elective Curriculum', 'elective');
    html += electiveTableHTML(electiveRows);
  }
  html += legendHTML();

  replaceChildrenHTML(gr, html);
  initTabs(gr);
}

export default defineContentScript({
  matches: ['https://portal.aiub.edu/Student/GradeReport/ByCurriculum*'],
  runAt: 'document_idle',

  async main() {
    if (!(await extensionEnabled.getValue())) return;
    if (window.__aiubGradeEnhanced) return;
    window.__aiubGradeEnhanced = true;

    loadCSS('cgr-style', 'Grade/carriculum_grade_report.css');

    const init = () => {
      if (!document.querySelector('.grade-report')) {
        setTimeout(init, 400);
        return;
      }
      loadCourseCatalog().finally(enhance);
    };

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', init);
    } else {
      init();
    }
  },
});
