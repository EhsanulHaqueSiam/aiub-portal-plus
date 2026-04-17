/* Eligibility computation for the Routine Generator.

   Prereqs in the Curriculum page use course CODES (e.g. "MAT1102"), while
   Grade Report → By Semester only exposes course NAMES (class IDs are
   per-section and rotate every semester). So the lookup is:
     prereq code → curriculum name → completed-name check.

   We also handle the classic AIUB name drift:
     "OBJECT ORIENTED PROGRAMMING 1"      vs "OBJECT ORIENTED PROGRAMMING 1 (JAVA)"
     "BUSINESS COMMUNICATION"             vs "BUSINESS COMMUNICATION [CS/ENGG]"
     "MICROPROCESSOR AND EMBEDDED SYSTEM" vs "...SYSTEMS"
   by stripping annotations and folding trailing plural 'S'. */

import type { CurriculumCourse, CurriculumData } from './offered';
import type { Curriculum, Semester, SemesterCourseState } from './graphData';
import { norm } from './routine';

const NIL = new Set(['', 'NIL', 'NILL', 'N/A', 'NA', '-']);

export function normCode(v: unknown): string {
  return norm(v).replace(/\s+/g, '');
}

export function normName(v: unknown): string {
  let s = norm(v)
    .replace(/\[[^\]]*\]/g, ' ')
    .replace(/\([^)]*\)/g, ' ')
    .replace(/[^A-Z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  s = s
    .split(' ')
    .map((w) => (w.length > 3 && w.endsWith('S') ? w.slice(0, -1) : w))
    .join(' ');
  return s;
}

export function namesMatch(a: string, b: string): boolean {
  const na = normName(a);
  const nb = normName(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  if (na.length >= 8 && nb.includes(na)) return true;
  if (nb.length >= 8 && na.includes(nb)) return true;
  return false;
}

export type CompletedLookup = {
  size: number;
  hasCode(code: string): boolean;
  hasName(name: string): boolean;
  hasCourse(course: { code?: string; name?: string }): boolean;
};

export function buildCompletedLookup(
  curriculum: Curriculum | null,
  semester: Semester | null,
): CompletedLookup {
  const codes = new Set<string>();
  const names: string[] = [];

  // ByCurriculum grade report — gold standard, exact code match.
  const cStates = curriculum?.courseStates ?? [];
  for (const r of cStates) {
    if ((r.state === 'done' || r.state === 'ong') && r.code) codes.add(normCode(r.code));
    if ((r.state === 'done' || r.state === 'ong') && r.name) names.push(r.name);
  }
  // BySemester fallback — names only.
  const sCompletedNames = semester?.completedNames ?? [];
  for (const n of sCompletedNames) if (n) names.push(n);
  const sStates: SemesterCourseState[] = semester?.courseStates ?? [];
  for (const r of sStates) {
    if ((r.state === 'done' || r.state === 'ong') && r.name) names.push(r.name);
  }

  const nameKeys = new Set(names.map(normName));

  return {
    size: codes.size + nameKeys.size,
    hasCode(code) {
      const k = normCode(code);
      return !!k && codes.has(k);
    },
    hasName(raw) {
      const k = normName(raw);
      if (!k) return false;
      if (nameKeys.has(k)) return true;
      for (const n of names) if (namesMatch(n, raw)) return true;
      return false;
    },
    hasCourse(course) {
      if (course.code && this.hasCode(course.code)) return true;
      if (course.name && this.hasName(course.name)) return true;
      return false;
    },
  };
}

function curriculumCodeToName(curriculumData: CurriculumData | null): Map<string, string> {
  const m = new Map<string, string>();
  for (const c of curriculumData?.courses ?? []) {
    if (c.code) m.set(normCode(c.code), c.name ?? '');
  }
  return m;
}

function isReqSatisfied(
  reqToken: string,
  completed: CompletedLookup,
  codeToName: Map<string, string>,
): boolean {
  const t = String(reqToken ?? '').trim();
  if (!t || NIL.has(t.toUpperCase())) return true;
  if (/\bCREDITS?\b/i.test(t)) return false;
  const code = normCode(t);
  if (completed.hasCode(code)) return true;
  const name = codeToName.get(code);
  if (!name) return true;
  return completed.hasName(name);
}

export type EligibleResult = {
  list: CurriculumCourse[];
  reason: 'ok' | 'no-curriculum' | 'no-grades';
};

export function computeEligibleCourses(
  curriculumData: CurriculumData | null,
  completed: CompletedLookup,
): EligibleResult {
  const curList = curriculumData?.courses ?? [];
  if (!curList.length) return { list: [], reason: 'no-curriculum' };
  if (completed.size === 0) return { list: [], reason: 'no-grades' };

  const codeToName = curriculumCodeToName(curriculumData);
  const out: CurriculumCourse[] = [];
  for (const c of curList) {
    if (completed.hasCourse(c)) continue;
    const reqs = ((c as unknown as { prerequisites?: string[] }).prerequisites) ?? [];
    const missing = reqs.filter((r) => !isReqSatisfied(r, completed, codeToName));
    if (missing.length === 0) out.push(c);
  }
  return { list: out, reason: 'ok' };
}
