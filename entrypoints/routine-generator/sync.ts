/* Routine Generator sync — opens background tabs under the user's own
   authenticated portal session, waits for the relevant storage key to land,
   then closes the tab. Every step is user-initiated (triggered by the
   "Sync now" button) and credentials are never seen by this code. */

import { extApi } from '@/lib/runtime';

type SyncMsg = { type: 'OPEN_SYNC_TAB' | 'CLOSE_TAB'; target?: string; tabId?: number | null };

async function sendMessage<T = unknown>(msg: SyncMsg): Promise<T> {
  const api = extApi();
  if (!api) throw new Error('extension runtime not available');
  return new Promise<T>((resolve, reject) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const runtime = (api as any).runtime;
    try {
      runtime.sendMessage(msg, (res: T) => {
        const err = runtime.lastError;
        if (err) reject(new Error(err.message ?? 'runtime error'));
        else resolve(res);
      });
    } catch (e) {
      reject(e as Error);
    }
  });
}

async function runOneSyncStep(
  target: string,
  watchKeys: string[],
  predicate: (next: unknown, key: string) => boolean,
  timeoutMs: number,
): Promise<void> {
  const api = extApi();
  if (!api) throw new Error('extension runtime not available');

  const openRes = await sendMessage<{ ok?: boolean; tabId?: number | null; reason?: string }>({
    type: 'OPEN_SYNC_TAB', target,
  });
  if (!openRes?.ok) throw new Error(openRes?.reason ?? 'could not open sync tab.');
  const tabId = openRes.tabId ?? null;

  try {
    await new Promise<void>((resolve, reject) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const onChanged = (api as any).storage.onChanged;
      type Changes = Record<string, { newValue?: unknown }>;
      const listener = (changes: Changes, area: string) => {
        if (area !== 'local') return;
        for (const k of watchKeys) {
          if (!changes[k]) continue;
          const next = changes[k].newValue;
          if (predicate(next, k)) {
            onChanged.removeListener(listener);
            clearTimeout(timer);
            resolve();
            return;
          }
        }
      };
      const timer = setTimeout(() => {
        onChanged.removeListener(listener);
        reject(new Error('timed out — make sure you are logged in to the portal.'));
      }, timeoutMs);
      onChanged.addListener(listener);
    });
  } finally {
    if (tabId != null) {
      try { await sendMessage({ type: 'CLOSE_TAB', tabId }); } catch { /* ignore */ }
    }
  }
}

export type SyncProgress = { step: number; total: number; message: string };
export type SyncOpts = {
  forceCurriculum?: boolean;
  offeredOnly?: boolean;
  curriculumCapturedAt?: string | null;
  onProgress?(p: SyncProgress): void;
};

export async function triggerSync(opts: SyncOpts = {}): Promise<void> {
  const totalSteps = opts.offeredOnly ? 1 : 4;
  const set = (n: number, msg: string) => opts.onProgress?.({ step: n, total: totalSteps, message: msg });

  // STEP 1 — Offered Courses. Wait for partial:false which the filter script
  // writes after expanding FooTable pagination.
  set(1, "Reading this semester's offered courses…");
  await runOneSyncStep(
    'offered',
    ['aiubOfferedCourses'],
    (next) => {
      const v = next as { courses?: unknown[]; partial?: boolean } | null;
      if (!v || !Array.isArray(v.courses) || v.courses.length === 0) return false;
      return v.partial === false;
    },
    60000,
  );

  if (opts.offeredOnly) return;

  // STEP 2 — My Curriculum. Skip if cached recently.
  const CURRICULUM_TTL_MS = 365 * 24 * 60 * 60 * 1000;
  const curAge = opts.curriculumCapturedAt
    ? Date.now() - new Date(opts.curriculumCapturedAt).getTime()
    : Infinity;
  const curFresh = Number.isFinite(curAge) && curAge < CURRICULUM_TTL_MS && !opts.forceCurriculum;

  if (curFresh) {
    set(2, 'Curriculum cached — skipping (use "Refresh curriculum" to force).');
  } else {
    set(2, 'Capturing your curriculum + prerequisites…');
    await runOneSyncStep(
      'curriculum',
      ['aiubCurriculumSyncDone', 'aiubCurriculum'],
      (next, key) => {
        if (key === 'aiubCurriculumSyncDone') return !!next;
        const v = next as { courses?: unknown[] } | null;
        return !!(v && Array.isArray(v.courses) && v.courses.length >= 5);
      },
      30000,
    );
  }

  // STEP 3 — Grade Report by Curriculum (code-exact completed courses).
  set(3, 'Reading your completed courses (by curriculum)…');
  await runOneSyncStep(
    'gradeByCurriculum',
    ['aiubGraphData'],
    (next) => {
      const v = next as { curriculum?: { courseStates?: unknown[] } } | null;
      return !!(v?.curriculum?.courseStates && v.curriculum.courseStates.length > 0);
    },
    20000,
  );

  // STEP 4 — Grade Report by Semester (supplementary names + SGPA).
  set(4, 'Reading your completed courses (by semester)…');
  await runOneSyncStep(
    'gradeBySemester',
    ['aiubGraphData'],
    (next) => {
      const v = next as { semester?: { completedNames?: unknown[] } } | null;
      return !!(v?.semester?.completedNames && Array.isArray(v.semester.completedNames));
    },
    20000,
  );
}

import type { HighlightGroup } from '@/lib/offered';

export async function writeHighlights(payload: {
  groups: HighlightGroup[];
  courseTitles: string[];
  enabled: boolean;
}) {
  const api = extApi();
  if (!api) return;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const set = (api.storage.local as any).set;
  if (typeof set !== 'function') return;
  await new Promise<void>((resolve) => set.call(
    api.storage.local,
    { aiubHighlights: { ...payload, updatedAt: new Date().toISOString() } },
    () => resolve(),
  ));
}
