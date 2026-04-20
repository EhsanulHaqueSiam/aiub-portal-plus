import { extensionEnabled } from '@/utils/storage';
import { loadCSS, beforeHTML, escHtml, titleCase } from '@/utils/portal';

declare global {
  interface Window {
    __aiubProfileEnhanced?: boolean;
  }
}

export default defineContentScript({
  matches: ['https://portal.aiub.edu/Student/Home/Profile*'],
  runAt: 'document_idle',

  async main() {
    if (!(await extensionEnabled.getValue())) return;
    if (window.__aiubProfileEnhanced) return;
    window.__aiubProfileEnhanced = true;

    const tryEnhance = () => {
      // Wait for the fieldset — the portal renders the legend + the data
      // table inside a single <fieldset>, so if it's present the
      // identity rows we reshape are already in the DOM.
      if (document.querySelector('#main-content fieldset')) {
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

  loadCSS('profile-style', 'Home/Profile.css');

  mainContent.classList.add('profile-enhanced');
  mainContent.closest('.panel')?.classList.add('profile-root-panel');

  const fieldset = mainContent.querySelector<HTMLFieldSetElement>('fieldset');
  if (!fieldset) return;

  // ---------------------------------------------------------------------
  // Pull identity from the portal's table so the banner can repeat the
  // most-wanted values (name + ID) without the student having to scan the
  // table. The raw <td> pairs are label/value — whitespace in labels is
  // inconsistent, so we lowercase + trim before matching.
  // ---------------------------------------------------------------------
  const rows = Array.from(
    fieldset.querySelectorAll<HTMLTableRowElement>('table tr'),
  );
  const fields: Record<string, string> = {};
  for (const row of rows) {
    const tds = row.querySelectorAll<HTMLTableCellElement>('td');
    if (tds.length < 2) continue;
    const label = (tds[0].textContent ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
    const value = (tds[tds.length - 1].textContent ?? '').trim();
    if (!label || !value) continue;
    fields[label] = value;
  }

  const rawName = fields['name'] ?? fields['full name'] ?? '';
  const displayName = rawName ? titleCase(rawName) : 'Student Profile';
  const studentId = fields['student id'] ?? fields['id'] ?? fields['id no'] ?? '';
  const program = fields['program'] ?? fields['programme'] ?? '';

  // Identify the two layout columns the portal ships (Bootstrap). The
  // left column holds the table + optional intro; the right holds the
  // student photo.
  const leftCol = fieldset.querySelector<HTMLElement>('.col-md-8');
  const rightCol = fieldset.querySelector<HTMLElement>('.col-md-4');

  if (leftCol) {
    const table = leftCol.querySelector<HTMLTableElement>('table.table');
    if (table && !table.closest('.profile-table-card')) {
      const card = document.createElement('div');
      card.className = 'profile-table-card';
      table.parentNode?.insertBefore(card, table);
      card.appendChild(table);
    }
  }

  if (rightCol) {
    const img = rightCol.querySelector<HTMLImageElement>('img');
    if (img && !img.closest('.profile-photo-card')) {
      const card = document.createElement('div');
      card.className = 'profile-photo-card';
      img.parentNode?.insertBefore(card, img);
      card.appendChild(img);
    }
  }

  // Banner above the row — navy gradient, editorial italic, ID in mono.
  // Insert before the .row so it spans the full content width rather
  // than nesting inside the 8/4 split.
  const row = fieldset.querySelector<HTMLElement>('.row');
  if (row && !fieldset.querySelector('.profile-banner')) {
    const metaParts: string[] = [];
    if (studentId) {
      metaParts.push(`<span class="profile-banner-id">${escHtml(studentId)}</span>`);
    }
    if (program) {
      metaParts.push(`<span>${escHtml(program)}</span>`);
    }
    const metaHTML = metaParts.length
      ? `<div class="profile-banner-meta">${metaParts.join('<span aria-hidden="true">·</span>')}</div>`
      : '';

    const bannerHTML = `
<div class="profile-banner" role="banner">
  <div class="profile-banner-left">
    <span class="profile-banner-eyebrow">Student Profile</span>
    <h1 class="profile-banner-name">${escHtml(displayName)}</h1>
    ${metaHTML}
  </div>
</div>`;
    beforeHTML(row, bannerHTML);
  }
}
