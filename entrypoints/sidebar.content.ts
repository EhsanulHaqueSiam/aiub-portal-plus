import { extensionEnabled } from '@/utils/storage';
import { getStudentName, getStudentId, loadCSS } from '@/utils/portal';

declare global {
  interface Window {
    __aiubSidebarEnhanced?: boolean;
  }
}

export default defineContentScript({
  matches: ['https://portal.aiub.edu/Student*'],
  runAt: 'document_idle',

  async main() {
    if (!(await extensionEnabled.getValue())) return;
    if (window.__aiubSidebarEnhanced) return;
    window.__aiubSidebarEnhanced = true;

    const tryEnhance = () => {
      if (document.getElementById('navigation-bar')) {
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

function buildProfileBlock(name: string, studentId: string): HTMLDivElement {
  const block = document.createElement('div');
  block.className = 'nav-profile-block';

  const nameEl = document.createElement('div');
  nameEl.className = 'nav-profile-name';
  nameEl.textContent = name;
  block.appendChild(nameEl);

  if (studentId) {
    const idEl = document.createElement('div');
    idEl.className = 'nav-profile-id';
    idEl.textContent = studentId;
    block.appendChild(idEl);
  }
  return block;
}

function buildNavLink(className: string, href: string, iconClass: string, label: string): HTMLAnchorElement {
  const link = document.createElement('a');
  link.className = `list-group-item ${className}`;
  link.href = href;

  const icon = document.createElement('span');
  icon.className = `glyphicon ${iconClass}`;
  icon.setAttribute('aria-hidden', 'true');
  link.appendChild(icon);
  link.appendChild(document.createTextNode(' ' + label));
  return link;
}

function injectExtraNavItems(sidebar: HTMLElement) {
  const gradeLinks = Array.from(
    sidebar.querySelectorAll<HTMLAnchorElement>(
      '.list-group-item[href*="/Student/GradeReport/ByCurriculum"], .list-group-item[href*="/Student/GradeReport/BySemester"]',
    ),
  );

  const anchor: { parent: HTMLElement | null; after: HTMLElement } | null = gradeLinks.length
    ? {
        parent: gradeLinks[gradeLinks.length - 1].parentElement,
        after: gradeLinks[gradeLinks.length - 1],
      }
    : null;

  const fallback = sidebar.querySelector('.panel-collapse > div');

  const insertAfterLast = (el: HTMLElement) => {
    if (anchor?.parent) {
      if (anchor.after.nextSibling) {
        anchor.parent.insertBefore(el, anchor.after.nextSibling);
      } else {
        anchor.parent.appendChild(el);
      }
      anchor.after = el;
    } else if (fallback) {
      fallback.appendChild(el);
    }
  };

  if (!sidebar.querySelector('.aiub-graph-nav-item')) {
    const graphUrl = browser.runtime.getURL('/Grade/Graphs.html');
    if (graphUrl) {
      insertAfterLast(buildNavLink('aiub-graph-nav-item', graphUrl, 'glyphicon-stats', 'Graph'));
    }
  }

  if (!sidebar.querySelector('.aiub-routine-nav-item')) {
    const routineUrl = browser.runtime.getURL('/RoutineGenerator/index.html');
    if (routineUrl) {
      insertAfterLast(
        buildNavLink('aiub-routine-nav-item', routineUrl, 'glyphicon-calendar', 'Routine Generator'),
      );
    }
  }
}

function enhance() {
  const sidebar = document.getElementById('navigation-bar');
  if (!sidebar) return;

  // Shared blue-theme design tokens come first so every other stylesheet
  // can reference --p-* variables.
  loadCSS('aiub-tokens', 'Shared/tokens.css');
  loadCSS('sidebar-style', 'Shared/Sidebar.css');
  injectExtraNavItems(sidebar);

  const name = getStudentName();
  const studentId = getStudentId();

  if (name) {
    sidebar.insertBefore(buildProfileBlock(name, studentId), sidebar.firstChild);
    // Cache student identity so our standalone extension pages (Routine Generator,
    // Graphs) can show the same profile block without scraping the portal.
    browser.storage.local.set({
      aiubStudent: { name, studentId, capturedAt: new Date().toISOString() },
    });
  }

  const path = window.location.pathname;
  sidebar.querySelectorAll<HTMLAnchorElement>('.list-group-item').forEach((a) => {
    try {
      const href = new URL(a.href).pathname;
      if (path.startsWith(href) && href !== '/Student') {
        a.classList.add('active');
        const collapse = a.closest<HTMLElement>('.panel-collapse');
        if (collapse) {
          collapse.classList.add('in');
          collapse.style.height = 'auto';
          const trigger = sidebar.querySelector<HTMLElement>(`[href="#${collapse.id}"]`);
          trigger?.setAttribute('aria-expanded', 'true');
        }
      }
    } catch {
      /* ignore */
    }
  });

  sidebar.querySelectorAll('.panel-group > .panel + .panel').forEach((panel) => {
    const divider = document.createElement('div');
    divider.className = 'nav-section-divider';
    panel.parentElement?.insertBefore(divider, panel);
  });
}
