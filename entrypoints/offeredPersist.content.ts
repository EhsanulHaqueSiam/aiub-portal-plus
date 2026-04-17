import { extensionEnabled } from '@/utils/storage';
import type { OfferedCourse, Section } from '@/lib/offered';

type TimeSlot = {
  classType: string;
  day: string;
  startTime: string;
  endTime: string;
  room: string;
};

type FlatSection = {
  classId: string;
  title: string;
  section: string;
  fullTitle: string;
  status: string;
  capacity: number;
  count: number;
  timeSlots: TimeSlot[];
};

/* The parser (both the DOM-reading fallback here and the MAIN-world
   offered-filter.js) produces one flat record per <tr> — that is, one per
   section. The Routine Generator expects the storage shape from
   lib/offered.ts (OfferedCourse[] with nested sections[] per title).
   Group by title once at the write boundary so downstream code only has
   to handle one shape. */
function groupFlatIntoCourses(flat: FlatSection[]): OfferedCourse[] {
  const byTitle = new Map<string, OfferedCourse>();
  for (const row of flat) {
    const title = (row.title ?? '').trim();
    if (!title) continue;
    let bucket = byTitle.get(title);
    if (!bucket) {
      bucket = { title, sections: [] };
      byTitle.set(title, bucket);
    }
    const s: Section = {
      classId: row.classId,
      section: row.section,
      status: row.status,
      capacity: row.capacity,
      timeSlots: row.timeSlots,
    };
    bucket.sections!.push(s);
  }
  return Array.from(byTitle.values());
}

declare global {
  interface Window {
    __aiubOfferedPersist?: boolean;
  }
}

export default defineContentScript({
  matches: ['https://portal.aiub.edu/Student/Section/Offered*'],
  runAt: 'document_idle',

  async main() {
    if (!(await extensionEnabled.getValue())) return;
    if (window.__aiubOfferedPersist) return;
    window.__aiubOfferedPersist = true;

    const tryPersist = async (attempts = 0) => {
      const rows = document.querySelectorAll('table.footable tbody > tr');
      if (!rows.length) {
        if (attempts < 60) setTimeout(() => tryPersist(attempts + 1), 500);
        return;
      }

      // The FooTable only renders the current page's rows in the DOM. The MAIN-world
      // filter script (offered-filter.js) will expand pagination and overwrite this
      // payload with the full list once it loads. We still write a best-effort copy
      // so the Routine Generator has something if the user skipped interacting.
      const flat = parseRows(rows);
      if (flat.length === 0) {
        if (attempts < 60) setTimeout(() => tryPersist(attempts + 1), 500);
        return;
      }

      await browser.storage.local.set({
        aiubOfferedCourses: {
          courses: groupFlatIntoCourses(flat),
          capturedAt: new Date().toISOString(),
          partial: true,
        },
      });
    };

    // Also listen for the full dataset posted by offered-filter.js (MAIN world) via
    // window.postMessage. The MAIN-world script has no extension APIs, so it asks us
    // to persist on its behalf.
    window.addEventListener('message', (event) => {
      if (event.source !== window) return;
      const data = event.data as { type?: string; courses?: FlatSection[] } | null;
      if (!data || data.type !== 'AIUB_PORTAL_PLUS_OFFERED' || !Array.isArray(data.courses)) {
        return;
      }
      browser.storage.local.set({
        aiubOfferedCourses: {
          courses: groupFlatIntoCourses(data.courses),
          capturedAt: new Date().toISOString(),
          partial: false,
        },
      });
    });

    tryPersist();
  },
});

function parseRows(rows: NodeListOf<Element>): FlatSection[] {
  const courses: FlatSection[] = [];
  rows.forEach((row) => {
    const cells = row.querySelectorAll('td');
    if (cells.length < 3) return;

    const classId = cells[0].textContent?.trim() ?? '';
    if (!classId || !/^\d+$/.test(classId)) return;

    const fullTitle = cells[1]?.textContent?.trim() ?? '';
    const status = cells[2]?.textContent?.trim() ?? '';
    const capacity = parseInt(cells[3]?.textContent?.trim() ?? '0', 10) || 0;
    const count = parseInt(cells[4]?.textContent?.trim() ?? '0', 10) || 0;

    const timeSlots: TimeSlot[] = [];
    if (cells.length > 5) {
      cells[5].querySelectorAll('table tbody tr').forEach((timeRow) => {
        const tc = timeRow.querySelectorAll('td');
        if (tc.length < 3) return;
        timeSlots.push({
          classType: tc[0]?.textContent?.trim() ?? '',
          day: tc[1]?.textContent?.trim() ?? '',
          startTime: tc[2]?.textContent?.trim() ?? '',
          endTime: tc[3]?.textContent?.trim() ?? '',
          room: tc[4]?.textContent?.trim() ?? '',
        });
      });
    }

    const sectionMatch = fullTitle.match(/\[([^\]]+)\]$/);
    const section = sectionMatch ? sectionMatch[1] : '';
    const title = fullTitle.replace(/\s*\[[^\]]+\]$/, '').trim();

    courses.push({
      classId,
      title,
      section,
      fullTitle,
      status,
      capacity,
      count,
      timeSlots,
    });
  });
  return courses;
}
