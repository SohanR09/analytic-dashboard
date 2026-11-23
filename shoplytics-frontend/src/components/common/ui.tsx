import { AlertTriangle, ChevronLeft, ChevronRight, Inbox, Loader2, X } from 'lucide-react';
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import type { OrderStatus, PageMeta, PaymentStatus, Segment, StockStatus } from '@/types';
import { titleCase } from '@/utils/format';

export const cx = (...a: (string | false | null | undefined)[]) => a.filter(Boolean).join(' ');

export const Spinner = ({ className }: { className?: string }) => <Loader2 className={cx('h-4 w-4 animate-spin', className)} aria-label="Loading" />;
export const Skeleton = ({ className }: { className?: string }) => <div className={cx('animate-pulse rounded-lg bg-lightblue', className)} />;
export const FullPageSpinner = () => (
  <div className="flex h-full min-h-[40vh] items-center justify-center text-primary"><Spinner className="h-7 w-7" /></div>
);

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div><h1 className="text-2xl font-bold tracking-tight">{title}</h1>{subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}</div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function EmptyState({ title, hint, action }: { title: string; hint?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-12 text-center">
      <div className="rounded-full bg-lightblue p-3 text-primary"><Inbox className="h-6 w-6" /></div>
      <p className="font-semibold">{title}</p>
      {hint && <p className="max-w-sm text-sm text-muted">{hint}</p>}
      {action}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="flex flex-col items-center justify-center gap-2 px-6 py-10 text-center">
      <div className="rounded-full bg-red-50 p-3 text-danger"><AlertTriangle className="h-6 w-6" /></div>
      <p className="font-semibold">Couldn't load this</p>
      <p className="max-w-md text-sm text-muted">{message}</p>
      {onRetry && <button className="btn-secondary mt-1" onClick={onRetry}>Try again</button>}
    </div>
  );
}

export function Alert({ kind = 'error', children }: { kind?: 'error' | 'success' | 'info'; children: ReactNode }) {
  const c = { error: 'border-red-200 bg-red-50 text-red-700', success: 'border-green-200 bg-green-50 text-green-700', info: 'border-blue-200 bg-lightblue text-primary' }[kind];
  return <div role={kind === 'error' ? 'alert' : 'status'} className={cx('rounded-lg border px-3 py-2 text-sm', c)}>{children}</div>;
}

const TONES = {
  gray: 'bg-slate-100 text-slate-700', blue: 'bg-blue-50 text-blue-700', green: 'bg-green-50 text-green-700',
  amber: 'bg-amber-50 text-amber-700', red: 'bg-red-50 text-red-700', pink: 'bg-softpink text-pink-700', navy: 'bg-primary text-white',
};
export const Badge = ({ tone = 'gray', children }: { tone?: keyof typeof TONES; children: ReactNode }) => (
  <span className={cx('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium', TONES[tone])}>{children}</span>
);
const ORDER_TONE: Record<OrderStatus, keyof typeof TONES> = { PENDING: 'amber', PROCESSING: 'blue', SHIPPED: 'blue', DELIVERED: 'green', CANCELLED: 'gray', REFUNDED: 'red' };
const PAY_TONE: Record<PaymentStatus, keyof typeof TONES> = { PENDING: 'amber', PAID: 'green', FAILED: 'red', PARTIALLY_REFUNDED: 'pink', REFUNDED: 'red' };
export const OrderBadge = ({ s }: { s: OrderStatus }) => <Badge tone={ORDER_TONE[s]}>{titleCase(s)}</Badge>;
export const PaymentBadge = ({ s }: { s: PaymentStatus }) => <Badge tone={PAY_TONE[s]}>{titleCase(s)}</Badge>;
export const StockBadge = ({ s }: { s: StockStatus }) => <Badge tone={s === 'IN_STOCK' ? 'green' : s === 'LOW_STOCK' ? 'amber' : 'red'}>{titleCase(s)}</Badge>;
export const SegmentBadge = ({ s }: { s: Segment }) => <Badge tone={s === 'HIGH_VALUE' ? 'pink' : s === 'REGULAR' ? 'blue' : 'gray'}>{titleCase(s)}</Badge>;

export function Modal({ open, title, onClose, children, wide }: { open: boolean; title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    ref.current?.querySelector<HTMLElement>('input,select,textarea,button')?.focus();
    return () => { document.removeEventListener('keydown', onKey); prev?.focus(); };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-primary-dark/40 p-4 sm:items-center" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={ref} role="dialog" aria-modal="true" aria-label={title} className={cx('card w-full p-6', wide ? 'max-w-2xl' : 'max-w-md')}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button className="btn-ghost !p-1.5" onClick={onClose} aria-label="Close"><X className="h-4 w-4" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function ConfirmDialog({ open, title, message, confirmLabel = 'Delete', onConfirm, onClose, busy }: {
  open: boolean; title: string; message: ReactNode; confirmLabel?: string; onConfirm: () => void; onClose: () => void; busy?: boolean;
}) {
  return (
    <Modal open={open} title={title} onClose={onClose}>
      <p className="text-sm text-muted">{message}</p>
      <div className="mt-6 flex justify-end gap-2">
        <button className="btn-secondary" onClick={onClose}>Cancel</button>
        <button className="btn-danger" onClick={onConfirm} disabled={busy}>{busy && <Spinner />}{confirmLabel}</button>
      </div>
    </Modal>
  );
}

export function Pagination({ meta, onPage }: { meta: PageMeta; onPage: (p: number) => void }) {
  if (meta.total === 0) return null;
  const from = (meta.page - 1) * meta.limit + 1;
  const to = Math.min(meta.total, meta.page * meta.limit);
  return (
    <div className="flex items-center justify-between border-t border-line px-4 py-3 text-sm text-muted">
      <span>{from}–{to} of {meta.total}</span>
      <div className="flex items-center gap-1">
        <button className="btn-ghost !p-1.5" disabled={meta.page <= 1} onClick={() => onPage(meta.page - 1)} aria-label="Previous page"><ChevronLeft className="h-4 w-4" /></button>
        <span className="px-2">Page {meta.page} / {meta.totalPages}</span>
        <button className="btn-ghost !p-1.5" disabled={meta.page >= meta.totalPages} onClick={() => onPage(meta.page + 1)} aria-label="Next page"><ChevronRight className="h-4 w-4" /></button>
      </div>
    </div>
  );
}

/** Table shell with loading / error / empty handling so every list page behaves the same. */
export function DataTable<T>({ columns, rows, loading, error, onRetry, empty, rowKey, onRowClick, meta, onPage }: {
  columns: { header: string; cell: (r: T) => ReactNode; className?: string }[];
  rows: T[] | undefined; loading?: boolean; error?: string | null; onRetry?: () => void; empty?: ReactNode;
  rowKey: (r: T) => string; onRowClick?: (r: T) => void; meta?: PageMeta; onPage?: (p: number) => void;
}) {
  return (
    <div className="card overflow-hidden">
      {error && !rows ? <ErrorState message={error} onRetry={onRetry} /> : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px]">
              <thead className="border-b border-line bg-slate-50/60"><tr>{columns.map((c) => <th key={c.header} className={cx('th', c.className)}>{c.header}</th>)}</tr></thead>
              <tbody className={cx('divide-y divide-line transition-opacity', loading && rows && 'opacity-50')}>
                {!rows && loading && Array.from({ length: 6 }, (_, i) => (
                  <tr key={i}>{columns.map((c) => <td key={c.header} className="td"><Skeleton className="h-4 w-full" /></td>)}</tr>
                ))}
                {rows?.map((r) => (
                  <tr key={rowKey(r)} className={cx('hover:bg-lightblue/40', onRowClick && 'cursor-pointer')} onClick={() => onRowClick?.(r)}>
                    {columns.map((c) => <td key={c.header} className={cx('td', c.className)}>{c.cell(r)}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {rows && rows.length === 0 && (empty ?? <EmptyState title="Nothing here yet" />)}
          {meta && onPage && <Pagination meta={meta} onPage={onPage} />}
        </>
      )}
    </div>
  );
}

// ---- toasts ----
interface Toast { id: number; kind: 'success' | 'error'; text: string }
const ToastCtx = createContext<(kind: Toast['kind'], text: string) => void>(() => undefined);
export const useToast = () => useContext(ToastCtx);
export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);
  const push = useCallback((kind: Toast['kind'], text: string) => {
    const id = Date.now() + Math.random();
    setItems((x) => [...x, { id, kind, text }]);
    setTimeout(() => setItems((x) => x.filter((t) => t.id !== id)), 4500);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-[60] flex w-80 max-w-[calc(100vw-2rem)] flex-col gap-2" aria-live="polite">
        {items.map((t) => (
          <div key={t.id} className={cx('pointer-events-auto rounded-lg border px-4 py-3 text-sm shadow-card', t.kind === 'success' ? 'border-green-200 bg-green-50 text-green-800' : 'border-red-200 bg-red-50 text-red-800')}>{t.text}</div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

// ---- form fields ----
export function Field({ label, error, children, hint }: { label: string; error?: string; children: ReactNode; hint?: string }) {
  return (
    <div>
      <label className="label">{label}</label>
      {children}
      {hint && !error && <p className="mt-1 text-xs text-muted">{hint}</p>}
      {error && <p className="mt-1 text-xs text-danger" role="alert">{error}</p>}
    </div>
  );
}

export const Card = ({ title, action, children, className, pad = true }: { title?: ReactNode; action?: ReactNode; children: ReactNode; className?: string; pad?: boolean }) => (
  <section className={cx('card', className)}>
    {(title || action) && <header className="flex items-center justify-between gap-2 px-5 pt-4">{title && <h3 className="text-sm font-semibold">{title}</h3>}{action}</header>}
    <div className={cx(pad ? 'p-5' : '', title && pad ? '!pt-3' : '')}>{children}</div>
  </section>
);
