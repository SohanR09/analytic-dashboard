import * as d3 from 'd3';
import { useState } from 'react';
import { ChartFrame, compact, Tooltip, useSize, type TipState } from './shared';

interface Props { data: { label: string; value: number; sub?: string }[]; height?: number; format?: (n: number) => string; loading?: boolean; color?: string }

/** Horizontal bars for rankings such as top-selling products. Height grows with the number of rows. */
export function HBarChart({ data: raw, format = compact, loading, color = 'var(--chart-1)', height }: Props) {
  // A missing or non-numeric value would turn into a NaN bar and pile its label on top of the name.
  const data = raw.map((d) => ({ ...d, value: Number.isFinite(d.value) ? d.value : 0 }));
  const rowH = 34;
  const H = height ?? Math.max(120, data.length * rowH + 24);
  const { ref, width } = useSize<HTMLDivElement>(H);
  const [tip, setTip] = useState<TipState | null>(null);
  const labelW = Math.min(150, Math.max(90, width * 0.3));
  const w = Math.max(0, width - labelW - 56);
  const x = d3.scaleLinear().domain([0, d3.max(data, (d) => d.value) || 1]).range([0, w]);
  return (
    <ChartFrame loading={loading} empty={!data.length} height={120}>
      <div ref={ref} className="relative w-full" style={{ height: H }}>
        {width > 0 && (
          <svg width={width} height={H} role="img" aria-label="Ranking bar chart">
            {data.map((d, i) => (
              <g key={d.label + i} transform={`translate(0,${i * rowH + 8})`}
                onMouseMove={(e) => { const b = (e.currentTarget.closest('div') as HTMLElement).getBoundingClientRect(); setTip({ x: e.clientX - b.left, y: e.clientY - b.top, content: <div><div className="font-semibold">{d.label}</div><div>{format(d.value)}{d.sub ? ` · ${d.sub}` : ''}</div></div> }); }}
                onMouseLeave={() => setTip(null)}>
                <rect width={width} height={rowH - 4} fill="transparent" />
                <text x={labelW - 8} y={(rowH - 4) / 2} dy="0.32em" textAnchor="end" fontSize={12} fill="currentColor">{d.label.length > 20 ? `${d.label.slice(0, 19)}…` : d.label}</text>
                <rect x={labelW} y={4} width={Math.max(2, x(d.value))} height={rowH - 12} rx={4} fill={color} />
                <text x={labelW + Math.max(2, x(d.value)) + 6} y={(rowH - 4) / 2} dy="0.32em" fontSize={11} fill="#64748b">{format(d.value)}</text>
              </g>
            ))}
          </svg>
        )}
        <Tooltip tip={tip} />
      </div>
    </ChartFrame>
  );
}
