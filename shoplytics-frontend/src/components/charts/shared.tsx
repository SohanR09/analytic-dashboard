import { useEffect, useState, type ReactNode } from 'react';
import { EmptyState, Skeleton } from '@/components/common/ui';

export const COLORS = ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)', 'var(--chart-5)', 'var(--chart-6)'];

/** Tracks the width of a container so charts redraw responsively. */
export function useSize<T extends HTMLElement>(height: number) {
  // Callback ref + state: the chart container is mounted only after loading finishes, so an effect run at
  // mount time would miss it (and the chart would stay 0px wide).
  const [el, setEl] = useState<T | null>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    if (!el) return;
    setWidth(el.clientWidth);
    const ro = new ResizeObserver(([e]) => setWidth(Math.floor(e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, [el]);
  return { ref: setEl, width, height };
}

export interface TipState { x: number; y: number; content: ReactNode }
export function Tooltip({ tip }: { tip: TipState | null }) {
  if (!tip) return null;
  return (
    <div className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-lg bg-primary-dark px-3 py-2 text-xs text-white shadow-lg" style={{ left: tip.x, top: tip.y - 8 }}>
      {tip.content}
    </div>
  );
}

/** Wraps a chart with the loading / empty states every chart needs. */
export function ChartFrame({ loading, empty, height, children, emptyText = 'No data for this period' }: {
  loading?: boolean; empty?: boolean; height: number; children: ReactNode; emptyText?: string;
}) {
  if (loading) return <Skeleton className="w-full" />;
  if (empty) return <div style={{ minHeight: height }} className="flex items-center justify-center"><EmptyState title={emptyText} /></div>;
  return <>{children}</>;
}

export const Legend = ({ items }: { items: { label: string; color: string }[] }) => (
  <ul className="mt-2 flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs text-muted">
    {items.map((i) => (
      <li key={i.label} className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ background: i.color }} />{i.label}</li>
    ))}
  </ul>
);

export const compact = (n: number) => new Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 1 }).format(n);
