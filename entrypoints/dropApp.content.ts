import { extensionEnabled } from '@/utils/storage';
import { escHtml, loadCSS, loadInlineStyle, parseHTML } from '@/utils/portal';

declare global {
  interface Window {
    __aiubDropEnhanced?: boolean;
  }
}

const AIUB_DROP_CSS = `
.portal-body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Inter', Roboto, sans-serif; }
.alert.alert-warning { display: none !important; }
.drop-header { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 10px; margin-bottom: 18px; padding-bottom: 14px; border-bottom: 2px solid #f1f5f9; }
.drop-header-title { font-size: 16px; font-weight: 700; color: #0f172a; margin: 0; padding: 0; }
.drop-header-title span { color: #dc2626; }
/* Refund panel — the portal ships the current refund % inside a warning
   alert that's hidden above. We surface it as a right-aligned info chip
   in the header with three states: good (>= 50%, green), partial (1-49,
   amber), none (0, red). The eligibility micro-copy explains what the
   % means so the student doesn't have to infer it from the hidden
   alert. */
.drop-refund-badge {
  display: inline-flex;
  align-items: center;
  gap: 12px;
  padding: 10px 16px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 600;
  background: #fef9c3;
  border: 1px solid #fde047;
  color: #854d0e;
  transition: background .15s, border-color .15s;
}
.drop-refund-badge.good { background: #ecfdf5; border-color: #a7f3d0; color: #065f46; }
.drop-refund-badge.partial { background: #fef9c3; border-color: #fde047; color: #854d0e; }
.drop-refund-badge.none { background: #fee2e2; border-color: #fecaca; color: #991b1b; }

.drop-refund-body { display: flex; flex-direction: column; gap: 2px; line-height: 1.1; }
.drop-refund-label { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: .6px; opacity: .75; }
.drop-refund-state { font-size: 11px; font-weight: 600; opacity: .85; }
.drop-refund-pct { font-size: 24px; font-weight: 800; line-height: 1; color: #dc2626; letter-spacing: -0.02em; font-variant-numeric: tabular-nums; }
.drop-refund-badge.good .drop-refund-pct { color: #059669; }
.drop-refund-badge.partial .drop-refund-pct { color: #b45309; }
.drop-refund-badge.none .drop-refund-pct { color: #dc2626; }

[data-target="#Rules"] .label.label-info { font-size: 12px !important; padding: 5px 16px !important; border-radius: 6px !important; background: #eff6ff !important; color: #1d4ed8 !important; border: 1px solid #bfdbfe !important; font-weight: 600 !important; cursor: pointer; letter-spacing: 0 !important; }

#Rules { margin-top: 10px; }
#Rules .table { border-collapse: collapse !important; border-radius: 8px; overflow: hidden; border: 1px solid #e2e8f0 !important; }
#Rules .table th { background: #f8fafc !important; font-size: 10px !important; text-transform: uppercase; letter-spacing: .6px; color: #64748b !important; font-weight: 700 !important; border-bottom: 1px solid #e2e8f0 !important; padding: 8px 14px !important; }
#Rules .table td { font-size: 12px !important; padding: 7px 14px !important; color: #475569 !important; border-color: #f1f5f9 !important; }
#Rules .table tr:last-child td { color: #94a3b8 !important; font-style: italic; }

[ng-controller="DropApplicationController2"] div[ng-show="ViewID==1"] > .table-bordered { border: none !important; background: transparent; }
[ng-controller="DropApplicationController2"] div[ng-show="ViewID==1"] > .table-bordered td { border: none !important; padding: 5px 8px !important; font-size: 13px !important; vertical-align: middle; }
[ng-controller="DropApplicationController2"] div[ng-show="ViewID==1"] > .table-bordered select { font-size: 12px !important; font-weight: 600 !important; color: #334155 !important; border: 1px solid #cbd5e1 !important; border-radius: 8px !important; padding: 5px 10px !important; background: #f8fafc !important; height: auto !important; }

[ng-controller="DropApplicationController2"] .btn.btn-info { font-size: 12px !important; font-weight: 600 !important; background: #eff6ff !important; color: #1d4ed8 !important; border: 1px solid #bfdbfe !important; border-radius: 7px !important; padding: 6px 16px !important; box-shadow: none !important; }

[ng-controller="DropApplicationController2"] [ng-repeat].ng-scope { background: #ffffff; border: 1px solid #e2e8f0; border-radius: 10px; margin-bottom: 10px !important; padding: 0 !important; overflow: hidden; transition: box-shadow .15s, border-color .15s; }
[ng-controller="DropApplicationController2"] [ng-repeat].ng-scope:hover { box-shadow: 0 2px 8px rgba(37,99,235,.07); border-color: #bfdbfe; }
[ng-controller="DropApplicationController2"] [ng-repeat].ng-scope > .row { margin: 0 !important; padding: 10px 14px !important; align-items: center; }

[ng-controller="DropApplicationController2"] [ng-repeat].ng-scope:has(.col-md-2 span.ng-binding:not(.ng-hide)) { border-color: #fca5a5 !important; background: #fff5f5 !important; }

[ng-controller="DropApplicationController2"] [ng-repeat] .col-md-1 > span[style*="steelblue"] { color: #1e3a8a !important; font-family: 'Consolas', 'Cascadia Code', monospace !important; font-size: 12px !important; font-weight: 700 !important; background: #eff6ff; padding: 2px 8px; border-radius: 5px; display: inline-block; }
[ng-controller="DropApplicationController2"] [ng-repeat].ng-scope:has(.col-md-2 span.ng-binding:not(.ng-hide)) .col-md-1 > span[style*="steelblue"] { background: #fee2e2 !important; color: #9ca3af !important; }

[ng-controller="DropApplicationController2"] [ng-repeat] .col-md-6 > span[style*="slateblue"] { color: #0f172a !important; font-size: 13px !important; font-weight: 600 !important; }
[ng-controller="DropApplicationController2"] [ng-repeat].ng-scope:has(.col-md-2 span.ng-binding:not(.ng-hide)) .col-md-6 > span[style*="slateblue"] { color: #9ca3af !important; text-decoration: line-through; }

[ng-controller="DropApplicationController2"] [ng-repeat] .col-md-6 small.ng-binding { display: inline-block; margin: 3px 5px 0 0; font-size: 11px !important; color: #475569 !important; background: #f1f5f9; padding: 1px 7px; border-radius: 4px; }
[ng-controller="DropApplicationController2"] [ng-repeat] .col-md-6 small:not(.ng-binding) { font-size: 11px !important; color: #94a3b8 !important; }
[ng-controller="DropApplicationController2"] [ng-repeat] .col-md-6 small.ng-scope b { color: #64748b; }

[ng-controller="DropApplicationController2"] [ng-repeat] .col-md-2 span.ng-binding:not(.ng-hide) { display: inline-flex !important; align-items: center !important; background: #fee2e2 !important; color: #dc2626 !important; font-size: 10px !important; font-weight: 700 !important; padding: 2px 8px !important; border-radius: 5px !important; }

[ng-controller="DropApplicationController2"] [ng-repeat] .col-md-1.ng-binding { font-size: 11px !important; color: #64748b !important; font-family: 'Consolas', 'Cascadia Code', monospace !important; }

[ng-controller="DropApplicationController2"] [ng-repeat] a.btn.btn-danger { font-size: 11px !important; font-weight: 600 !important; background: #fee2e2 !important; color: #dc2626 !important; border: 1px solid #fca5a5 !important; border-radius: 6px !important; padding: 4px 10px !important; box-shadow: none !important; transition: background .15s !important; }
[ng-controller="DropApplicationController2"] [ng-repeat] a.btn.btn-danger:hover { background: #fecaca !important; border-color: #f87171 !important; }

[ng-controller="DropApplicationController2"] [ng-repeat] .label.label-warning { background: #fef9c3 !important; color: #854d0e !important; border-radius: 5px !important; font-size: 10px !important; padding: 3px 8px !important; }

[ng-controller="DropApplicationController2"] table[ng-show="ViewID==1"] { border: none !important; margin-top: 6px !important; }
[ng-controller="DropApplicationController2"] table[ng-show="ViewID==1"] td { border: none !important; padding: 6px 10px !important; font-size: 12px !important; color: #64748b !important; background: #f8fafc; border-radius: 8px; }
[ng-controller="DropApplicationController2"] table[ng-show="ViewID==1"] .pull-right { font-weight: 600 !important; color: #334155 !important; }

[ng-controller="DropApplicationController2"] h5.text-center { font-size: 13px !important; font-weight: 700 !important; color: #0f172a !important; }
[ng-controller="DropApplicationController2"] .table-condensed th { font-size: 10px !important; text-transform: uppercase; letter-spacing: .5px; color: #64748b !important; background: #f8fafc !important; border-bottom: 1px solid #e2e8f0 !important; padding: 8px 10px !important; }
[ng-controller="DropApplicationController2"] .table-condensed td { font-size: 12px !important; padding: 7px 10px !important; color: #475569 !important; border-color: #f1f5f9 !important; }
`;

function insertHeader() {
  if (document.querySelector('.drop-header')) return;

  const alert = document.querySelector('.alert.alert-warning');
  let pct = '0%';
  if (alert) {
    const badge = alert.querySelector('.label-danger b') ?? alert.querySelector('.label-danger');
    if (badge?.textContent) pct = badge.textContent.trim();
  }

  const pctNum = parseFloat(pct);
  // Three tones, matching .drop-refund-badge.good/.partial/.none. 50% is
  // the conventional cut-off on AIUB's refund schedule between "mostly
  // recoverable" and "partial". The exact threshold is cosmetic — the
  // portal's own percentage is the source of truth for what's refunded.
  let tone: 'good' | 'partial' | 'none';
  let state: string;
  if (pctNum >= 50) {
    tone = 'good';
    state = 'Eligible';
  } else if (pctNum > 0) {
    tone = 'partial';
    state = 'Partial refund';
  } else {
    tone = 'none';
    state = 'No refund';
  }

  const target =
    document.querySelector('[ng-controller="DropApplicationController2"]') ??
    document.querySelector('.margin5');
  if (!target) return;

  const rulesRow = document.querySelector('.portal-body > .row');
  const insertBefore = rulesRow ?? target;

  const html = `<div class="drop-header">
      <h2 class="drop-header-title">Drop <span>Application</span></h2>
      <div class="drop-refund-badge ${tone}">
        <span class="drop-refund-pct">${escHtml(pct)}</span>
        <span class="drop-refund-body">
          <span class="drop-refund-label">Current Refund</span>
          <span class="drop-refund-state">${escHtml(state)}</span>
        </span>
      </div>
    </div>`;

  insertBefore.parentNode?.insertBefore(parseHTML(html), insertBefore);
}

export default defineContentScript({
  matches: ['https://portal.aiub.edu/Student/Adrop/DropApplication*'],
  runAt: 'document_idle',

  async main() {
    if (!(await extensionEnabled.getValue())) return;
    if (window.__aiubDropEnhanced) return;
    window.__aiubDropEnhanced = true;

    const init = () => {
      const courses = document.querySelectorAll(
        '[ng-controller="DropApplicationController2"] [ng-repeat].ng-scope',
      );
      if (!courses.length) {
        setTimeout(init, 300);
        return;
      }
      loadCSS('aiub-drop-external', 'Academic/DropApplication.css');
      loadInlineStyle('aiub-drop-css', AIUB_DROP_CSS);
      insertHeader();
    };

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', init);
    } else {
      init();
    }
  },
});
