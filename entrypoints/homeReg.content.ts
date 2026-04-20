import { extensionEnabled } from '@/utils/storage';
import { loadCSS } from '@/utils/portal';

declare global {
  interface Window {
    __aiubRegHomeEnhanced?: boolean;
  }
}

export default defineContentScript({
  matches: [
    'https://portal.aiub.edu/Student',
    'https://portal.aiub.edu/Student/',
    'https://portal.aiub.edu/Student/Home/*',
  ],
  runAt: 'document_idle',

  async main() {
    if (!(await extensionEnabled.getValue())) return;
    if (window.__aiubRegHomeEnhanced) return;
    window.__aiubRegHomeEnhanced = true;

    const tryEnhance = () => {
      if (document.getElementById('main-content')) {
        enhance();
      } else {
        setTimeout(tryEnhance, 200);
      }
    };

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', tryEnhance);
    } else {
      tryEnhance();
    }
  },
});

function enhance() {
  const mainContent = document.getElementById('main-content');
  if (!mainContent) return;

  loadCSS('reghome-style', 'Home/Registration.css');

  mainContent.querySelectorAll<HTMLElement>('.panel-heading .panel-title').forEach((title) => {
    if (title.textContent?.trim() === 'Registration') {
      const panel = title.closest<HTMLElement>('.panel');
      if (panel) {
        panel.classList.add('reghome-reg-panel');
        const head = document.createElement('div');
        head.className = 'reghome-section-head';
        head.appendChild(document.createTextNode('Course '));
        const span = document.createElement('span');
        span.textContent = 'Registration';
        head.appendChild(span);

        const dropdown = panel.querySelector<HTMLSelectElement>('#SemesterDropDown');
        if (dropdown) {
          dropdown.classList.add('reghome-term-select');
          head.appendChild(dropdown);
        }

        panel.parentElement?.insertBefore(head, panel);
      }
    }
  });

  /* Flatten the registered-course list into a clean grid parent. Two
     async moments matter:
     1. The initial AJAX load — AIUB populates .StudentCourseList AFTER
        document_idle fires, so the first call here may find nothing.
     2. Semester-dropdown changes — AIUB re-fetches the list and swaps
        it in, wiping out our previous grid. We need to re-flatten.
     A persistent MutationObserver handles both: it stays alive for the
     page's lifetime and re-attempts flattening on every mutation.
     flattenCourseList early-returns when the grid already exists, so
     the observer is cheap at steady state. */
  scheduleFlatten(mainContent);
}

/**
 * Tag any card in the registered-course grid that carries a `.label-danger`
 * as dropped, so the card shell itself can fade + strike-through the code.
 * Also publish aggregate counts into the section-head so the student can
 * see total / active / dropped at a glance without scanning the grid.
 */
function annotateCards(mainContent: HTMLElement): void {
  const grid = mainContent.querySelector<HTMLElement>('.reghome-card-grid');
  if (!grid) return;

  const cards = grid.querySelectorAll<HTMLElement>('.panel.panel-primary');
  let total = 0;
  let dropped = 0;

  cards.forEach((card) => {
    total += 1;
    const isDropped = !!card.querySelector('.label-danger');
    card.classList.toggle('reghome-card-dropped', isDropped);
    if (isDropped) dropped += 1;
    decorateResult(card);
  });

  const active = total - dropped;
  const head = mainContent.querySelector<HTMLElement>('.reghome-section-head');
  if (!head) return;

  let counts = head.querySelector<HTMLElement>('.reghome-counts');
  if (!counts) {
    counts = document.createElement('div');
    counts.className = 'reghome-counts';
    // Insert before the term-select so the chips sit inline with the
    // title and the dropdown keeps its right-edge anchor (margin-left:
    // auto on .reghome-term-select pulls it all the way right).
    const termSelect = head.querySelector('.reghome-term-select');
    if (termSelect) head.insertBefore(counts, termSelect);
    else head.appendChild(counts);
  }

  // Drop-chip is suppressed when the count is zero — a "0 Dropped" chip
  // implies an event that hasn't happened and makes the header noisier
  // for the 95%+ of students with a clean semester.
  const chips: Array<[string, string, number]> = [
    ['total', 'Total', total],
    ['active', 'Active', active],
    ['dropped', 'Dropped', dropped],
  ];
  counts.replaceChildren();
  for (const [key, label, n] of chips) {
    if (key === 'dropped' && n === 0) continue;
    const chip = document.createElement('span');
    chip.className = `reghome-count reghome-count-${key}`;
    const num = document.createElement('span');
    num.className = 'reghome-count-n';
    num.textContent = String(n);
    const lbl = document.createElement('span');
    lbl.className = 'reghome-count-lbl';
    lbl.textContent = label;
    chip.appendChild(num);
    chip.appendChild(lbl);
    counts.appendChild(chip);
  }
}

function scheduleFlatten(mainContent: HTMLElement) {
  flattenCourseList(mainContent);
  annotateCards(mainContent);
  new MutationObserver(() => {
    flattenCourseList(mainContent);
    annotateCards(mainContent);
  }).observe(mainContent, { childList: true, subtree: true });
}

function flattenCourseList(mainContent: HTMLElement): boolean {
  /* Don't reuse .StudentCourseList as the grid parent — it carries
     whatever CSS AIUB attached (pseudo-elements, inherited padding from
     .panel-body, its own tag semantics). Build a brand-new wrapper with
     a known-good class, move only the card-bearing cols into it, and
     replace the old list with it. Nothing else can sneak in. */
  if (document.querySelector('.reghome-card-grid')) return true;

  const list = mainContent.querySelector<HTMLElement>('.StudentCourseList');
  if (!list || list.dataset.reghomeFlattened === '1') return false;

  const cardCols = Array.from(
    list.querySelectorAll<HTMLElement>('[class*="col-"]'),
  ).filter((col) => col.querySelector('.panel.panel-primary'));

  if (cardCols.length === 0) return false;

  const grid = document.createElement('div');
  /* Deliberately do NOT carry the .StudentCourseList class over — AIUB
     attaches its own CSS (including a ::before pseudo-element that
     generates a phantom grid cell) to that class. A brand-new class
     means no inherited AIUB rules. */
  grid.className = 'reghome-card-grid';
  grid.dataset.reghomeFlattened = '1';
  cardCols.forEach((c) => grid.appendChild(c));

  list.replaceWith(grid);
  return true;
}

/**
 * Extract the "Result: X" line the portal renders inside each registered
 * course card's panel-body and lift the grade into a color-coded pill.
 * Before: raw text "Result: B+" sitting inline. After: a compact pill
 * with tone mapped to the grade so the student can scan a whole grid
 * and spot failures/withdrawals instantly.
 *
 * The portal's grade slot on Home renders only for past semesters; for
 * the current semester the slot is '-' (mapped to Ongoing, muted tone).
 */
function decorateResult(card: HTMLElement): void {
  if (card.querySelector('.reghome-result')) return;

  const body = card.querySelector<HTMLElement>('.panel-body');
  if (!body) return;

  let labelNode: Text | null = null;
  let grade: string | null = null;
  for (const node of Array.from(body.childNodes)) {
    if (node.nodeType !== Node.TEXT_NODE) continue;
    const text = (node.textContent ?? '').trim();
    const m = /^Result\s*:\s*(.+)$/i.exec(text);
    if (m) {
      labelNode = node as Text;
      grade = m[1].trim();
      break;
    }
  }
  if (!labelNode || !grade) return;

  const g = grade.toUpperCase();
  let tone: 'ok' | 'warn' | 'err' | 'muted';
  if (g === '-' || g === 'NA' || g === 'N/A' || g === '') tone = 'muted';
  else if (g === 'F') tone = 'err';
  else if (g === 'W' || g === 'UW') tone = 'warn';
  else tone = 'ok';

  const pill = document.createElement('span');
  pill.className = `reghome-result reghome-result-${tone}`;
  const lbl = document.createElement('span');
  lbl.className = 'reghome-result-lbl';
  lbl.textContent = 'Result';
  const val = document.createElement('span');
  val.className = 'reghome-result-val';
  val.textContent = tone === 'muted' ? 'Ongoing' : grade;
  pill.appendChild(lbl);
  pill.appendChild(val);
  labelNode.replaceWith(pill);
}
