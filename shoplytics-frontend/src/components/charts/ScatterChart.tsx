import * as d3 from 'd3';
import { useState } from 'react';
import { ChartFrame, compact, Tooltip, useSize, type TipState } from './shared';

interface Pt { label: string; x: number; y: number }
interface Props { data: Pt[]; xLabel: string; yLabel: string; height?: number; xFormat?: (n: number) => string; yFormat?: (n: number) => string; loading?: boolean }

/** Scatter plot, e.g. orders (x) vs lifetime spend (y) per customer. */
export function ScatterChart({ data, xLabel, yLabel, height = 300, xFormat = compact, yFormat = compact, loading }: Props) {
  const { ref, width } = useSize<HTMLDivElement>(height);
  const [tip, setTip] = useState<TipState | null>(null);
  const m = { top: 12, right: 16, bottom: 46, left: 64 };
  const w = Math.max(0, width - m.left - m.right), h = height - m.top - m.bottom;
  const x = d3.scaleLinear().domain([0, d3.max(data, (d) => d.x) || 1]).nice().range([0, w]);
  const y = d3.scaleLinear().domain([0, d3.max(data, (d) => d.y) || 1]).nice().range([h, 0]);
  return (
    <ChartFrame loading={loading} empty={!data.length} height={height}>
      <div ref={ref} className="relative w-full" style={{ height }}>
        {width > 0 && (
          <svg width={width} height={height} role="img" aria-label={`${yLabel} versus ${xLabel}`}>
            <g transform={`translate(${m.left},${m.top})`}>
              {y.ticks(5).map((t) => <g key={t} transform={`translate(0,${y(t)})`}><line x2={w} stroke="#e5e7eb" strokeDasharray="3 3" /><text x={-8} dy="0.32em" textAnchor="end" fontSize={11} fill="#64748b">{yFormat(t)}</text></g>)}
              {x.ticks(Math.max(3, Math.floor(w / 80))).map((t) => <text key={t} x={x(t)} y={h + 16} textAnchor="middle" fontSize={11} fill="#64748b">{xFormat(t)}</text>)}
              {data.map((d, i) => (
                <circle key={i} cx={x(d.x)} cy={y(d.y)} r={6} fill="var(--chart-2)" fillOpacity={0.75} stroke="var(--chart-1)" strokeWidth={1.25}
                  onMouseMove={(e) => { const b = (e.currentTarget.closest('div') as HTMLElement).getBoundingClientRect(); setTip({ x: e.clientX - b.left, y: e.clientY - b.top, content: <div><div className="font-semibold">{d.label}</div><div>{xLabel}: {xFormat(d.x)}</div><div>{yLabel}: {yFormat(d.y)}</div></div> }); }}
                  onMouseLeave={() => setTip(null)} />
              ))}
              <text x={w / 2} y={h + 38} textAnchor="middle" fontSize={11} fill="#64748b">{xLabel}</text>
              <text transform={`translate(${-50},${h / 2}) rotate(-90)`} textAnchor="middle" fontSize={11} fill="#64748b">{yLabel}</text>
            </g>
          </svg>
        )}
        <Tooltip tip={tip} />
      </div>
    </ChartFrame>
  );
}
