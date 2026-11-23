import { ArrowLeft, Pencil } from 'lucide-react';
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { BarChart } from '@/components/charts/BarChart';
import { StatCard } from '@/components/common/StatCard';
import { Badge, Card, DataTable, ErrorState, FullPageSpinner, PageHeader, StockBadge } from '@/components/common/ui';
import { useBusiness } from '@/hooks/useBusiness';
import { useFetch } from '@/hooks/useFetch';
import { productService } from '@/services/resources.service';
import { dateTime, money, num, titleCase } from '@/utils/format';
import { P } from '@/utils/permissions';
import { ProductModal } from './ProductForm';

export default function ProductDetail() {
  const { productId = '' } = useParams();
  const { id, currency, can } = useBusiness();
  const [edit, setEdit] = useState(false);
  const { data, loading, error, reload } = useFetch(() => productService.get(id, productId, { preset: 'last_90_days' }), [id, productId]);
  if (error && !data) return <div className="card"><ErrorState message={error} onRetry={reload} /></div>;
  if (!data) return loading ? <FullPageSpinner /> : null;
  const p = data.product;
  const cur = data.currency ?? currency;
  const margin = p.price > 0 ? ((p.price - p.costPrice) / p.price) * 100 : 0;
  return (
    <>
      <Link to={`/businesses/${id}/products`} className="mb-3 inline-flex items-center gap-1 text-sm text-muted hover:text-ink"><ArrowLeft className="h-4 w-4" />Products</Link>
      <PageHeader title={p.name} subtitle={<><span className="font-mono">{p.sku}</span> · {p.category?.name ?? 'Uncategorized'}</>}
        actions={<><StockBadge s={data.stockStatus} />{can(P.PRODUCT_UPDATE) && <button className="btn-secondary" onClick={() => setEdit(true)}><Pencil className="h-4 w-4" />Edit</button>}</>} />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Selling price" value={p.price} format={(n) => money(n, cur)} hint={`cost ${money(p.costPrice, cur)} · ${margin.toFixed(0)}% margin`} />
        <StatCard title="In stock" value={p.stockQuantity} format={num} hint={`minimum ${p.minimumStockLevel}`} />
        <StatCard title="Units sold (lifetime)" value={data.performance.lifetime.unitsSold} format={num} hint={`${data.performance.lifetime.orders} orders`} />
        <StatCard title="Revenue (lifetime)" value={data.performance.lifetime.revenue} format={(n) => money(n, cur)} hint={`${money(data.performance.period.revenue, cur)} in last 90 days`} />
      </div>
      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        <Card title="Units sold · last 90 days"><BarChart data={data.salesHistory} xKey="date" series={[{ key: 'unitsSold', label: 'Units sold' }]} xFormat={(s) => s.slice(5)} /></Card>
        <Card title="Details"><dl className="space-y-3 text-sm">
          <div className="flex justify-between"><dt className="text-muted">Description</dt><dd className="max-w-[60%] text-right">{p.description || '—'}</dd></div>
          <div className="flex justify-between"><dt className="text-muted">Created</dt><dd>{dateTime(p.createdAt)}</dd></div>
          <div className="flex justify-between"><dt className="text-muted">Last updated</dt><dd>{dateTime(p.updatedAt)}</dd></div>
        </dl></Card>
      </div>
      <h2 className="mb-3 mt-8 text-lg font-semibold">Recent stock movements</h2>
      <DataTable rows={data.stockMovements} rowKey={(m) => m.id}
        columns={[
          { header: 'When', cell: (m) => dateTime(m.createdAt) },
          { header: 'Type', cell: (m) => <Badge tone={m.quantity >= 0 ? 'green' : 'amber'}>{titleCase(m.movementType)}</Badge> },
          { header: 'Change', cell: (m) => `${m.quantity > 0 ? '+' : ''}${m.quantity}`, className: 'text-right' },
          { header: 'After', cell: (m) => m.newQuantity, className: 'text-right' },
          { header: 'Reason', cell: (m) => m.reason ?? '—' },
        ]} />
      <ProductModal open={edit} product={p} onClose={() => setEdit(false)} onSaved={() => { setEdit(false); void reload(); }} />
    </>
  );
}
