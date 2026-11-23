import { CalendarDays } from 'lucide-react';
import { useState } from 'react';
import { useAppDispatch, useAppSelector } from '@/store';
import { PRESETS, setCustomRange, setPreset } from '@/store/slices/filterSlice';

/** Global date filter (spec 7.4): presets plus a custom from/to range, stored in Redux and used by every analytics page. */
export function DateFilter() {
  const f = useAppSelector((s) => s.filters);
  const dispatch = useAppDispatch();
  const [from, setFrom] = useState(f.from ?? '');
  const [to, setTo] = useState(f.to ?? '');
  const invalid = !!from && !!to && from > to;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative">
        <CalendarDays className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
        <select aria-label="Date range" className="input !w-auto !pl-8" value={f.preset} onChange={(e) => dispatch(setPreset(e.target.value))}>
          {PRESETS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
        </select>
      </div>
      {f.preset === 'custom' && (
        <>
          <input type="date" aria-label="From date" className="input !w-auto" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} />
          <span className="text-muted">to</span>
          <input type="date" aria-label="To date" className="input !w-auto" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} />
          <button className="btn-primary" disabled={!from || !to || invalid} onClick={() => dispatch(setCustomRange({ from, to }))}>Apply</button>
        </>
      )}
    </div>
  );
}
