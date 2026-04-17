import { useEffect, useState } from 'react';
import { extApi } from '@/lib/runtime';
import type { OfferedData, CurriculumData, RegistrationStatus, Highlights } from '@/lib/offered';
import { readOfferedData, readCurriculumData, readRegistrationStatus, readHighlights } from '@/lib/offered';
import type { AiubGraphData, AiubStudent } from '@/lib/graphData';
import { readGraphData, readStudent } from '@/lib/graphData';

export type RoutineDataState = {
  offered: OfferedData | null;
  curriculum: CurriculumData | null;
  graph: AiubGraphData | null;
  student: AiubStudent | null;
  registration: RegistrationStatus | null;
  highlights: Highlights | null;
  loaded: boolean;
};

export function useRoutineData(): RoutineDataState {
  const [state, setState] = useState<RoutineDataState>({
    offered: null, curriculum: null, graph: null, student: null,
    registration: null, highlights: null, loaded: false,
  });

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const [offered, curriculum, graph, student, registration, highlights] = await Promise.all([
        readOfferedData(),
        readCurriculumData(),
        readGraphData(),
        readStudent(),
        readRegistrationStatus(),
        readHighlights(),
      ]);
      if (cancelled) return;
      setState({ offered, curriculum, graph, student, registration, highlights, loaded: true });
    })();

    // Subscribe to storage changes so UI live-updates after a background sync.
    const api = extApi();
    const host = api?.storage?.onChanged;
    if (!host || !('addListener' in host)) return () => { cancelled = true; };

    type Changes = Record<string, { newValue?: unknown }>;
    const listener = (changes: Changes, area: string) => {
      if (area !== 'local') return;
      setState((prev) => {
        const next = { ...prev };
        if (changes.aiubOfferedCourses)      next.offered = (changes.aiubOfferedCourses.newValue as OfferedData) ?? null;
        if (changes.aiubCurriculum)           next.curriculum = (changes.aiubCurriculum.newValue as CurriculumData) ?? null;
        if (changes.aiubGraphData)            next.graph = (changes.aiubGraphData.newValue as AiubGraphData) ?? null;
        if (changes.aiubStudent)              next.student = (changes.aiubStudent.newValue as AiubStudent) ?? null;
        if (changes.aiubRegistrationStatus)   next.registration = (changes.aiubRegistrationStatus.newValue as RegistrationStatus) ?? null;
        if (changes.aiubHighlights)           next.highlights = (changes.aiubHighlights.newValue as Highlights) ?? null;
        return next;
      });
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (host as any).addListener(listener);
    return () => {
      cancelled = true;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const remove = (host as any).removeListener;
      if (typeof remove === 'function') remove.call(host, listener);
    };
  }, []);

  return state;
}
