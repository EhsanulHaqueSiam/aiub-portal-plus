import { extensionEnabled } from '@/utils/storage';
import type { Highlights, HighlightColor } from '@/lib/offered';
import { HIGHLIGHT_COLORS } from '@/lib/offered';

// Highlights class IDs the user pinned in the Routine Generator, so when
// they come to register they can spot their sections at a glance. Works
// on /Student/Section/Offered (pagination-heavy) and /Student/Registration
// (the picker inside an open registration window).
//
// v1.4.14: cell-only highlighting (the class-ID <td>, not the whole row)
// with a 5-color palette so the user can pin 2–N routines simultaneously
// and tell them apart. Legacy {classIds: [...]} storage still works and
// renders as a single amber group.

declare global {
  interface Window {
    __aiubHighlightInjected?: boolean;
  }
}

const PALETTE: Record<HighlightColor, { cellBg: string; cellFg: string; shadow: string }> = {
  amber:   { cellBg: '#fbbf24', cellFg: '#78350f', shadow: 'rgba(217, 119, 6, 0.35)' },
  royal:   { cellBg: '#60a5fa', cellFg: '#0a1838', shadow: 'rgba(29, 78, 216, 0.35)' },
  emerald: { cellBg: '#34d399', cellFg: '#064e3b', shadow: 'rgba(5, 150, 105, 0.35)' },
  rose:    { cellBg: '#fb7185', cellFg: '#881337', shadow: 'rgba(190, 24, 93, 0.35)' },
  violet:  { cellBg: '#a78bfa', cellFg: '#2e1065', shadow: 'rgba(109, 40, 217, 0.35)' },
};

const CELL_COMMON = `font-weight: 800 !important; border-radius: 4px; padding: 2px 6px !important;`;

function buildHighlightCSS(): string {
  const cellRules = HIGHLIGHT_COLORS.map((key) => {
    const p = PALETTE[key];
    return `.aiub-hl-cell-${key} {
  background: ${p.cellBg} !important;
  color: ${p.cellFg} !important;
  ${CELL_COMMON}
  box-shadow: 0 1px 3px ${p.shadow};
}`;
  }).join('\n');

  return `${cellRules}

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
  max-width: min(560px, calc(100vw - 36px));
}
#aiub-hl-pill.is-off { background: #374151; color: #d1d5db; }
#aiub-hl-pill .aiub-hl-star { font-size: 15px; }
#aiub-hl-pill .aiub-hl-swatches { display: inline-flex; gap: 4px; }
#aiub-hl-pill .aiub-hl-swatches > span {
  width: 10px; height: 10px; border-radius: 999px;
  border: 1px solid rgba(255,255,255,0.25);
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
}

function injectStyle() {
  if (document.getElementById('aiub-hl-style')) return;
  const style = document.createElement('style');
  style.id = 'aiub-hl-style';
  style.textContent = buildHighlightCSS();
  document.head.appendChild(style);
}

type NormalizedState = {
  enabled: boolean;
  colorByClassId: Map<string, HighlightColor>;
  activeColors: HighlightColor[];
  total: number;
};

let state: NormalizedState = { enabled: true, colorByClassId: new Map(), activeColors: [], total: 0 };
let refreshScheduled = false;

function scheduleRefresh() {
  if (refreshScheduled) return;
  refreshScheduled = true;
  requestAnimationFrame(() => {
    refreshScheduled = false;
    applyHighlights();
  });
}

const CELL_CLASS_NAMES = HIGHLIGHT_COLORS.map((k) => `aiub-hl-cell-${k}`);

function applyHighlights() {
  // Wipe any previous cell marks before re-applying.
  for (const cls of CELL_CLASS_NAMES) {
    document.querySelectorAll('.' + cls).forEach((el) => el.classList.remove(cls));
  }
  renderPill();
  if (!state.enabled || state.colorByClassId.size === 0) return;

  // Walk every table row and mark the first numeric-ID cell that matches
  // a pinned class ID. Covers Offered (table.footable) and Registration.
  document.querySelectorAll<HTMLTableRowElement>('table tr').forEach((tr) => {
    const cells = tr.querySelectorAll<HTMLTableCellElement>('td');
    for (const cell of Array.from(cells)) {
      const text = (cell.textContent ?? '').trim();
      if (!text || !/^\d{4,}$/.test(text)) continue;
      const color = state.colorByClassId.get(text);
      if (color) {
        cell.classList.add(`aiub-hl-cell-${color}`);
        break;
      }
    }
  });
}

function renderPill() {
  let pill = document.getElementById('aiub-hl-pill');
  if (state.colorByClassId.size === 0) {
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
    const swatches = document.createElement('span');
    swatches.className = 'aiub-hl-swatches';
    labelWrap.appendChild(swatches);
    pill.appendChild(labelWrap);

    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'aiub-hl-toggle';
    toggle.textContent = 'On';
    toggle.addEventListener('click', async () => {
      const current = await browser.storage.local.get({ aiubHighlights: null });
      const prev = (current.aiubHighlights as Highlights | null) ?? null;
      const nextEnabled = !state.enabled;
      browser.storage.local.set({
        aiubHighlights: { ...(prev ?? {}), enabled: nextEnabled, updatedAt: new Date().toISOString() },
      });
    });
    pill.appendChild(toggle);

    const clear = document.createElement('button');
    clear.type = 'button';
    clear.textContent = 'Clear';
    clear.addEventListener('click', () => {
      browser.storage.local.set({
        aiubHighlights: { groups: [], classIds: [], enabled: true, updatedAt: new Date().toISOString() },
      });
    });
    pill.appendChild(clear);

    document.body.appendChild(pill);
  }

  const labelTop = pill.querySelector<HTMLSpanElement>('#aiub-hl-label');
  const swatches = pill.querySelector<HTMLSpanElement>('.aiub-hl-swatches');
  const toggle = pill.querySelector<HTMLButtonElement>('.aiub-hl-toggle');
  if (labelTop) {
    if (!state.enabled) {
      labelTop.textContent = 'Highlight paused';
    } else {
      const pins = state.activeColors.length;
      labelTop.textContent = `Highlighting ${state.total} class ID${state.total !== 1 ? 's' : ''} · ${pins} pinned routine${pins === 1 ? '' : 's'}`;
    }
  }
  if (swatches) {
    swatches.replaceChildren();
    for (const c of state.activeColors) {
      const dot = document.createElement('span');
      dot.style.background = PALETTE[c].cellBg;
      swatches.appendChild(dot);
    }
  }
  if (toggle) {
    toggle.textContent = state.enabled ? 'On' : 'Off';
    toggle.classList.toggle('is-on', state.enabled);
  }
  pill.classList.toggle('is-off', !state.enabled);
}

function normalizeHighlights(raw: unknown): NormalizedState {
  const h = (raw as Highlights | null) ?? null;
  const enabled = h?.enabled !== false;
  const colorByClassId = new Map<string, HighlightColor>();
  const activeColors: HighlightColor[] = [];

  if (h && Array.isArray(h.groups) && h.groups.length > 0) {
    for (const g of h.groups) {
      if (!g || !Array.isArray(g.classIds)) continue;
      const color: HighlightColor = (HIGHLIGHT_COLORS as string[]).includes(g.color)
        ? (g.color as HighlightColor)
        : 'amber';
      if (!activeColors.includes(color)) activeColors.push(color);
      for (const id of g.classIds) {
        const s = String(id).trim();
        if (s && !colorByClassId.has(s)) colorByClassId.set(s, color);
      }
    }
  } else if (h && Array.isArray(h.classIds) && h.classIds.length > 0) {
    // Legacy shape — treat as a single amber group.
    activeColors.push('amber');
    for (const id of h.classIds) {
      const s = String(id).trim();
      if (s && !colorByClassId.has(s)) colorByClassId.set(s, 'amber');
    }
  }

  return { enabled, colorByClassId, activeColors, total: colorByClassId.size };
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
    state = normalizeHighlights(res.aiubHighlights);
    applyHighlights();

    browser.storage.onChanged.addListener((changes, area) => {
      if (area !== 'local' || !changes.aiubHighlights) return;
      state = normalizeHighlights(changes.aiubHighlights.newValue);
      applyHighlights();
    });

    // The Offered page uses footable pagination + an in-page filter script
    // that rewrites rows. Re-apply on DOM mutations (debounced via rAF).
    const obs = new MutationObserver(scheduleRefresh);
    obs.observe(document.body, { childList: true, subtree: true });
  },
});
