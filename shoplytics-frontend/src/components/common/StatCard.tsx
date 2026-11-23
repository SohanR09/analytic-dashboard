import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';
import type { ReactNode } from 'react';
import { useAnimatedNumber } from '@/hooks/useAnimatedNumber';
import { pct } from '@/utils/format';
import { Skeleton, cx } from './ui';

interface Props { title: string; value: number; format: (n: number) => string; change?: number | null; icon?: ReactNode; loading?: boolean; hint?: string; invert?: boolean }

/** Stat card with a count-up value and a growth chip. `change === null` means "no baseline" and renders a dash. */
export function StatCard({ title, value, format, change, icon, loading, hint, invert }: Props) {
  const shown = useAnimatedNumber(value);
  if (loading) return <div className="card p-5"><Skeleton className="h-4 w-24" /><Skeleton className="mt-4 h-8 w-32" /><Skeleton className="mt-3 h-4 w-20" /></div>;
  const good = change === null || change === undefined ? null : invert ? change < 0 : change > 0;
  const Arrow = change === null || change === undefined || change === 0 ? Minus : change > 0 ? ArrowUpRight : ArrowDownRight;
  return (
    <div className="card p-5">
      <div className="flex items-center justify-between"><p className="text-sm font-medium text-muted">{title}</p>{icon && <span className="rounded-lg bg-lightblue p-2 text-primary">{icon}</span>}</div>
      <p className="mt-3 text-2xl font-bold tracking-tight">{format(shown)}</p>
      <div className="mt-2 flex items-center gap-2 text-xs">
        {change !== undefined && (
          <span className={cx('inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 font-semibold', good === null || change === 0 ? 'bg-slate-100 text-slate-600' : good ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700')}>
            {change !== null && <Arrow className="h-3 w-3" />}{pct(change)}
          </span>
        )}
        <span className="text-muted">{hint ?? (change !== undefined ? 'vs previous period' : '')}</span>
      </div>
    </div>
  );
}
