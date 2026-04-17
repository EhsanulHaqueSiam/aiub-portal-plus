import { useEffect, useRef, type ReactNode } from 'react';
import type { ChartConfiguration } from 'chart.js';

type Props = {
  config: ChartConfiguration;
  height?: number;
  className?: string;
  /** Required plain-language description of what the chart shows.
   *  Announced to screen readers via aria-label on the <canvas>. */
  ariaLabel: string;
  /** Optional fallback content rendered inside the <canvas>. Screen
   *  readers use it when canvas is the accessibility fallback region —
   *  a good place for an sr-only <table> with the chart's raw data. */
  fallbackTable?: ReactNode;
};

/* Thin React wrapper around Chart.js. Accepts a config, mounts on a canvas,
   tears down on unmount or when the config identity changes. The consumer
   should memoize the config so we don't remount on every render. */
export function ChartCanvas({ config, height = 300, className, ariaLabel, fallbackTable }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    let chart: { destroy(): void } | null = null;

    (async () => {
      const { default: Chart } = await import('chart.js/auto');
      if (cancelled || !canvasRef.current) return;

      /* Honor prefers-reduced-motion — Chart.js animates via canvas paint,
         so the global CSS rule can't reach it. Disable chart animation
         directly when the user has requested reduced motion. */
      const reduceMotion = typeof window !== 'undefined'
        && typeof window.matchMedia === 'function'
        && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      const effectiveConfig = reduceMotion
        ? { ...config, options: { ...(config.options ?? {}), animation: false as const } }
        : config;

      chart = new Chart(canvasRef.current, effectiveConfig);
    })();

    return () => {
      cancelled = true;
      chart?.destroy();
    };
  }, [config]);

  return (
    <div className={className ?? 'relative'} style={{ height }}>
      <canvas ref={canvasRef} role="img" aria-label={ariaLabel}>
        {fallbackTable}
      </canvas>
    </div>
  );
}
