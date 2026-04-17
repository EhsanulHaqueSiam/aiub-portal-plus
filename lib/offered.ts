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

export type Highlights = {
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
