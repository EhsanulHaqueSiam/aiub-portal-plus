/* Type definitions + reader for the aiubGraphData record persisted by the
   Grade Report content scripts (entrypoints/gradeByCurriculum.content.ts and
   gradeBySemester.content.ts). Central typed surface so every page that
   consumes the data gets the same shape. */

import { extApi } from './runtime';

export type CurriculumCourseState = {
  code: string;
  name: string;
  credit: string;
  state: 'done' | 'ong' | 'wdn' | 'nd';
  prerequisite?: string;
  locked?: boolean;
  missingPrerequisites?: string[];
};

export type SemesterCourseState = {
  label: string;
  classId: string;
  name: string;
  nameNorm?: string;
  credit: string;
  creditValue?: number;
  grade: string;
  state: 'done' | 'ong' | 'fail' | 'wdn';
};

export type Curriculum = {
  studentName?: string;
  studentId?: string;
  program?: string;
  cgpa?: number;
  totalCredits?: number;
  totalCourses?: number;
  coreCourseCodes?: string[];
  coreCourseNames?: string[];
  stateCredits?: { completed: number; ongoing: number; withdrawn: number; notAttempted: number };
  stateCounts?: { completed: number; ongoing: number; withdrawn: number; notAttempted: number };
  semesterProgress?: Array<{ label: string; total: number; attempted: number; completed: number }>;
  prerequisite?: { lockedCredits: number; unlockedCredits: number; lockedCourses: number; unlockedCourses: number };
  courseStates?: CurriculumCourseState[];
  updatedAt?: string;
};

export type Semester = {
  studentName?: string;
  studentId?: string;
  program?: string;
  latestCgpa?: number;
  totalCredits?: number;
  totalCourses?: number;
  passFail?: { passed: number; ongoing: number; dropped: number; failed: number };
  passFailCredits?: { passed: number; ongoing: number; dropped: number; failed: number };
  semesterGpaTrend?: Array<{ label: string; gpa: number }>;
  cgpaTrend?: Array<{ label: string; cgpa: number }>;
  creditBySemester?: Array<{ label: string; credits: number }>;
  courseStates?: SemesterCourseState[];
  completedNames?: string[];
  capturedAt?: string;
};

export type AiubGraphData = {
  curriculum?: Curriculum;
  semester?: Semester;
  updatedAt?: string;
};

export type AiubStudent = {
  name?: string;
  studentId?: string;
  capturedAt?: string;
};

export async function readGraphData(): Promise<AiubGraphData | null> {
  const api = extApi();
  if (!api) return null;
  try {
    const res = await api.storage.local.get({ aiubGraphData: null });
    return (res.aiubGraphData as AiubGraphData | null) ?? null;
  } catch {
    return null;
  }
}

export async function readStudent(): Promise<AiubStudent | null> {
  const api = extApi();
  if (!api) return null;
  try {
    const res = await api.storage.local.get({ aiubStudent: null });
    return (res.aiubStudent as AiubStudent | null) ?? null;
  } catch {
    return null;
  }
}

type Listener = (changes: Record<string, { newValue?: unknown }>, area: string) => void;
export function onStorageChanged(cb: Listener): () => void {
  const api = extApi();
  const add = api?.storage?.onChanged?.addListener;
  if (!api || !add) return () => {};
  add.call(api.storage.onChanged, cb);
  return () => {
    const remove = (api.storage.onChanged as unknown as { removeListener?: (c: Listener) => void })
      ?.removeListener;
    if (remove) remove(cb);
  };
}
