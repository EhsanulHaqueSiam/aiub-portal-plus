import { extensionEnabled } from '@/utils/storage';
import {
  fmtDate,
  fmtDuration,
  getDateForLabel,
  getGreeting,
  loadCSS,
  parseTimeRange,
} from '@/utils/portal';

declare global {
  interface Window {
    __aiubScheduleEnhanced?: boolean;
  }
}

type Entry = {
  href: string;
  name: string;
  timeStr: string;
  roomStr: string;
};

export default defineContentScript({
  matches: [
    'https://portal.aiub.edu/Student',
    'https://portal.aiub.edu/Student/',
    'https://portal.aiub.edu/Student/Home/*',
  ],
  runAt: 'document_idle',
  cssInjectionMode: 'manual',

  async main() {
    if (!(await extensionEnabled.getValue())) return;
    if (window.__aiubScheduleEnhanced) return;
    window.__aiubScheduleEnhanced = true;

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

function updateTimers() {
  const now = Date.now();
  const clockEl = document.getElementById('sched-live-clock');
  if (clockEl) {
    clockEl.textContent = new Date().toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
  }
  document.querySelectorAll<HTMLElement>('.sched-timer[data-start]').forEach((el) => {
    const start = parseInt(el.dataset.start ?? '', 10);
    const end = parseInt(el.dataset.end ?? '', 10);
    if (!start || !end) return;
    const txt = el.querySelector<HTMLElement>('.sched-timer-text');
    const card = el.closest<HTMLElement>('.sched-class-entry');
    el.classList.remove('sched-timer-upcoming', 'sched-timer-active', 'sched-timer-ended');
    card?.classList.remove('sched-state-active', 'sched-state-ended');
    if (!txt) return;
    if (now >= end) {
      el.classList.add('sched-timer-ended');
      card?.classList.add('sched-state-ended');
      txt.textContent = 'Ended';
    } else if (now >= start) {
      el.classList.add('sched-timer-active');
      card?.classList.add('sched-state-active');
      txt.textContent = 'In Progress \u00B7 ' + fmtDuration(end - now) + ' left';
    } else {
      el.classList.add('sched-timer-upcoming');
      txt.textContent = 'Starts in ' + fmtDuration(start - now);
    }
  });
}

function enhance() {
  const mainContent = document.getElementById('main-content');
  if (!mainContent) return;

  loadCSS('schedule-style', 'Home/ClassSchedule.css');

  mainContent.querySelectorAll<HTMLElement>('.panel-heading .panel-title').forEach((title) => {
    if (title.textContent?.trim() === 'Class Schedule') {
      const panel = title.closest<HTMLElement>('.panel');
      if (panel) {
        panel.classList.add('sched-schedule-panel');
        enhanceSchedule(panel);
      }
    }
  });
}

function buildBanner(): HTMLDivElement {
  const now = new Date();
  const dateStr = now.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

  const banner = document.createElement('div');
  banner.className = 'intro-banner';

  const left = document.createElement('div');
  left.className = 'intro-banner-left';
  const greeting = document.createElement('p');
  greeting.className = 'intro-greeting';
  greeting.textContent = getGreeting();
  const date = document.createElement('span');
  date.className = 'intro-date';
  date.textContent = dateStr;
  left.append(greeting, date);

  const badge = document.createElement('div');
  badge.className = 'intro-banner-badge';
  const bLabel = document.createElement('span');
  bLabel.className = 'intro-banner-badge-label';
  bLabel.textContent = 'Current Time';
  const bVal = document.createElement('span');
  bVal.className = 'intro-banner-badge-value';
  bVal.id = 'sched-live-clock';
  bVal.textContent = timeStr;
  badge.append(bLabel, bVal);

  banner.append(left, badge);
  return banner;
}

function buildSectionHead(): HTMLDivElement {
  const head = document.createElement('div');
  head.className = 'sched-section-head';
  head.append(document.createTextNode('Class '));
  const span = document.createElement('span');
  span.textContent = 'Schedule';
  head.appendChild(span);
  return head;
}

function buildDayHeader(dateLabel: string, dateFull: string, countText: string): HTMLDivElement {
  const header = document.createElement('div');
  header.className = 'sched-day-header';

  const badge = document.createElement('span');
  badge.className = 'sched-day-badge';
  const dot = document.createElement('span');
  dot.className = 'sched-day-dot';
  badge.appendChild(dot);
  badge.appendChild(document.createTextNode(dateLabel));
  header.appendChild(badge);

  if (dateFull) {
    const full = document.createElement('span');
    full.className = 'sched-day-date-full';
    full.textContent = dateFull;
    header.appendChild(full);
  }

  const count = document.createElement('span');
  count.className = 'sched-day-count';
  count.textContent = countText;
  header.appendChild(count);

  return header;
}

function buildCard(entry: Entry, date: Date | null): HTMLDivElement {
  const card = document.createElement('div');
  card.className = 'sched-class-entry';

  const name = document.createElement('a');
  name.className = 'sched-course-name';
  name.href = entry.href;
  name.title = entry.name;
  name.textContent = entry.name;
  card.appendChild(name);

  const meta = document.createElement('div');
  meta.className = 'sched-meta';
  if (entry.timeStr) meta.appendChild(buildMetaChip('glyphicon-time', entry.timeStr));
  if (entry.roomStr) meta.appendChild(buildMetaChip('glyphicon-map-marker', entry.roomStr));
  card.appendChild(meta);

  const timeRange = parseTimeRange(entry.timeStr);
  if (date && timeRange) {
    const s = new Date(date);
    s.setHours(timeRange.start.h, timeRange.start.m, 0, 0);
    const e = new Date(date);
    e.setHours(timeRange.end.h, timeRange.end.m, 0, 0);

    const timer = document.createElement('div');
    timer.className = 'sched-timer';
    timer.dataset.start = String(s.getTime());
    timer.dataset.end = String(e.getTime());
    // Live region so screen-reader users hear the state changes as a class
    // transitions upcoming → in-progress → ended. Atomic = true re-reads
    // the whole phrase instead of just the diff, avoiding "90. minutes."
    timer.setAttribute('role', 'status');
    timer.setAttribute('aria-live', 'polite');
    timer.setAttribute('aria-atomic', 'true');
    const tDot = document.createElement('span');
    tDot.className = 'sched-timer-dot';
    tDot.setAttribute('aria-hidden', 'true');
    const tText = document.createElement('span');
    tText.className = 'sched-timer-text';
    timer.append(tDot, tText);
    card.appendChild(timer);
  }

  return card;
}

function buildMetaChip(iconClass: string, text: string): HTMLSpanElement {
  const chip = document.createElement('span');
  chip.className = 'sched-meta-chip';
  const icon = document.createElement('span');
  icon.className = `sched-meta-icon glyphicon ${iconClass}`;
  chip.appendChild(icon);
  chip.appendChild(document.createTextNode(text));
  return chip;
}

function enhanceSchedule(panel: HTMLElement) {
  const table = panel.querySelector<HTMLElement>('.scheduleTable');
  if (!table) return;

  const parent = table.parentElement;
  if (parent) {
    parent.insertBefore(buildBanner(), table);
    parent.insertBefore(buildSectionHead(), table);
  }

  table.querySelectorAll<HTMLElement>(':scope > .row').forEach((row) => {
    const dayLabelEl = row.querySelector<HTMLElement>('.col-md-2 label, .col-xs-12 label');
    const dayText = dayLabelEl?.textContent?.trim() ?? '';
    const isToday = /^today$/i.test(dayText);
    const isTomorrow = /^tomorrow$/i.test(dayText);
    const date = getDateForLabel(dayText);

    const entries: Entry[] = [];
    row.querySelectorAll<HTMLElement>('.col-md-10 > .col-md-6').forEach((entry) => {
      const link = entry.querySelector('a');
      if (!link) return;
      const infoDiv = entry.querySelector('div');
      const labels = infoDiv?.querySelectorAll('label') ?? [];
      entries.push({
        href: link.getAttribute('href') ?? '#',
        name: link.textContent?.trim() ?? '',
        timeStr: labels[0]?.textContent?.trim() ?? '',
        roomStr: labels[1]?.textContent?.trim() ?? '',
      });
    });

    const groupClasses = ['sched-day-group'];
    if (isToday) groupClasses.push('sched-day-today');
    if (isTomorrow) groupClasses.push('sched-day-tomorrow');

    const countText =
      entries.length > 0 ? `${entries.length} class${entries.length > 1 ? 'es' : ''}` : 'No class';
    const dateLabel = isToday ? 'Today' : isTomorrow ? 'Tomorrow' : dayText;
    const dateFull = !isToday && !isTomorrow ? fmtDate(date) : '';

    const group = document.createElement('div');
    group.className = groupClasses.join(' ');
    group.appendChild(buildDayHeader(dateLabel, dateFull, countText));

    if (entries.length === 0) {
      const noDiv = document.createElement('div');
      noDiv.className = 'sched-no-class';
      noDiv.textContent = isToday
        ? 'No classes today.'
        : isTomorrow
          ? 'No classes tomorrow.'
          : 'No classes scheduled.';
      group.appendChild(noDiv);
    } else {
      const wrap = document.createElement('div');
      wrap.className = 'sched-cards-wrap';
      entries.forEach((e) => wrap.appendChild(buildCard(e, date)));
      group.appendChild(wrap);
    }

    row.parentNode?.insertBefore(group, row);
    row.classList.add('sched-original-row');
  });

  collapseConsecutiveEmptyDays(panel);

  updateTimers();
  setInterval(updateTimers, 1000);
}

/**
 * When Today and Tomorrow are both empty (common on Friday evenings and
 * during inter-semester breaks), two identical "no classes" blocks waste
 * real estate and read worse than a single friendly line. Merge them into
 * one combined block on the Today group and drop the Tomorrow group.
 */
function collapseConsecutiveEmptyDays(panel: HTMLElement) {
  const today = panel.querySelector<HTMLElement>('.sched-day-today');
  const tomorrow = panel.querySelector<HTMLElement>('.sched-day-tomorrow');
  if (!today || !tomorrow) return;
  if (!today.querySelector('.sched-no-class') || !tomorrow.querySelector('.sched-no-class')) {
    return;
  }

  tomorrow.remove();
  today.classList.add('sched-day-empty-combined');

  const badge = today.querySelector<HTMLElement>('.sched-day-badge');
  if (badge) {
    const dot = badge.querySelector('.sched-day-dot');
    badge.textContent = '';
    if (dot) badge.appendChild(dot);
    badge.appendChild(document.createTextNode('Today & Tomorrow'));
  }

  const count = today.querySelector<HTMLElement>('.sched-day-count');
  if (count) count.textContent = 'Clear';

  today.querySelector<HTMLElement>('.sched-day-date-full')?.remove();

  const msg = today.querySelector<HTMLElement>('.sched-no-class');
  if (msg) msg.textContent = 'No classes today or tomorrow — enjoy the break.';
}
