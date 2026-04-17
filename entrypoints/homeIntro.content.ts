import { extensionEnabled, teamsCredsDismissed } from '@/utils/storage';
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

  enhanceTeamsCredentials(mainContent);
}

/**
 * The portal's Teams one-time-password card is high-value on the first
 * login of a semester and noise on every visit after. Let students collapse
 * it. A small "Show Teams password" link stays rendered in place so the
 * info is never lost — just hidden by default once dismissed. State is
 * persisted in local storage so returning visitors don't see it again.
 */
function enhanceTeamsCredentials(mainContent: HTMLElement) {
  const alert = Array.from(
    mainContent.querySelectorAll<HTMLElement>('.alert-success'),
  ).find((el) => el.querySelector('.table-bordered'));
  if (!alert) return;

  alert.classList.add('intro-teams-card');

  const dismiss = document.createElement('button');
  dismiss.type = 'button';
  dismiss.className = 'intro-teams-dismiss';
  dismiss.setAttribute('aria-label', 'Hide Teams credentials');
  dismiss.title = 'Hide Teams credentials';
  dismiss.textContent = '\u00D7';
  alert.appendChild(dismiss);

  const reopen = document.createElement('button');
  reopen.type = 'button';
  reopen.className = 'intro-teams-reopen';
  reopen.textContent = 'Show Teams password';
  alert.insertAdjacentElement('afterend', reopen);

  teamsCredsDismissed.getValue().then((hidden) => {
    if (hidden) {
      alert.classList.add('is-dismissed');
      reopen.classList.add('is-visible');
    }
  });

  dismiss.addEventListener('click', () => {
    alert.classList.add('is-dismissed');
    reopen.classList.add('is-visible');
    teamsCredsDismissed.setValue(true);
  });

  reopen.addEventListener('click', () => {
    alert.classList.remove('is-dismissed');
    reopen.classList.remove('is-visible');
    teamsCredsDismissed.setValue(false);
  });
}
