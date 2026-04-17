/* Routine generation core: clash detection + backtracking search. Pure
   functions so they're trivially testable and can be swapped into a web
   worker later if large catalogs make main-thread blocking noticeable. */

import type { Section, ParsedSlot } from './offered';

export const WEEK_DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday'] as const;
export const ALL_DAYS = [
  'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday',
] as const;

export const MAX_RESULTS = 100;    // upper bound on routines returned
export const MAX_SEARCH  = 40000;  // backtracking node budget — bails out early
                                   // on impossible-to-enumerate catalogs.

export function norm(s: unknown): string {
  return String(s ?? '').replace(/\s+/g, ' ').trim().toUpperCase();
}

export function parseClockTime(str: string | null | undefined): number | null {
  if (!str) return null;
  const m = String(str).trim().match(/^(\d{1,2})(?::(\d{1,2}))?\s*(AM|PM)?$/i);
  if (!m) return null;
  let h = parseInt(m[1], 10);
  const mins = m[2] ? parseInt(m[2], 10) : 0;
  const period = (m[3] ?? '').toUpperCase();
  if (period === 'PM' && h !== 12) h += 12;
  if (period === 'AM' && h === 12) h = 0;
  if (h < 0 || h > 23 || mins < 0 || mins > 59) return null;
  return h * 60 + mins;
}

export function fmtClockTime(mins: number): string {
  const h24 = Math.floor(mins / 60);
  const m = mins % 60;
  const h12 = h24 === 0 ? 12 : h24 > 12 ? h24 - 12 : h24;
  const period = h24 >= 12 ? 'PM' : 'AM';
  const mm = String(m).padStart(2, '0');
  return `${h12}:${mm} ${period}`;
}

export function fmtAgo(iso: string | null | undefined): string {
  if (!iso) return 'never';
  const diff = Date.now() - new Date(iso).getTime();
  if (isNaN(diff) || diff < 0) return 'just now';
  const s = Math.floor(diff / 1000);
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} hr ago`;
  const d = Math.floor(h / 24);
  return `${d} day${d !== 1 ? 's' : ''} ago`;
}

export type Filters = {
  earliest: number;
  latest: number;
  maxSeats: number;
  statuses: Set<string>;
  allowedDays: Set<string>;
  sortBy: 'minimize' | 'none';
};

export type Selection = {
  title: string;
  sections: Section[];
  forcedSection?: string;
};

export type Routine = {
  sections: Section[];
  offDays: number;
  totalGap: number;
  earliestStart: number;
};

export type GenerateResult = {
  routines: Routine[];
  missing: string[];
  exploredCap?: boolean;
};

export function sectionPassesStatic(section: Section, filters: Filters): boolean {
  if (filters.statuses.size > 0) {
    const s = norm(section.status ?? '');
    const match = Array.from(filters.statuses).some((allowed) => s.includes(allowed));
    if (!match) return false;
  }
  if (filters.maxSeats >= 0 && filters.maxSeats < 100) {
    if (section.capacity != null && section.capacity > filters.maxSeats) return false;
  }
  for (const slot of section.timeSlots ?? []) {
    if (!slot.day) continue;
    if (!filters.allowedDays.has(slot.day)) return false;
    const sm = parseClockTime(slot.startTime);
    const em = parseClockTime(slot.endTime);
    if (sm == null || em == null) continue;
    if (sm < filters.earliest) return false;
    if (em > filters.latest) return false;
  }
  return true;
}

function precomputeSlots(section: Section): void {
  section._parsedSlots = (section.timeSlots ?? []).flatMap((slot): ParsedSlot[] => {
    const s = parseClockTime(slot.startTime);
    const e = parseClockTime(slot.endTime);
    if (s == null || e == null || !slot.day) return [];
    return [{
      day: slot.day,
      classType: slot.classType,
      room: slot.room,
      start: String(slot.startTime ?? ''),
      end: String(slot.endTime ?? ''),
      _start: s,
      _end: e,
    }];
  });
}

function buildCandidateSections(selection: Selection, filters: Filters): Section[] {
  let c = selection.sections;
  if (selection.forcedSection) {
    c = c.filter((s) => (s.section ?? s.classId) === selection.forcedSection);
  }
  return c.filter((s) => sectionPassesStatic(s, filters));
}

function sectionsClash(a: Section, b: Section): boolean {
  const sa = a._parsedSlots ?? [];
  const sb = b._parsedSlots ?? [];
  for (const x of sa) {
    for (const y of sb) {
      if (x.day === y.day && x._start < y._end && y._start < x._end) return true;
    }
  }
  return false;
}

function countOffDays(sections: Section[]): number {
  const used = new Set<string>();
  for (const sec of sections) for (const slot of sec._parsedSlots ?? []) used.add(slot.day);
  let off = 0;
  for (const d of WEEK_DAYS) if (!used.has(d)) off++;
  return off;
}

function totalGapMinutes(sections: Section[]): number {
  const byDay: Record<string, ParsedSlot[]> = {};
  for (const sec of sections) {
    for (const slot of sec._parsedSlots ?? []) {
      (byDay[slot.day] ??= []).push(slot);
    }
  }
  let total = 0;
  for (const d of Object.keys(byDay)) {
    const slots = byDay[d].slice().sort((a, b) => a._start - b._start);
    for (let i = 1; i < slots.length; i++) {
      const gap = slots[i]._start - slots[i - 1]._end;
      if (gap > 0) total += gap;
    }
  }
  return total;
}

function earliestStartOf(sections: Section[]): number {
  let e = Infinity;
  for (const sec of sections) for (const slot of sec._parsedSlots ?? []) {
    if (slot._start < e) e = slot._start;
  }
  return e === Infinity ? 0 : e;
}

export function generateRoutines(selections: Selection[], filters: Filters): GenerateResult {
  const courseCandidates: Array<{ title: string; candidates: Section[] }> = [];
  const missing: string[] = [];
  for (const sel of selections) {
    const cands = buildCandidateSections(sel, filters);
    cands.forEach(precomputeSlots);
    if (cands.length === 0) missing.push(sel.title);
    courseCandidates.push({ title: sel.title, candidates: cands });
  }
  if (missing.length) return { routines: [], missing };

  const routines: Section[][] = [];
  let explored = 0;
  let cap = false;

  (function backtrack(idx: number, picked: Section[]) {
    if (routines.length >= MAX_RESULTS || explored > MAX_SEARCH) return;
    if (idx === courseCandidates.length) {
      routines.push(picked.slice());
      return;
    }
    for (const sec of courseCandidates[idx].candidates) {
      explored++;
      if (explored > MAX_SEARCH) { cap = true; return; }
      let clash = false;
      for (const prev of picked) {
        if (sectionsClash(prev, sec)) { clash = true; break; }
      }
      if (clash) continue;
      picked.push(sec);
      backtrack(idx + 1, picked);
      picked.pop();
      if (routines.length >= MAX_RESULTS) return;
    }
  })(0, []);

  const ranked: Routine[] = routines.map((r) => ({
    sections: r,
    offDays: countOffDays(r),
    totalGap: totalGapMinutes(r),
    earliestStart: earliestStartOf(r),
  }));

  if (filters.sortBy === 'minimize') {
    ranked.sort((a, b) => a.totalGap - b.totalGap || b.offDays - a.offDays);
  } else {
    ranked.sort((a, b) => b.offDays - a.offDays || a.totalGap - b.totalGap);
  }

  return { routines: ranked, missing: [], exploredCap: cap };
}
