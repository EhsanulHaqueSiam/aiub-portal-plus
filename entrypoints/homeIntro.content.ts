import { extensionEnabled } from '@/utils/storage';
import { loadCSS } from '@/utils/portal';

declare global {
  interface Window {
    __aiubIntroEnhanced?: boolean;
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
    if (window.__aiubIntroEnhanced) return;
    window.__aiubIntroEnhanced = true;

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

  loadCSS('intro-style', 'Home/Intro.css');

  // Portal surfaces a red "Go to Registration" button on the home page only
  // during an active registration window (~6/year). We persist that signal
  // so the Routine Generator can warn the user: during registration, seat
  // counts and section statuses change minute-to-minute, so cached offered
  // data gets stale fast.
  const regBtn = mainContent.querySelector<HTMLAnchorElement | HTMLButtonElement>(
    '.text-center .btn-danger',
  );
  const isRegOpen = !!regBtn && /regist/i.test(regBtn.textContent ?? '');
  browser.storage.local.set({
    aiubRegistrationStatus: {
      active: isRegOpen,
      buttonText: regBtn?.textContent?.trim() ?? '',
      detectedAt: new Date().toISOString(),
    },
  });

  if (regBtn) {
    const panel = regBtn.closest('.panel');
    panel?.classList.add('intro-actions');
  }
}
