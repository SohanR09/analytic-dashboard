import { Package, Pencil, Plus, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { SearchBar } from '@/components/common/SearchBar';
import { ConfirmDialog, DataTable, EmptyState, PageHeader, StockBadge, useToast } from '@/components/common/ui';
import { useBusiness } from '@/hooks/useBusiness';
import { useDebounce } from '@/hooks/useDebounce';
import { useFetch } from '@/hooks/useFetch';
import { businessService } from '@/services/business.service';
import { productService } from '@/services/resources.service';
import type { Product } from '@/types';
import { errorMessage, money, num } from '@/utils/format';
import { P } from '@/utils/permissions';
import { ProductModal } from './ProductForm';

export const stockOf = (p: Product) => (p.stockQuantity === 0 ? 'OUT_OF_STOCK' : p.stockQuantity <= p.minimumStockLevel ? 'LOW_STOCK' : 'IN_STOCK') as 'OUT_OF_STOCK' | 'LOW_STOCK' | 'IN_STOCK';

export default function Products() {
  const { id, currency, can } = useBusiness();
  const toast = useToast();
  const [search, setSearch] = useState('');
  const q = useDebounce(search);
  const [categoryId, setCategoryId] = useState('');
  const [sort, setSort] = useState('createdAt:desc');
  const [page, setPage] = useState(1);
  const [modal, setModal] = useState<{ open: boolean; product?: Product }>({ open: false });
  const [del, setDel] = useState<Product | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => setPage(1), [q, categoryId, sort]);
  const [sortBy, order] = sort.split(':');
  const cats = useFetch(() => businessService.categories.list(id), [id]);
  const { data, loading, error, reload } = useFetch(() => productService.list(id, { page, limit: 10, search: q, categoryId, sortBy, order }), [id, page, q, categoryId, sort]);

  const remove = async () => {
    if (!del) return;
    setBusy(true);
    try { await productService.remove(id, del.id); toast('success', 'Product deleted'); setDel(null); void reload(); } catch (e) { toast('error', errorMessage(e)); } finally { setBusy(false); }
  };
  return (
    <>
      <PageHeader title="Products" subtitle="Your catalog" actions={can(P.PRODUCT_CREATE) ? <button className="btn-primary" onClick={() => setModal({ open: true })}><Plus className="h-4 w-4" />Add product</button> : undefined} />
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <SearchBar value={search} onChange={setSearch} placeholder="Search name or SKU" />
        <select aria-label="Category" className="input !w-auto" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}><option value="">All categories</option>{cats.data?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
        <select aria-label="Sort" className="input !w-auto" value={sort} onChange={(e) => setSort(e.target.value)}>
          <option value="createdAt:desc">Newest first</option><option value="name:asc">Name A–Z</option><option value="price:desc">Price high → low</option><option value="price:asc">Price low → high</option>
        </select>
      </div>
      <DataTable rows={data?.items} loading={loading} error={error} onRetry={reload} rowKey={(p) => p.id} meta={data?.meta} onPage={setPage}
        empty={<EmptyState title="No products found" hint={search || categoryId ? 'Try clearing your filters.' : 'Add your first product to get started.'} action={can(P.PRODUCT_CREATE) && !search && !categoryId ? <button className="btn-primary mt-2" onClick={() => setModal({ open: true })}><Plus className="h-4 w-4" />Add product</button> : undefined} />}
        columns={[
          { header: 'Product', cell: (p) => (
            <Link to={`/businesses/${id}/products/${p.id}`} className="flex items-center gap-3">
              {p.image ? <img src={p.image} alt="" className="h-10 w-10 rounded-lg object-cover" /> : <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-lightblue text-primary"><Package className="h-5 w-5" /></span>}
              <span><span className="block font-medium text-primary hover:underline">{p.name}</span><span className="font-mono text-xs text-muted">{p.sku}</span></span>
            </Link>) },
          { header: 'Category', cell: (p) => p.category?.name ?? <span className="text-muted">Uncategorized</span> },
          { header: 'Price', cell: (p) => money(p.price, currency), className: 'text-right' },
          { header: 'Cost', cell: (p) => money(p.costPrice, currency), className: 'text-right' },
          { header: 'Stock', cell: (p) => num(p.stockQuantity), className: 'text-right' },
          { header: 'Status', cell: (p) => <StockBadge s={stockOf(p)} /> },
          ...(can(P.PRODUCT_UPDATE) || can(P.PRODUCT_DELETE) ? [{ header: '', className: 'text-right', cell: (p: Product) => (
            <div className="flex justify-end gap-1">
              {can(P.PRODUCT_UPDATE) && <button className="btn-ghost !p-2" aria-label={`Edit ${p.name}`} onClick={() => setModal({ open: true, product: p })}><Pencil className="h-4 w-4" /></button>}
              {can(P.PRODUCT_DELETE) && <button className="btn-ghost !p-2 hover:!text-danger" aria-label={`Delete ${p.name}`} onClick={() => setDel(p)}><Trash2 className="h-4 w-4" /></button>}
            </div>) }] : []),
        ]} />
      <ProductModal open={modal.open} product={modal.product} onClose={() => setModal({ open: false })} onSaved={() => { setModal({ open: false }); toast('success', 'Product saved'); void reload(); }} />
      <ConfirmDialog open={!!del} busy={busy} title="Delete product" message={<>Delete <b>{del?.name}</b>? Past orders keep their own copy of the product details.</>} onConfirm={remove} onClose={() => setDel(null)} />
    </>
  );
}
