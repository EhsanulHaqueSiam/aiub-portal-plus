import { extensionEnabled } from '@/utils/storage';
import { escHtml, loadCSS, loadInlineStyle, parseHTML } from '@/utils/portal';

declare global {
  interface Window {
    __aiubCurriculumEnhanced?: boolean;
  }
}

type CatalogItem = {
  course: string;
  course_name: string;
  prerequisite?: string;
  prerequisites?: string[];
};

const NIL_TOKENS = new Set(['', 'NIL', 'NILL', 'N/A', 'NA', '-']);
let courseCatalog: CatalogItem[] = [];
const courseByCode = new Map<string, CatalogItem[]>();
const courseByCodeAndName = new Map<string, CatalogItem>();

const norm = (v: unknown) => String(v ?? '').replace(/\s+/g, ' ').trim().toUpperCase();
const normCode = (v: unknown) => norm(v).replace(/\s+/g, '');

// The portal's curriculum modal tables don't use <thead>; the header row lives
// inside <tbody> as a <tr> with <th> cells. Locate whichever row carries the
// headers so downstream code can index by column name.
function findHeaderRow(table: HTMLTableElement): HTMLTableRowElement | null {
  const theadRow = table.querySelector<HTMLTableRowElement>('thead tr');
  if (theadRow && theadRow.querySelector('th, td')) return theadRow;
  for (const row of Array.from(table.querySelectorAll<HTMLTableRowElement>('tr'))) {
    if (row.querySelector('th')) return row;
  }
  return null;
}

function getHeaderCells(row: HTMLTableRowElement): HTMLTableCellElement[] {
  return Array.from(row.querySelectorAll<HTMLTableCellElement>('th, td'));
}

function isHeaderRow(row: HTMLTableRowElement): boolean {
  return !!row.querySelector('th');
}

function buildCatalogIndex(items: CatalogItem[]) {
  items.forEach((item) => {
    const codeKey = normCode(item.course);
    const nameKey = norm(item.course_name);
    if (!courseByCode.has(codeKey)) courseByCode.set(codeKey, []);
    courseByCode.get(codeKey)!.push(item);
    courseByCodeAndName.set(`${codeKey}::${nameKey}`, item);
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
  const codeKey = normCode(code);
  const nameKey = norm(name);
  const exact = courseByCodeAndName.get(`${codeKey}::${nameKey}`);
  if (exact) return exact;

  const byCode = courseByCode.get(codeKey) ?? [];
  if (byCode.length === 1) return byCode[0];
  if (byCode.length > 1) {
    const contains = byCode.find((item) => {
      const itemName = norm(item.course_name);
      return itemName === nameKey || itemName.includes(nameKey) || nameKey.includes(itemName);
    });
    return contains ?? byCode[0];
  }

  const fallback = courseCatalog.find((item) => norm(item.course_name) === nameKey);
  return fallback ?? null;
}

function formatPrerequisite(meta: CatalogItem | null): string {
  if (!meta) return 'Nil';
  if (Array.isArray(meta.prerequisites) && meta.prerequisites.length > 0) {
    return meta.prerequisites.join(', ');
  }
  const raw = String(meta.prerequisite ?? '').trim();
  if (!raw || NIL_TOKENS.has(norm(raw))) return 'Nil';
  return raw;
}

function enhanceCurriculumTable(table: HTMLTableElement) {
  if (table.dataset.curPrereqEnhanced === '1') return;

  const headerRow = findHeaderRow(table);
  if (!headerRow) return;

  const headerCells = getHeaderCells(headerRow);
  const headerTexts = headerCells.map((th) => norm(th.textContent));
  const hasCode = headerTexts.some((t) => t.includes('CODE'));
  const hasCourse = headerTexts.some((t) => t.includes('COURSE') || t.includes('NAME'));
  const hasCredit = headerTexts.some((t) => t.includes('CREDIT'));
  if (!hasCode || !hasCourse || !hasCredit) return;

  const existingPrereqIdx = headerTexts.findIndex(
    (t) => t.includes('PREREQ') || t.includes('PRE-REQ') || t.includes('PRE REQ'),
  );

  let prereqIdx = existingPrereqIdx;
  if (prereqIdx === -1) {
    const th = document.createElement('th');
    th.textContent = 'Prerequisite';
    th.style.width = '22%';
    headerRow.appendChild(th);
    prereqIdx = headerCells.length; // new column at the end
  }

  const dataRows = Array.from(table.querySelectorAll<HTMLTableRowElement>('tr')).filter(
    (tr) => tr !== headerRow && !isHeaderRow(tr),
  );
  dataRows.forEach((tr) => {
    const cells = Array.from(tr.querySelectorAll<HTMLTableCellElement>('td'));
    if (!cells.length) return;

    const rowText = norm(tr.textContent);
    if (rowText.includes('TOTAL CREDIT') || rowText.includes('GRAND TOTAL')) return;
    if (cells.length < 3) return;

    const code = cells[0].textContent?.trim() ?? '';
    const courseName = cells[1].textContent?.trim() ?? '';
    if (!code || !courseName) return;

    const meta = findCourseMeta(code, courseName);
    // Respect existing prerequisite cell (portal shows bullets); fall back to catalog lookup.
    let existingPrereq = '';
    if (existingPrereqIdx !== -1 && cells[existingPrereqIdx]) {
      const cell = cells[existingPrereqIdx];
      const lis = cell.querySelectorAll('li');
      existingPrereq = lis.length
        ? Array.from(lis).map((li) => li.textContent?.trim() ?? '').filter(Boolean).join(', ')
        : cell.textContent?.trim() ?? '';
    }

    if (existingPrereqIdx === -1) {
      // We added the column — populate the new cell at the end.
      const prereqText = meta
        ? formatPrerequisite(meta)
        : 'Nil';
      while (cells.length <= prereqIdx) {
        const td = document.createElement('td');
        tr.appendChild(td);
        cells.push(td);
      }
      cells[prereqIdx].textContent = prereqText;
    } else if (!existingPrereq || NIL_TOKENS.has(norm(existingPrereq))) {
      // Keep the portal's cell intact, but overlay our catalog data in place
      // only when the portal cell is empty/Nil so we don't nuke the bullets.
      const prereqText = meta ? formatPrerequisite(meta) : 'Nil';
      if (prereqText !== 'Nil') cells[existingPrereqIdx].textContent = prereqText;
    }
  });

  table.dataset.curPrereqEnhanced = '1';
}

const CUR_CSS = `
.cur-root-panel > .panel-heading { display: none !important; }
.cur-root-panel { box-shadow: none !important; border: none !important; background: transparent !important; }
.cur-root-panel > .panel-body { background: transparent !important; padding: 8px 0 !important; }
.cur-root-panel .panel-body > h4 { display: none !important; }

.cur-page-header { margin-bottom: 20px; padding: 16px 20px; background: linear-gradient(135deg, #f0f9ff 0%, #faf5ff 100%); border-radius: 14px; border: 1.5px solid #e0e7ff; }
.cur-faculty { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #6366f1; margin-bottom: 6px; }
.cur-degree { font-size: 19px; font-weight: 800; color: #111827; letter-spacing: -0.4px; }

.cur-card { border: none !important; border-radius: 14px !important; overflow: hidden; margin-bottom: 16px; box-shadow: 0 2px 10px rgba(0,0,0,0.06) !important; }
.cur-card > .panel-body { padding: 0 !important; background: transparent !important; }
.cur-card > .panel-heading { padding: 14px 18px !important; border-bottom: none !important; display: flex !important; align-items: center !important; gap: 10px !important; }
.cur-card > .panel-heading b { font-size: 14px; font-weight: 700; flex: 1; }

.cur-card-core { background: #f0f9ff !important; }
.cur-card-core > .panel-heading { background: linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%) !important; }
.cur-card-core > .panel-heading b { color: #1e3a8a !important; }
.cur-card-core .cur-type-badge { background: #1d4ed8; color: #fff; }
.cur-card-core .cur-show-btn { background: linear-gradient(135deg, #2563eb, #1d4ed8) !important; color: #fff !important; }
.cur-card-core .cur-show-btn:hover { filter: brightness(1.1) !important; }

.cur-card-elective { background: #faf5ff !important; }
.cur-card-elective > .panel-heading { background: linear-gradient(135deg, #ede9fe 0%, #c4b5fd 100%) !important; }
.cur-card-elective > .panel-heading b { color: #4c1d95 !important; }
.cur-card-elective .cur-type-badge { background: #7c3aed; color: #fff; }
.cur-card-elective .cur-show-btn { background: linear-gradient(135deg, #7c3aed, #6d28d9) !important; color: #fff !important; }
.cur-card-elective .cur-show-btn:hover { filter: brightness(1.1) !important; }

.cur-type-badge { display: inline-block; padding: 3px 10px; border-radius: 20px; font-size: 10px; font-weight: 700; letter-spacing: 0.5px; text-transform: uppercase; flex-shrink: 0; }

.cur-card .curriculum-info { background: transparent !important; border: none !important; margin: 0 !important; }
.cur-card .curriculum-info tr { background: transparent !important; }
.cur-card .curriculum-info td { border: none !important; border-bottom: 1px solid rgba(0,0,0,0.05) !important; padding: 8px 18px !important; font-size: 13px; }
.cur-card .curriculum-info td:first-child { color: #6b7280; font-size: 12px; width: 42% !important; }
.cur-card .curriculum-info td:last-child { color: #111827; font-weight: 500; }
.cur-card .curriculum-info tr:last-child td { border-bottom: none !important; padding: 12px 18px !important; }
.cur-card table.table-bordered { border: none !important; }
.cur-card table.table-bordered td { border-left: none !important; border-right: none !important; }
.cur-card table.table-bordered tr:first-child td { border-top: none !important; }

.cur-show-btn { display: inline-flex !important; align-items: center !important; gap: 6px !important; padding: 8px 18px !important; border-radius: 8px !important; font-size: 13px !important; font-weight: 600 !important; border: none !important; cursor: pointer !important; box-shadow: 0 2px 6px rgba(0,0,0,0.15) !important; transition: filter 0.15s, transform 0.1s !important; }
.cur-show-btn:hover { transform: translateY(-1px) !important; }

.cur-modal-dialog { max-width: 820px !important; width: 92vw !important; margin: 30px auto !important; }
.cur-modal-content { border-radius: 14px !important; border: none !important; box-shadow: 0 24px 60px rgba(0,0,0,0.18) !important; overflow: hidden; }
.cur-modal-body { padding: 0 !important; }
#divCurriculumCourses { height: auto !important; max-height: 72vh; overflow-y: auto; padding: 0; }

.cur-modal-inner { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 13px; }
.cur-modal-inner h3, .cur-modal-inner h4, .cur-modal-inner h5 { margin: 0 !important; padding: 10px 20px !important; font-size: 13px !important; font-weight: 700 !important; background: linear-gradient(135deg, #dbeafe, #eff6ff) !important; color: #1e3a8a !important; border-bottom: 1px solid #bfdbfe !important; border-top: 1px solid #bfdbfe !important; }
.cur-modal-inner h3:first-child, .cur-modal-inner h4:first-child { border-top: none !important; }
.cur-modal-inner p { padding: 6px 20px; color: #6b7280; font-style: italic; font-size: 12px; }
.cur-modal-table { width: 100% !important; border-collapse: collapse !important; margin: 0 !important; }
.cur-modal-table thead th { background: #f8fafc !important; color: #475569 !important; font-size: 11px !important; font-weight: 700 !important; text-transform: uppercase !important; letter-spacing: 0.5px !important; padding: 9px 16px !important; border: none !important; border-bottom: 2px solid #e2e8f0 !important; }
.cur-modal-table tbody td { padding: 8px 16px !important; border: none !important; border-bottom: 1px solid #f1f5f9 !important; color: #374151 !important; font-size: 13px !important; }
.cur-modal-table tbody tr:hover td { background: #f0f9ff !important; }
.cur-modal-table tbody tr:last-child td { border-bottom: none !important; }
.cur-modal-table .label { font-size: 11px; font-weight: 700; padding: 2px 8px; border-radius: 4px; }
`;

function getType(card: Element): string {
  for (const tr of card.querySelectorAll('.curriculum-info tr')) {
    const cells = tr.querySelectorAll('td');
    if (cells.length >= 2 && /Curriculum Type/i.test(cells[0].textContent ?? '')) {
      return cells[1].textContent?.trim() ?? '';
    }
  }
  return '';
}

function injectPageHeader(panelBody: HTMLElement) {
  const h4s = Array.from(panelBody.querySelectorAll<HTMLElement>(':scope > h4'));
  if (!h4s.length) return;
  const faculty = h4s[0]?.textContent?.trim() ?? '';
  const degree = h4s[1]?.textContent?.trim() ?? '';
  const html = `<div class="cur-page-header">${
    faculty ? `<div class="cur-faculty">${escHtml(faculty)}</div>` : ''
  }${degree ? `<div class="cur-degree">${escHtml(degree)}</div>` : ''}</div>`;
  panelBody.insertBefore(parseHTML(html), h4s[0]);
}

function styleModalContent(div: HTMLElement) {
  const text = div.textContent?.trim() ?? '';
  if (!text || text === 'Loading...') return;
  div.querySelectorAll<HTMLTableElement>('table').forEach((t) => {
    enhanceCurriculumTable(t);
    t.classList.add('cur-modal-table');
    t.style.border = 'none';
  });

  persistCurriculumCourses(div);

  if (div.querySelector('.cur-modal-inner')) return;

  const wrapper = document.createElement('div');
  wrapper.className = 'cur-modal-inner';
  while (div.firstChild) wrapper.appendChild(div.firstChild);
  div.appendChild(wrapper);
}

type CurriculumRow = {
  code: string;
  name: string;
  credit: string;
  prerequisite: string;
  prerequisites: string[];
  type: 'Core' | 'Elective';
};

function inferCurriculumType(): 'Core' | 'Elective' {
  const modal = document.getElementById('curriculumCoursesModal');
  const title = modal?.querySelector('.modal-header')?.textContent?.toLowerCase() ?? '';
  if (title.includes('elective')) return 'Elective';
  return 'Core';
}

function extractPrereqTokens(text: string): string[] {
  const raw = String(text ?? '').trim();
  if (!raw || NIL_TOKENS.has(norm(raw))) return [];
  if (/\bCREDITS?\b/i.test(raw)) return [raw.replace(/\s+/g, ' ').trim()];
  const codeMatches = raw.match(/[A-Z]{2,4}\s*[0-9#*]{4}/gi);
  if (codeMatches && codeMatches.length) {
    return codeMatches.map((t) => t.replace(/\s+/g, ' ').trim());
  }
  return raw
    .split(/\s*(?:,|&|\bAND\b)\s*/i)
    .map((s) => s.trim())
    .filter(Boolean);
}

function persistCurriculumCourses(container: HTMLElement) {
  const rows: CurriculumRow[] = [];
  const type = inferCurriculumType();

  container.querySelectorAll<HTMLTableElement>('table').forEach((tbl) => {
    const headerRow = findHeaderRow(tbl);
    if (!headerRow) return;
    const headers = getHeaderCells(headerRow).map((th) => norm(th.textContent));

    const codeIdx   = headers.findIndex((t) => t.includes('CODE'));
    const nameIdx   = headers.findIndex((t) => t.includes('COURSE') || t.includes('NAME'));
    const creditIdx = headers.findIndex((t) => t.includes('CREDIT'));
    const prereqIdx = headers.findIndex(
      (t) => t.includes('PREREQ') || t.includes('PRE-REQ') || t.includes('PRE REQ'),
    );
    if (codeIdx === -1 || nameIdx === -1) return;

    const dataRows = Array.from(tbl.querySelectorAll<HTMLTableRowElement>('tr')).filter(
      (tr) => tr !== headerRow && !isHeaderRow(tr),
    );
    dataRows.forEach((tr) => {
      const cells = Array.from(tr.querySelectorAll<HTMLTableCellElement>('td'));
      if (cells.length < 2) return;
      const rowText = norm(tr.textContent);
      if (rowText.includes('TOTAL CREDIT') || rowText.includes('GRAND TOTAL')) return;

      const code = cells[codeIdx]?.textContent?.trim() ?? '';
      const name = cells[nameIdx]?.textContent?.trim() ?? '';
      if (!code || !name) return;

      const creditText = creditIdx !== -1 ? cells[creditIdx]?.textContent?.trim() ?? '' : '';

      let prereqText = '';
      let prerequisites: string[] = [];
      if (prereqIdx !== -1 && cells[prereqIdx]) {
        const cell = cells[prereqIdx];
        const lis = cell.querySelectorAll('li');
        if (lis.length) {
          prerequisites = Array.from(lis)
            .map((li) => li.textContent?.trim() ?? '')
            .filter((s) => s && !NIL_TOKENS.has(norm(s)));
          prereqText = prerequisites.join(', ');
        } else {
          prereqText = cell.textContent?.trim() ?? '';
          prerequisites = extractPrereqTokens(prereqText);
        }
      }

      rows.push({
        code,
        name,
        credit: creditText,
        prerequisite: prereqText,
        prerequisites,
        type,
      });
    });
  });

  if (!rows.length) return;

  browser.storage.local.get({ aiubCurriculum: null }).then((res) => {
    const prev = (res.aiubCurriculum as { courses?: CurriculumRow[] } | null) ?? null;
    const byCode = new Map<string, CurriculumRow>();
    (prev?.courses ?? []).forEach((c) => byCode.set(normCode(c.code), c));
    rows.forEach((c) => byCode.set(normCode(c.code), c));
    const merged = Array.from(byCode.values());
    browser.storage.local.set({
      aiubCurriculum: {
        courses: merged,
        capturedAt: new Date().toISOString(),
      },
    });
  });
}

function styleModal() {
  const modal = document.getElementById('curriculumCoursesModal');
  if (!modal) return;
  modal.querySelector('.modal-dialog')?.classList.add('cur-modal-dialog');
  modal.querySelector('.modal-content')?.classList.add('cur-modal-content');
  modal.querySelector('.modal-body')?.classList.add('cur-modal-body');
}

function enhance() {
  const mainPanel = document.querySelector<HTMLElement>('#main-content .panel.panel-default');
  if (!mainPanel) return;
  mainPanel.classList.add('cur-root-panel');

  const panelBody = mainPanel.querySelector<HTMLElement>('.panel-body');
  if (!panelBody) return;

  injectPageHeader(panelBody);

  panelBody.querySelectorAll<HTMLElement>(':scope > .panel.panel-default').forEach((card) => {
    card.classList.add('cur-card');
    const type = getType(card);
    card.classList.add(type === 'Elective' ? 'cur-card-elective' : 'cur-card-core');

    const heading = card.querySelector<HTMLElement>(':scope > .panel-heading');
    if (heading && !heading.querySelector('.cur-type-badge')) {
      const badge = document.createElement('span');
      badge.className = 'cur-type-badge';
      badge.textContent = type || 'Core';
      heading.appendChild(badge);
    }

    card.querySelector('.btnShowCurriculumCourses')?.classList.add('cur-show-btn');
  });

  styleModal();

  const divCourses = document.getElementById('divCurriculumCourses');
  if (divCourses) {
    const obs = new MutationObserver(() => styleModalContent(divCourses));
    obs.observe(divCourses, { childList: true });
  }
}

export default defineContentScript({
  matches: ['https://portal.aiub.edu/Student/Curriculum*'],
  runAt: 'document_idle',

  async main() {
    if (!(await extensionEnabled.getValue())) return;
    if (window.__aiubCurriculumEnhanced) return;
    window.__aiubCurriculumEnhanced = true;

    const init = () => {
      loadCSS('cur-external', 'Academic/MkCurriculumn.css');
      loadInlineStyle('cur-style', CUR_CSS);
      loadCourseCatalog().finally(() => {
        if (document.querySelector('#main-content .panel.panel-default')) {
          enhance();
        } else {
          const obs = new MutationObserver(() => {
            if (document.querySelector('#main-content .panel.panel-default')) {
              obs.disconnect();
              enhance();
            }
          });
          obs.observe(document.body, { childList: true, subtree: true });
        }
      });
    };

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', init);
    } else {
      init();
    }

    // Auto-sync: clicking "Sync now" in the Routine Generator opens this
    // page with #aiub-plus-sync. The portal's own router normalizes the hash
    // to `#/aiub-plus-sync`, so match either form and also watch hashchange
    // in case the rewrite happens after we load.
    const isSyncHash = () => /^#\/?aiub-plus-sync\/?$/.test(window.location.hash);
    let autoSyncFired = false;
    const maybeRunAutoSync = () => {
      if (autoSyncFired || !isSyncHash()) return;
      autoSyncFired = true;
      runAutoSync().catch(() => {});
    };
    maybeRunAutoSync();
    window.addEventListener('hashchange', maybeRunAutoSync);
  },
});

async function runAutoSync() {
  const waitFor = <T extends Element>(sel: string, timeout = 8000): Promise<T | null> =>
    new Promise((resolve) => {
      const existing = document.querySelector<T>(sel);
      if (existing) return resolve(existing);
      const obs = new MutationObserver(() => {
        const el = document.querySelector<T>(sel);
        if (el) {
          obs.disconnect();
          resolve(el);
        }
      });
      obs.observe(document.body, { childList: true, subtree: true });
      setTimeout(() => {
        obs.disconnect();
        resolve(document.querySelector<T>(sel));
      }, timeout);
    });

  const waitForModalContent = (timeout = 8000): Promise<boolean> =>
    new Promise((resolve) => {
      const div = document.getElementById('divCurriculumCourses');
      if (!div) return resolve(false);
      const ready = () => {
        const txt = (div.textContent ?? '').trim();
        return txt && txt !== 'Loading...' && div.querySelector('table');
      };
      if (ready()) return resolve(true);
      const obs = new MutationObserver(() => {
        if (ready()) { obs.disconnect(); resolve(true); }
      });
      obs.observe(div, { childList: true, subtree: true, characterData: true });
      setTimeout(() => { obs.disconnect(); resolve(!!ready()); }, timeout);
    });

  const clearModalBody = () => {
    const div = document.getElementById('divCurriculumCourses');
    if (div) div.textContent = 'Loading...';
  };

  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

  await waitFor<HTMLElement>('.btnShowCurriculumCourses');
  const buttons = Array.from(
    document.querySelectorAll<HTMLButtonElement>('.btnShowCurriculumCourses'),
  );
  for (const btn of buttons) {
    clearModalBody();
    btn.click();
    await waitForModalContent();
    await sleep(300); // let persist write settle
  }

  // Signal Routine Generator that auto-sync finished.
  try {
    await browser.storage.local.set({
      aiubCurriculumSyncDone: { at: new Date().toISOString() },
    });
  } catch { /* ignore */ }
}
