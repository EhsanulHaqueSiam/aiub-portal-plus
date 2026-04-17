import { extensionEnabled } from '@/utils/storage';
import { loadCSS } from '@/utils/portal';

declare global {
  interface Window {
    __aiubNavbarEnhanced?: boolean;
  }
}

export default defineContentScript({
  matches: ['https://portal.aiub.edu/Student*'],
  runAt: 'document_idle',

  async main() {
    if (!(await extensionEnabled.getValue())) return;
    if (window.__aiubNavbarEnhanced) return;
    window.__aiubNavbarEnhanced = true;

    const tryEnhance = () => {
      if (document.querySelector('.topbar-container')) {
        enhance();
      } else {
        setTimeout(tryEnhance, 150);
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
  loadCSS('navbar-style', 'Shared/Navbar.css');

  const path = window.location.pathname;
  document
    .querySelectorAll<HTMLAnchorElement>('.navbar-nav.hidden-md.hidden-sm.hidden-xs > li > a')
    .forEach((a) => {
      try {
        const href = new URL(a.href).pathname;
        if (path.startsWith(href) && href !== '/Student') {
          a.closest('li')?.classList.add('active');
        }
      } catch {
        /* ignore */
      }
    });
}
