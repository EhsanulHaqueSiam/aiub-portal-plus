import { useEffect, useState } from 'react';
import { readGraphData, readStudent, onStorageChanged, type AiubGraphData, type AiubStudent } from '@/lib/graphData';

export function useGraphData() {
  const [data, setData] = useState<AiubGraphData | null>(null);
  const [student, setStudent] = useState<AiubStudent | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [g, s] = await Promise.all([readGraphData(), readStudent()]);
      if (cancelled) return;
      setData(g);
      setStudent(s);
      setLoaded(true);
    })();
    const off = onStorageChanged((changes, area) => {
      if (area !== 'local') return;
      if (changes.aiubGraphData) setData((changes.aiubGraphData.newValue as AiubGraphData) ?? null);
      if (changes.aiubStudent) setStudent((changes.aiubStudent.newValue as AiubStudent) ?? null);
    });
    return () => { cancelled = true; off(); };
  }, []);

  return { data, student, loaded };
}
