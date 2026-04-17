/* Typed shapes for the Offered Courses + Curriculum data that the content
   scripts persist to chrome.storage.local. Consumed by the Routine Generator
   and (indirectly) the CGPA Planner. */

import { extApi } from './runtime';

export type TimeSlot = {
  day?: string;
  startTime?: string;
  endTime?: string;
  classType?: string;
  room?: string;
};

export type Section = {
  classId?: string;
  section?: string;
  status?: string;
  capacity?: number;
  timeSlots?: TimeSlot[];
  // Parsed slot cache — filled in at runtime for clash detection.
  _parsedSlots?: ParsedSlot[];
};

export type ParsedSlot = {
  day: string;
  classType?: string;
  room?: string;
  start: string;
  end: string;
  _start: number;
  _end: number;
};

export type OfferedCourse = {
  title: string;
  courseCode?: string;
  sections?: Section[];
};

export type OfferedData = {
  courses: OfferedCourse[];
  capturedAt?: string | null;
  partial?: boolean;
};

export type CurriculumCourse = {
  code: string;
  name: string;
  credit?: string | number;
  state: 'done' | 'ong' | 'wdn' | 'nd';
  prerequisite?: string;
  locked?: boolean;
  missingPrerequisites?: string[];
};

export type CurriculumData = {
  courses: CurriculumCourse[];
  capturedAt?: string | null;
};

export type RegistrationStatus = {
  active?: boolean;
  detectedAt?: string;
  buttonText?: string;
};

/* One colored highlight group. Multiple groups let the Routine Generator
   pin 2–N routines simultaneously, each class ID set painted a distinct
   color so the student can spot routine-A's sections at a glance among
   routine-B's on the Offered Courses page. Color is a palette key, not
   a raw CSS value — the content script maps it to styled classes. */
export type HighlightColor = 'amber' | 'royal' | 'emerald' | 'rose' | 'violet';
export const HIGHLIGHT_COLORS: HighlightColor[] = ['amber', 'royal', 'emerald', 'rose', 'violet'];

export type HighlightGroup = {
  classIds: string[];
  color: HighlightColor;
  /* Per-pin on/off without deleting. Temporarily hides this pin's paint
     while keeping its identity (class IDs + color) in storage. Defaults to
     true when absent — older groups from pre-v1.4.17 are treated as on. */
  enabled?: boolean;
};

export type Highlights = {
  /* New shape (v1.4.14+): one entry per pinned routine. */
  groups?: HighlightGroup[];
  /* Legacy shape (≤v1.4.13): flat class IDs, treated as a single amber
     group by the content script for backwards compat with stored state
     written by older versions. */
  classIds?: string[];
  courseTitles?: string[];
  enabled?: boolean;
};

export async function readOfferedData(): Promise<OfferedData | null> {
  const api = extApi();
  if (!api) return null;
  const res = await api.storage.local.get({ aiubOfferedCourses: null });
  return (res.aiubOfferedCourses as OfferedData | null) ?? null;
}

export async function readCurriculumData(): Promise<CurriculumData | null> {
  const api = extApi();
  if (!api) return null;
  const res = await api.storage.local.get({ aiubCurriculum: null });
  return (res.aiubCurriculum as CurriculumData | null) ?? null;
}

export async function readRegistrationStatus(): Promise<RegistrationStatus | null> {
  const api = extApi();
  if (!api) return null;
  const res = await api.storage.local.get({ aiubRegistrationStatus: null });
  return (res.aiubRegistrationStatus as RegistrationStatus | null) ?? null;
}

export async function readHighlights(): Promise<Highlights | null> {
  const api = extApi();
  if (!api) return null;
  const res = await api.storage.local.get({ aiubHighlights: null });
  return (res.aiubHighlights as Highlights | null) ?? null;
}
