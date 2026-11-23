import * as d3 from 'd3';
import { useState } from 'react';
import { ChartFrame, COLORS, compact, Legend, Tooltip, useSize, type TipState } from './shared';
import type { Series } from './LineChart';

interface Props {
  data: Record<string, any>[]; xKey: string; series: Series[]; stacked?: boolean; height?: number;
  format?: (n: number) => string; xFormat?: (s: string) => string; loading?: boolean; yLabel?: string; xLabel?: string;
}

/** Vertical bar chart: grouped by default, `stacked` for category comparisons. */
export function BarChart({ data, xKey, series, stacked, height = 280, format = compact, xFormat = (s) => s, loading, yLabel, xLabel }: Props) {
  const { ref, width } = useSize<HTMLDivElement>(height);
  const [tip, setTip] = useState<TipState | null>(null);
  const m = { top: 12, right: 12, bottom: xLabel ? 56 : 40, left: yLabel ? 62 : 48 };
  const w = Math.max(0, width - m.left - m.right), h = height - m.top - m.bottom;
  const x0 = d3.scaleBand<string>().domain(data.map((d) => String(d[xKey]))).range([0, w]).padding(0.25);
  const x1 = d3.scaleBand<string>().domain(series.map((s) => s.key)).range([0, x0.bandwidth()]).padding(0.08);
  const maxY = stacked ? d3.max(data, (d) => d3.sum(series, (s) => Number(d[s.key]) || 0)) ?? 0 : d3.max(data, (d) => d3.max(series, (s) => Number(d[s.key]) || 0)) ?? 0;
  const y = d3.scaleLinear().domain([0, maxY || 1]).nice().range([h, 0]);
  const color = (s: Series, i: number) => s.color ?? COLORS[i % COLORS.length];
  const show = (e: React.MouseEvent, d: Record<string, any>) => {
    const box = (e.currentTarget.closest('div') as HTMLElement).getBoundingClientRect();
    setTip({ x: e.clientX - box.left, y: e.clientY - box.top, content: (<div><div className="mb-1 font-semibold">{xFormat(String(d[xKey]))}</div>{series.map((s, k) => (
      <div key={s.key} className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: color(s, k) }} />{s.label}: {format(Number(d[s.key]) || 0)}</div>))}</div>) });
  };
  const maxLabels = Math.max(2, Math.floor(w / 64));
  const every = Math.ceil(data.length / maxLabels);

  return (
    <ChartFrame loading={loading} empty={!data.length || maxY === 0} height={height}>
      <div ref={ref} className="relative w-full" style={{ height }}>
        {width > 0 && (
          <svg width={width} height={height} role="img" aria-label="Bar chart">
            <g transform={`translate(${m.left},${m.top})`}>
              {y.ticks(5).map((t) => <g key={t} transform={`translate(0,${y(t)})`}><line x2={w} stroke="#e5e7eb" strokeDasharray="3 3" /><text x={-8} dy="0.32em" textAnchor="end" fontSize={11} fill="#64748b">{format(t)}</text></g>)}
              {data.map((d, di) => {
                const key = String(d[xKey]);
                let acc = 0;
                return (
                  <g key={key} transform={`translate(${x0(key)},0)`} onMouseMove={(e) => show(e, d)} onMouseLeave={() => setTip(null)}>
                    <rect width={x0.bandwidth()} height={h} fill="transparent" />
                    {series.map((s, i) => {
                      const v = Number(d[s.key]) || 0;
                      if (stacked) { const top = y(acc + v); const bar = <rect key={s.key} x={0} width={x0.bandwidth()} y={top} height={Math.max(0, y(acc) - top)} fill={color(s, i)} />; acc += v; return bar; }
                      return <rect key={s.key} x={x1(s.key)} width={x1.bandwidth()} y={y(v)} height={Math.max(0, h - y(v))} rx={3} fill={color(s, i)} />;
                    })}
                    {di % every === 0 && <text x={x0.bandwidth() / 2} y={h + 16} textAnchor="middle" fontSize={11} fill="#64748b">{xFormat(key).slice(0, 12)}</text>}
                  </g>
                );
              })}
              {yLabel && <text transform={`translate(${-48},${h / 2}) rotate(-90)`} textAnchor="middle" fontSize={11} fill="#64748b">{yLabel}</text>}
              {xLabel && <text x={w / 2} y={h + 40} textAnchor="middle" fontSize={11} fill="#64748b">{xLabel}</text>}
            </g>
          </svg>
        )}
        <Tooltip tip={tip} />
      </div>
      {series.length > 1 && <Legend items={series.map((s, i) => ({ label: s.label, color: color(s, i) }))} />}
    </ChartFrame>
  );
}
