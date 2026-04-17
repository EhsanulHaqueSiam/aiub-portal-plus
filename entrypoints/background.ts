import { extensionEnabled } from '@/utils/storage';

const OFFERED_URL = 'https://portal.aiub.edu/Student/Section/Offered';
const CURRICULUM_URL = 'https://portal.aiub.edu/Student/Curriculum';

export default defineBackground(() => {
  browser.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type === 'GET_ENABLED') {
      extensionEnabled.getValue().then((enabled) => sendResponse({ enabled }));
      return true;
    }

    if (message?.type === 'SET_ENABLED') {
      extensionEnabled.setValue(message.enabled).then(() => sendResponse({ success: true }));
      return true;
    }

    if (message?.type === 'RELOAD_TAB') {
      browser.tabs.query({ active: true, currentWindow: true }).then((tabs) => {
        if (tabs[0]?.id) browser.tabs.reload(tabs[0].id);
      });
    }

    // Open a sync tab and return its id immediately. The caller (a long-lived
    // extension page) watches storage.onChanged itself and tells us when to
    // close the tab — this avoids the MV3 service-worker idle kill that
    // shuts down the message port before a long `sendResponse` fires.
    if (message?.type === 'OPEN_SYNC_TAB') {
      const explicit = typeof message.url === 'string' ? message.url : null;
      let target: string;
      if (explicit && /^https:\/\/portal\.aiub\.edu\//.test(explicit)) {
        target = explicit;
      } else if (message.target === 'curriculum') {
        target = CURRICULUM_URL + '#aiub-plus-sync';
      } else if (message.target === 'gradeBySemester') {
        target = 'https://portal.aiub.edu/Student/GradeReport/BySemester';
      } else if (message.target === 'gradeByCurriculum') {
        target = 'https://portal.aiub.edu/Student/GradeReport/ByCurriculum';
      } else {
        target = OFFERED_URL;
      }
      browser.tabs
        .create({ url: target, active: false })
        .then((tab) => sendResponse({ ok: true, tabId: tab.id ?? null }))
        .catch((err: unknown) =>
          sendResponse({ ok: false, reason: err instanceof Error ? err.message : String(err) }),
        );
      return true;
    }

    if (message?.type === 'CLOSE_TAB') {
      const tabId = typeof message.tabId === 'number' ? message.tabId : null;
      if (tabId == null) {
        sendResponse({ ok: false, reason: 'No tabId provided.' });
        return true;
      }
      browser.tabs
        .remove(tabId)
        .then(() => sendResponse({ ok: true }))
        .catch(() => sendResponse({ ok: true })); // tab already gone — treat as success
      return true;
    }
  });
});
