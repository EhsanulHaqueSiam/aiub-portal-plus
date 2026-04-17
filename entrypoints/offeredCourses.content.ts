import { extensionEnabled } from '@/utils/storage';
import { loadCSS } from '@/utils/portal';

declare global {
  interface Window {
    __aiubOfferedInjected?: boolean;
  }
}

export default defineContentScript({
  matches: ['https://portal.aiub.edu/Student/Section/Offered*'],
  runAt: 'document_idle',

  async main() {
    if (!(await extensionEnabled.getValue())) return;
    if (window.__aiubOfferedInjected) return;
    window.__aiubOfferedInjected = true;

    loadCSS('offered-filter-style', 'offered-filter.css');

    const script = document.createElement('script');
    script.src = browser.runtime.getURL('/offered-filter.js');
    script.async = false;
    (document.head || document.documentElement).appendChild(script);
    script.addEventListener('load', () => script.remove());
  },
});
