import * as d3 from 'd3';
import { useState } from 'react';
import { shortDate } from '@/utils/format';
import { ChartFrame, COLORS, compact, Legend, Tooltip, useSize, type TipState } from './shared';

export interface Series { key: string; label: string; color?: string }
interface Props {
  data: Record<string, any>[]; xKey?: string; series: Series[]; area?: boolean; height?: number;
  format?: (n: number) => string; yLabel?: string; xLabel?: string; loading?: boolean; xFormat?: (s: string) => string;
}

/** Line / area chart (D3 scales + paths, React rendering) with hover crosshair and tooltip. */
export function LineChart({ data, xKey = 'date', series, area, height = 280, format = compact, yLabel, xLabel, loading, xFormat = shortDate }: Props) {
  const { ref, width } = useSize<HTMLDivElement>(height);
  const [tip, setTip] = useState<TipState | null>(null);
  const [hover, setHover] = useState<number | null>(null);
  const m = { top: 12, right: 16, bottom: xLabel ? 44 : 28, left: yLabel ? 62 : 48 };
  const w = Math.max(0, width - m.left - m.right), h = height - m.top - m.bottom;
  const empty = !data.length || data.every((d) => series.every((s) => !Number(d[s.key])));

  const x = d3.scalePoint<string>().domain(data.map((d) => String(d[xKey]))).range([0, w]).padding(0.1);
  const maxY = d3.max(data, (d) => d3.max(series, (s) => Number(d[s.key]) || 0)) ?? 0;
  const y = d3.scaleLinear().domain([0, maxY || 1]).nice().range([h, 0]);
  const color = (s: Series, i: number) => s.color ?? COLORS[i % COLORS.length];
  const ticks = x.domain().filter((_, i, a) => i % Math.max(1, Math.ceil(a.length / Math.max(2, Math.floor(w / 70)))) === 0);

  const onMove = (e: React.MouseEvent<SVGRectElement>) => {
    const box = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - box.left;
    let i = 0, best = Infinity;
    data.forEach((row, k) => { const dist = Math.abs((x(String(row[xKey])) ?? 0) - px); if (dist < best) { best = dist; i = k; } });
    const d = data[i];
    if (!d) return;
    setHover(i);
    setTip({
      x: (x(String(d[xKey])) ?? 0) + m.left, y: m.top + y(Math.max(...series.map((s) => Number(d[s.key]) || 0))),
      content: (<div><div className="mb-1 font-semibold">{xFormat(String(d[xKey]))}</div>{series.map((s, k) => (
        <div key={s.key} className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: color(s, k) }} />{s.label}: {format(Number(d[s.key]) || 0)}</div>))}</div>),
    });
  };

  return (
    <ChartFrame loading={loading} empty={empty} height={height}>
      <div ref={ref} className="relative w-full" style={{ height }}>
        {width > 0 && (
          <svg width={width} height={height} role="img" aria-label={`${series.map((s) => s.label).join(', ')} over time`}>
            <g transform={`translate(${m.left},${m.top})`}>
              {y.ticks(5).map((t) => (
                <g key={t} transform={`translate(0,${y(t)})`}><line x2={w} stroke="#e5e7eb" strokeDasharray="3 3" /><text x={-8} dy="0.32em" textAnchor="end" fontSize={11} fill="#64748b">{format(t)}</text></g>
              ))}
              {ticks.map((t) => <text key={t} x={x(t)} y={h + 18} textAnchor="middle" fontSize={11} fill="#64748b">{xFormat(t)}</text>)}
              {series.map((s, i) => {
                const pts = data.map((d) => [x(String(d[xKey])) ?? 0, y(Number(d[s.key]) || 0)] as [number, number]);
                const line = d3.line().curve(d3.curveMonotoneX)(pts) ?? '';
                const a = d3.area<[number, number]>().x((p) => p[0]).y0(h).y1((p) => p[1]).curve(d3.curveMonotoneX)(pts) ?? '';
                return (
                  <g key={s.key}>
                    {area && i === 0 && <path d={a} fill={color(s, i)} opacity={0.12} />}
                    <path d={line} fill="none" stroke={color(s, i)} strokeWidth={2.25} strokeLinecap="round" />
                    {hover !== null && pts[hover] && <circle cx={pts[hover][0]} cy={pts[hover][1]} r={4.5} fill="#fff" stroke={color(s, i)} strokeWidth={2.25} />}
                  </g>
                );
              })}
              {hover !== null && data[hover] && <line x1={x(String(data[hover][xKey]))} x2={x(String(data[hover][xKey]))} y1={0} y2={h} stroke="#94a3b8" strokeDasharray="3 3" />}
              <rect width={w} height={h} fill="transparent" onMouseMove={onMove} onMouseLeave={() => { setTip(null); setHover(null); }} />
              {yLabel && <text transform={`translate(${-48},${h / 2}) rotate(-90)`} textAnchor="middle" fontSize={11} fill="#64748b">{yLabel}</text>}
              {xLabel && <text x={w / 2} y={h + 38} textAnchor="middle" fontSize={11} fill="#64748b">{xLabel}</text>}
            </g>
          </svg>
        )}
        <Tooltip tip={tip} />
      </div>
      {series.length > 1 && <Legend items={series.map((s, i) => ({ label: s.label, color: color(s, i) }))} />}
    </ChartFrame>
  );
}
