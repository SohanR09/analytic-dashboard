import { Bell, PackageX, TriangleAlert } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useBusiness } from '@/hooks/useBusiness';
import { useFetch } from '@/hooks/useFetch';
import { inventoryService } from '@/services/resources.service';
import { STOCK_CHANGED } from '@/services/api';
import { StockBadge } from '@/components/common/ui';

const POLL_MS = 60_000;
const SHOWN = 8;

/**
 * Stock alerts, derived from live inventory: out-of-stock first, then low stock.
 * Not pushed by the server: it refreshes when the dropdown opens, after any stock-affecting write
 * in this tab (see STOCK_CHANGED in api.ts), when the tab regains focus, and every minute while visible.
 */
export function Notifications() {
  const { id } = useBusiness();
  const { data, reload } = useFetch(async () => {
    const q = { page: 1, limit: SHOWN, sortBy: 'stockQuantity', order: 'asc' };
    const [out, low] = await Promise.all([
      inventoryService.list(id, { ...q, status: 'OUT_OF_STOCK' }),
      inventoryService.list(id, { ...q, status: 'LOW_STOCK' }),
    ]);
    return { items: [...out.items, ...low.items].slice(0, SHOWN), out: out.meta.total, low: low.meta.total };
  }, [id]);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const h = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  // Keep it fresh: writes in this tab, returning to the tab, and a slow poll while visible.
  useEffect(() => {
    const refresh = () => { if (document.visibilityState === 'visible') void reload(); };
    window.addEventListener(STOCK_CHANGED, refresh);
    document.addEventListener('visibilitychange', refresh);
    const t = window.setInterval(refresh, POLL_MS);
    return () => {
      window.removeEventListener(STOCK_CHANGED, refresh);
      document.removeEventListener('visibilitychange', refresh);
      window.clearInterval(t);
    };
  }, [reload]);

  const items = data?.items ?? [];
  const total = (data?.out ?? 0) + (data?.low ?? 0);
  const toggle = () => setOpen((o) => { if (!o) void reload(); return !o; });

  return (
    <div className="relative" ref={ref}>
      <button className="btn-ghost relative !p-2" onClick={toggle} aria-label={`Stock alerts (${total})`}>
        <Bell className="h-5 w-5" />
        {total > 0 && <span className={`absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold ${data?.out ? 'bg-danger text-white' : 'bg-secondary text-primary-dark'}`}>{total > 9 ? '9+' : total}</span>}
      </button>
      {open && (
        <div className="card absolute right-0 z-30 mt-2 w-80 overflow-hidden">
          <div className="flex items-center justify-between border-b border-line px-4 py-3 text-sm">
            <span className="font-semibold">Stock alerts</span>
            {total > 0 && <span className="text-xs text-muted">{data?.out ? `${data.out} out · ` : ''}{data?.low ?? 0} low</span>}
          </div>
          <div className="max-h-80 divide-y divide-line overflow-y-auto">
            {items.length === 0 && <p className="px-4 py-6 text-center text-sm text-muted">All products are well stocked.</p>}
            {items.map((p) => (
              <Link key={p.id} to={`/businesses/${id}/inventory`} onClick={() => setOpen(false)} className="flex items-center gap-3 px-4 py-3 hover:bg-lightblue/50">
                {p.status === 'OUT_OF_STOCK' ? <PackageX className="h-4 w-4 shrink-0 text-danger" /> : <TriangleAlert className="h-4 w-4 shrink-0 text-warn" />}
                <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{p.name}</span><span className="text-xs text-muted">{p.stockQuantity} left (min {p.minimumStockLevel})</span></span>
                <StockBadge s={p.status} />
              </Link>
            ))}
          </div>
          {total > items.length && (
            <Link to={`/businesses/${id}/inventory`} onClick={() => setOpen(false)} className="block border-t border-line px-4 py-2.5 text-center text-sm font-medium text-primary hover:bg-lightblue/50">
              View all {total} in Inventory
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
