import { extensionEnabled } from '@/utils/storage';

// Highlights class IDs the user chose in the Routine Generator, so when
// they go to the portal to actually register they can spot their sections
// at a glance. Works on /Student/Section/Offered (pagination-heavy) and
// /Student/Registration (the picker inside an open registration window).

type Highlights = {
  classIds: string[];
  courseTitles?: string[];
  enabled: boolean;
  updatedAt?: string;
};

declare global {
  interface Window {
    __aiubHighlightInjected?: boolean;
  }
}

const HIGHLIGHT_CSS = `
.aiub-hl-row {
  background: linear-gradient(90deg, #fef3c7 0%, #fde68a 100%) !important;
  box-shadow: inset 3px 0 0 #d97706;
}
.aiub-hl-cell {
  background: #fbbf24 !important;
  color: #78350f !important;
  font-weight: 800 !important;
  border-radius: 4px;
  padding: 2px 6px !important;
  box-shadow: 0 1px 3px rgba(217, 119, 6, 0.35);
}

#aiub-hl-pill {
  position: fixed;
  right: 18px;
  bottom: 18px;
  z-index: 99998;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  border-radius: 999px;
  background: #111827;
  color: #fef3c7;
  font: 600 13px/1.2 -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  box-shadow: 0 10px 30px rgba(17, 24, 39, 0.35);
  user-select: none;
  max-width: min(520px, calc(100vw - 36px));
}
#aiub-hl-pill.is-off { background: #374151; color: #d1d5db; }
#aiub-hl-pill.is-off .aiub-hl-ids { text-decoration: line-through; opacity: 0.7; }
#aiub-hl-pill .aiub-hl-star { font-size: 15px; }
#aiub-hl-pill .aiub-hl-ids {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-weight: 700;
  color: #fde68a;
  letter-spacing: 0.2px;
  max-width: 260px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
#aiub-hl-pill button {
  appearance: none;
  border: 1px solid rgba(255,255,255,0.18);
  background: rgba(255,255,255,0.06);
  color: inherit;
  padding: 4px 10px;
  border-radius: 999px;
  font: inherit;
  cursor: pointer;
  transition: background 0.15s;
}
#aiub-hl-pill button:hover { background: rgba(255,255,255,0.14); }
#aiub-hl-pill .aiub-hl-toggle.is-on { background: #fbbf24; color: #78350f; border-color: transparent; }
`;

function injectStyle() {
  if (document.getElementById('aiub-hl-style')) return;
  const style = document.createElement('style');
  style.id = 'aiub-hl-style';
  style.textContent = HIGHLIGHT_CSS;
  document.head.appendChild(style);
}

let state: Highlights = { classIds: [], enabled: true };
let classIdSet = new Set<string>();
let refreshScheduled = false;

function scheduleRefresh() {
  if (refreshScheduled) return;
  refreshScheduled = true;
  requestAnimationFrame(() => {
    refreshScheduled = false;
    applyHighlights();
  });
}

function applyHighlights() {
  // Wipe previous marks before re-applying — handles pagination + filter changes.
  document.querySelectorAll('.aiub-hl-row').forEach((el) => el.classList.remove('aiub-hl-row'));
  document.querySelectorAll('.aiub-hl-cell').forEach((el) => el.classList.remove('aiub-hl-cell'));
  renderPill();
  if (!state.enabled || classIdSet.size === 0) return;

  // Walk every row; mark the first cell that matches a stored class ID.
  // Covers both Offered (table.footable) and Registration tables.
  document.querySelectorAll<HTMLTableRowElement>('table tr').forEach((tr) => {
    const cells = tr.querySelectorAll<HTMLTableCellElement>('td');
    for (const cell of Array.from(cells)) {
      const text = (cell.textContent ?? '').trim();
      if (!text || !/^\d{4,}$/.test(text)) continue;
      if (classIdSet.has(text)) {
        tr.classList.add('aiub-hl-row');
        cell.classList.add('aiub-hl-cell');
        break;
      }
    }
  });
}

function renderPill() {
  let pill = document.getElementById('aiub-hl-pill');
  if (classIdSet.size === 0) {
    pill?.remove();
    return;
  }
  if (!pill) {
    pill = document.createElement('div');
    pill.id = 'aiub-hl-pill';

    const star = document.createElement('span');
    star.className = 'aiub-hl-star';
    star.textContent = '\u{1F3AF}';
    pill.appendChild(star);

    const labelWrap = document.createElement('div');
    labelWrap.style.display = 'flex';
    labelWrap.style.flexDirection = 'column';
    labelWrap.style.lineHeight = '1.25';
    const labelTop = document.createElement('span');
    labelTop.id = 'aiub-hl-label';
    labelWrap.appendChild(labelTop);
    const labelIds = document.createElement('span');
    labelIds.className = 'aiub-hl-ids';
    labelWrap.appendChild(labelIds);
    pill.appendChild(labelWrap);

    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'aiub-hl-toggle';
    toggle.textContent = 'On';
    toggle.addEventListener('click', () => {
      state.enabled = !state.enabled;
      browser.storage.local.set({ aiubHighlights: { ...state, updatedAt: new Date().toISOString() } });
      applyHighlights();
    });
    pill.appendChild(toggle);

    const clear = document.createElement('button');
    clear.type = 'button';
    clear.textContent = 'Clear';
    clear.addEventListener('click', () => {
      state = { classIds: [], enabled: true };
      classIdSet = new Set();
      browser.storage.local.set({ aiubHighlights: { ...state, updatedAt: new Date().toISOString() } });
      applyHighlights();
    });
    pill.appendChild(clear);

    document.body.appendChild(pill);
  }

  const labelTop = pill.querySelector<HTMLSpanElement>('#aiub-hl-label');
  const labelIds = pill.querySelector<HTMLSpanElement>('.aiub-hl-ids');
  const toggle = pill.querySelector<HTMLButtonElement>('.aiub-hl-toggle');
  if (labelTop) {
    labelTop.textContent = state.enabled
      ? `Highlighting ${classIdSet.size} section${classIdSet.size !== 1 ? 's' : ''}`
      : `Highlight paused`;
  }
  if (labelIds) labelIds.textContent = state.classIds.join(' · ');
  if (toggle) {
    toggle.textContent = state.enabled ? 'On' : 'Off';
    toggle.classList.toggle('is-on', state.enabled);
  }
  pill.classList.toggle('is-off', !state.enabled);
}

function setStateFromStorage(next: unknown) {
  const incoming = (next as Highlights | null) ?? { classIds: [], enabled: true };
  state = {
    classIds: Array.isArray(incoming.classIds) ? incoming.classIds.map(String) : [],
    courseTitles: Array.isArray(incoming.courseTitles) ? incoming.courseTitles.map(String) : [],
    enabled: incoming.enabled !== false,
    updatedAt: incoming.updatedAt,
  };
  classIdSet = new Set(state.classIds);
}

export default defineContentScript({
  matches: [
    'https://portal.aiub.edu/Student/Section/Offered*',
    'https://portal.aiub.edu/Student/Registration*',
  ],
  runAt: 'document_idle',

  async main() {
    if (!(await extensionEnabled.getValue())) return;
    if (window.__aiubHighlightInjected) return;
    window.__aiubHighlightInjected = true;

    injectStyle();

    const res = await browser.storage.local.get({ aiubHighlights: null });
    setStateFromStorage(res.aiubHighlights);
    applyHighlights();

    browser.storage.onChanged.addListener((changes, area) => {
      if (area !== 'local' || !changes.aiubHighlights) return;
      setStateFromStorage(changes.aiubHighlights.newValue);
      applyHighlights();
    });

    // The Offered page uses footable pagination + an in-page filter script
    // that rewrites rows. Re-apply on DOM mutations (debounced via rAF).
    const obs = new MutationObserver(scheduleRefresh);
    obs.observe(document.body, { childList: true, subtree: true });
  },
});
