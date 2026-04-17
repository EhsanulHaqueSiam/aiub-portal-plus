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
        panel.parentElement?.insertBefore(head, panel);
      }
    }
  });
}
