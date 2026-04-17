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

  /* Flatten the registered-course list into a clean grid parent. AIUB
     renders its own Bootstrap .row > .col-md-* scaffolding (plus the
     occasional empty placeholder col / whitespace / clearfix pseudo),
     which fights CSS Grid and leaves holes — typically the top-left
     slot. Scan for every col that actually holds a course card, wipe
     the list, and re-append only those. No phantom children possible. */
  flattenCourseList(mainContent);
}

function flattenCourseList(mainContent: HTMLElement) {
  /* Don't reuse .StudentCourseList as the grid parent — it carries
     whatever CSS AIUB attached (pseudo-elements, inherited padding from
     .panel-body, its own tag semantics). Build a brand-new wrapper with
     a known-good class, move only the card-bearing cols into it, and
     replace the old list with it. Nothing else can sneak in. */
  const list = mainContent.querySelector<HTMLElement>('.StudentCourseList');
  if (!list || list.dataset.reghomeFlattened === '1') return;

  const cardCols = Array.from(
    list.querySelectorAll<HTMLElement>('[class*="col-"]'),
  ).filter((col) => col.querySelector('.panel.panel-primary'));

  if (cardCols.length === 0) return;

  const grid = document.createElement('div');
  /* Deliberately do NOT carry the .StudentCourseList class over — AIUB
     attaches its own CSS (including a ::before pseudo-element that
     generates a phantom grid cell) to that class. A brand-new class
     means no inherited AIUB rules. */
  grid.className = 'reghome-card-grid';
  grid.dataset.reghomeFlattened = '1';
  cardCols.forEach((c) => grid.appendChild(c));

  list.replaceWith(grid);
}
