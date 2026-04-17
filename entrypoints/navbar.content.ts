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

    // Tokens must be loaded on every Student/* page, not only where the
    // sidebar exists. Pages like Drop Application skip the sidebar entirely,
    // and without tokens the navbar's `var(--p-grad-ink)` resolves to the
    // initial value — turning the bar into white-on-white text. Tokens are
    // purely CSS variables, so they're safe to load even on pages where the
    // navbar DOM isn't present (e.g. the login form rendered at /Student).
    loadCSS('aiub-tokens', 'Shared/tokens.css');

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
  // Navbar.css restyles body (padding-top, mesh background). Load it only
  // when the topbar DOM is actually present so the login form rendered at
  // /Student (no topbar) doesn't inherit a 60px top gap or the mesh surface.
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
