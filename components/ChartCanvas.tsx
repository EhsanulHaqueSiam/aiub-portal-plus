import { useEffect, useRef } from 'react';
import type { ChartConfiguration } from 'chart.js';

type Props = {
  config: ChartConfiguration;
  height?: number;
  className?: string;
};

/* Thin React wrapper around Chart.js. Accepts a config, mounts on a canvas,
   tears down on unmount or when the config identity changes. The consumer
   should memoize the config so we don't remount on every render. */
export function ChartCanvas({ config, height = 300, className }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    let chart: { destroy(): void } | null = null;

    (async () => {
      const { default: Chart } = await import('chart.js/auto');
      if (cancelled || !canvasRef.current) return;
      chart = new Chart(canvasRef.current, config);
    })();

    return () => {
      cancelled = true;
      chart?.destroy();
    };
  }, [config]);

  return (
    <div className={className ?? 'relative'} style={{ height }}>
      <canvas ref={canvasRef} />
    </div>
  );
}
