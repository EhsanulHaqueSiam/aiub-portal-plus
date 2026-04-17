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
     populates .StudentCourseList via AJAX AFTER document_idle fires, so
     we can't rely on it being in the DOM when our script runs. Poll
     briefly, then observe for late mutations; on first success, the
     observer disconnects itself. */
  scheduleFlatten(mainContent);
}

function scheduleFlatten(mainContent: HTMLElement) {
  if (flattenCourseList(mainContent)) return;

  let tries = 0;
  const pollId = window.setInterval(() => {
    if (flattenCourseList(mainContent) || ++tries >= 25) {
      window.clearInterval(pollId);
      observer.disconnect();
    }
  }, 200);

  const observer = new MutationObserver(() => {
    if (flattenCourseList(mainContent)) {
      observer.disconnect();
      window.clearInterval(pollId);
    }
  });
  observer.observe(mainContent, { childList: true, subtree: true });
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
