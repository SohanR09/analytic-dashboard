import { RotateCcw } from 'lucide-react';
import { useBusiness } from '@/hooks/useBusiness';
import { useFetch } from '@/hooks/useFetch';
import { businessService } from '@/services/business.service';
import { productService } from '@/services/resources.service';
import { useAppDispatch, useAppSelector } from '@/store';
import { resetFilters, setFilter } from '@/store/slices/filterSlice';

const STATUSES = ['PENDING', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'REFUNDED'];

/** Product / category / order-status filters (spec: filter slice). Dates are in the top bar. */
export function AnalyticsFilters({ status }: { status?: boolean }) {
  const { id } = useBusiness();
  const f = useAppSelector((s) => s.filters);
  const dispatch = useAppDispatch();
  const cats = useFetch(() => businessService.categories.list(id), [id]);
  const prods = useFetch(() => productService.list(id, { limit: 100, sortBy: 'name', order: 'asc' }), [id]);
  const active = f.productId || f.categoryId || f.orderStatus;
  return (
    <div className="mb-5 flex flex-wrap items-center gap-2">
      <select aria-label="Category" className="input !w-auto" value={f.categoryId ?? ''} onChange={(e) => dispatch(setFilter({ categoryId: e.target.value || undefined }))}>
        <option value="">All categories</option>{cats.data?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
      </select>
      <select aria-label="Product" className="input !w-auto max-w-[220px]" value={f.productId ?? ''} onChange={(e) => dispatch(setFilter({ productId: e.target.value || undefined }))}>
        <option value="">All products</option>{prods.data?.items.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
      </select>
      {status && (
        <select aria-label="Order status" className="input !w-auto" value={f.orderStatus ?? ''} onChange={(e) => dispatch(setFilter({ orderStatus: e.target.value || undefined }))}>
          <option value="">All statuses</option>{STATUSES.map((s) => <option key={s} value={s}>{s[0] + s.slice(1).toLowerCase()}</option>)}
        </select>
      )}
      {active && <button className="btn-ghost" onClick={() => dispatch(resetFilters())}><RotateCcw className="h-4 w-4" />Reset</button>}
    </div>
  );
}
