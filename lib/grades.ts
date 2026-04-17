/* AIUB grade scale + CGPA math utilities. Consumed by the CGPA Planner.
   Source: AIUB academic handbook. */

export const GRADE_POINTS: Record<string, number> = {
  'A+': 4.0, 'A': 3.75, 'B+': 3.5, 'B': 3.25,
  'C+': 3.0, 'C': 2.75, 'D+': 2.5, 'D': 2.25, 'F': 0.0,
};

export const GRADE_ORDER = ['A+', 'A', 'B+', 'B', 'C+', 'C', 'D+', 'D', 'F'] as const;

export const GRADUATION_CREDITS = 148; // BSc CSE minimum per AIUB curriculum.

export function projectCgpa(
  currentPoints: number,
  currentCr: number,
  addedPoints: number,
  addedCr: number,
): number {
  const totalCr = currentCr + addedCr;
  if (totalCr <= 0) return 0;
  return (currentPoints + addedPoints) / totalCr;
}

export function requiredAvg(
  currentPoints: number,
  currentCr: number,
  remainingCr: number,
  targetCgpa: number,
): number {
  if (remainingCr <= 0) return NaN;
  return (targetCgpa * (currentCr + remainingCr) - currentPoints) / remainingCr;
}

export type Feasibility = { tone: 'ok' | 'warn' | 'err' | 'muted'; label: string };
export function feasibilityOf(req: number): Feasibility {
  if (!Number.isFinite(req)) return { tone: 'muted', label: 'n/a' };
  if (req > 4.0) return { tone: 'err', label: 'Not reachable' };
  if (req > 3.85) return { tone: 'warn', label: 'Near-perfect' };
  if (req > 3.5) return { tone: 'warn', label: 'Stretch' };
  if (req > 3.0) return { tone: 'ok', label: 'Achievable' };
  return { tone: 'ok', label: 'Comfortable' };
}

export type Standing = { label: string; tone: 'ok' | 'warn' | 'err'; hint: string };
export function standingOf(cgpa: number): Standing {
  if (cgpa >= 3.75) return { label: "Dean's list", tone: 'ok', hint: 'Top band of the class — 3.75+.' };
  if (cgpa >= 3.5)  return { label: 'Very good', tone: 'ok', hint: 'Strong standing.' };
  if (cgpa >= 3.0)  return { label: 'Good', tone: 'ok', hint: 'Solid standing.' };
  if (cgpa >= 2.25) return { label: 'Passing', tone: 'warn', hint: 'Above the 2.00 graduation floor.' };
  if (cgpa >= 2.0)  return { label: 'Graduation floor', tone: 'warn', hint: 'CGPA 2.00 is the minimum to graduate.' };
  return { label: 'Probation zone', tone: 'err', hint: 'Below 2.00 — academic probation territory.' };
}

export function fmt(n: number | null | undefined, digits = 2): string {
  if (n == null || !Number.isFinite(n)) return '—';
  return n.toFixed(digits);
}

export function toNum(v: unknown): number {
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
  if (!v) return 0;
  const m = String(v).match(/-?\d+(\.\d+)?/);
  return m ? parseFloat(m[0]) : 0;
}
