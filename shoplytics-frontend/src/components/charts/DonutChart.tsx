import * as d3 from 'd3';
import { useState, type ReactNode } from 'react';
import { ChartFrame, COLORS, Legend, Tooltip, useSize, type TipState } from './shared';

interface Props { data: { label: string; value: number }[]; height?: number; donut?: boolean; center?: ReactNode; format?: (n: number) => string; loading?: boolean }

/** Donut (default) or pie chart with hover highlight. */
export function DonutChart({ data, height = 240, donut = true, center, format = (n) => String(n), loading }: Props) {
  const { ref, width } = useSize<HTMLDivElement>(height);
  const [tip, setTip] = useState<TipState | null>(null);
  const [active, setActive] = useState<number | null>(null);
  const items = data.filter((d) => d.value > 0);
  const total = d3.sum(items, (d) => d.value);
  const r = Math.max(0, Math.min(width, height) / 2 - 8);
  const arcs = d3.pie<{ label: string; value: number }>().value((d) => d.value).sort(null).padAngle(0.015)(items);
  const arc = d3.arc<d3.PieArcDatum<{ label: string; value: number }>>().innerRadius(donut ? r * 0.62 : 0).outerRadius(r).cornerRadius(3);
  const hot = d3.arc<d3.PieArcDatum<{ label: string; value: number }>>().innerRadius(donut ? r * 0.62 : 0).outerRadius(r + 5).cornerRadius(3);
  return (
    <ChartFrame loading={loading} empty={!items.length} height={height}>
      <div ref={ref} className="relative w-full" style={{ height }}>
        {width > 0 && (
          <svg width={width} height={height} role="img" aria-label={donut ? 'Donut chart' : 'Pie chart'}>
            <g transform={`translate(${width / 2},${height / 2})`}>
              {arcs.map((a, i) => (
                <path key={a.data.label} d={(active === i ? hot : arc)(a) ?? ''} fill={COLORS[i % COLORS.length]}
                  onMouseMove={(e) => { const b = (e.currentTarget.closest('div') as HTMLElement).getBoundingClientRect(); setActive(i); setTip({ x: e.clientX - b.left, y: e.clientY - b.top, content: <div><div className="font-semibold">{a.data.label}</div><div>{format(a.data.value)} ({((a.data.value / total) * 100).toFixed(1)}%)</div></div> }); }}
                  onMouseLeave={() => { setActive(null); setTip(null); }} />
              ))}
            </g>
          </svg>
        )}
        {donut && center && <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">{center}</div>}
        <Tooltip tip={tip} />
      </div>
      <Legend items={items.map((d, i) => ({ label: d.label, color: COLORS[i % COLORS.length] }))} />
    </ChartFrame>
  );
}
