import { zodResolver } from '@hookform/resolvers/zod';
import { AlertTriangle, Boxes, PackageX, Pencil, Warehouse } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link } from 'react-router-dom';
import { z } from 'zod';
import { BarChart } from '@/components/charts/BarChart';
import { DonutChart } from '@/components/charts/DonutChart';
import { StatCard } from '@/components/common/StatCard';
import { SearchBar } from '@/components/common/SearchBar';
import { Alert, Badge, Card, DataTable, EmptyState, Field, Modal, PageHeader, Spinner, StockBadge, useToast } from '@/components/common/ui';
import { useBusiness } from '@/hooks/useBusiness';
import { useDebounce } from '@/hooks/useDebounce';
import { useFetch } from '@/hooks/useFetch';
import { analyticsService } from '@/services/analytics.service';
import { inventoryService } from '@/services/resources.service';
import type { InventoryRow, StockStatus } from '@/types';
import { dateTime, errorMessage, money, num, titleCase } from '@/utils/format';
import { P } from '@/utils/permissions';

const schema = z.object({
  mode: z.enum(['adjustment', 'newQuantity']),
  amount: z.coerce.number({ invalid_type_error: 'Enter a number' }).int('Whole units only'),
  movementType: z.enum(['PURCHASE', 'RETURN', 'ADJUSTMENT']),
  reason: z.string().trim().max(300).optional(),
  minimumStockLevel: z.coerce.number().int().min(0).optional().or(z.literal('')),
}).superRefine((d, ctx) => {
  if (d.mode === 'newQuantity' && d.amount < 0) ctx.addIssue({ code: 'custom', path: ['amount'], message: 'Stock cannot be negative' });
  if (d.mode === 'adjustment' && d.amount === 0) ctx.addIssue({ code: 'custom', path: ['amount'], message: 'Adjustment cannot be zero' });
});
type Form = z.infer<typeof schema>;

function StockModal({ row, onClose, onSaved }: { row: InventoryRow | null; onClose: () => void; onSaved: () => void }) {
  const { id } = useBusiness();
  const [error, setError] = useState<string | null>(null);
  const form = useForm<Form>({ resolver: zodResolver(schema), defaultValues: { mode: 'adjustment', amount: 0, movementType: 'PURCHASE' } });
  const { register, handleSubmit, watch, reset, formState: { errors, isSubmitting } } = form;
  useEffect(() => { if (row) { setError(null); reset({ mode: 'adjustment', amount: 0, movementType: 'PURCHASE', reason: '', minimumStockLevel: row.minimumStockLevel }); } }, [row, reset]);
  const mode = watch('mode'); const amount = Number(watch('amount')) || 0;
  const preview = row ? (mode === 'newQuantity' ? amount : row.stockQuantity + amount) : 0;
  const submit = handleSubmit(async (v) => {
    if (!row) return;
    setError(null);
    try {
      await inventoryService.update(id, row.id, {
        ...(v.mode === 'newQuantity' ? { newQuantity: v.amount } : { adjustment: v.amount }),
        movementType: v.mode === 'newQuantity' ? 'ADJUSTMENT' : v.movementType,
        reason: v.reason || undefined,
        ...(v.minimumStockLevel !== '' && v.minimumStockLevel !== undefined && v.minimumStockLevel !== row.minimumStockLevel ? { minimumStockLevel: Number(v.minimumStockLevel) } : {}),
      });
      onSaved();
    } catch (e) { setError(errorMessage(e)); }
  });
  return (
    <Modal open={!!row} onClose={onClose} title={`Update stock · ${row?.name ?? ''}`}>
      <form onSubmit={submit} className="space-y-4" noValidate>
        {error && <Alert>{error}</Alert>}
        <p className="text-sm text-muted">Current stock: <b className="text-ink">{row?.stockQuantity}</b></p>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Method"><select className="input" {...register('mode')}><option value="adjustment">Add / remove units</option><option value="newQuantity">Set exact count</option></select></Field>
          <Field label={mode === 'newQuantity' ? 'New quantity' : 'Units (+/−)'} error={errors.amount?.message}><input className="input" type="number" step={1} {...register('amount')} /></Field>
        </div>
        {mode === 'adjustment' && <Field label="Type"><select className="input" {...register('movementType')}><option value="PURCHASE">Purchase / restock</option><option value="RETURN">Customer return</option><option value="ADJUSTMENT">Adjustment</option></select></Field>}
        <Field label="Reason (optional)" error={errors.reason?.message}><input className="input" {...register('reason')} /></Field>
        <Field label="Low-stock threshold" error={errors.minimumStockLevel?.message}><input className="input" type="number" min={0} {...register('minimumStockLevel')} /></Field>
        <p className={`text-sm ${preview < 0 ? 'text-danger' : 'text-muted'}`}>New stock level: <b>{preview}</b>{preview < 0 && ' (not enough stock)'}</p>
        <div className="flex justify-end gap-2"><button type="button" className="btn-secondary" onClick={onClose}>Cancel</button><button className="btn-primary" disabled={isSubmitting || preview < 0}>{isSubmitting && <Spinner />}Save</button></div>
      </form>
    </Modal>
  );
}

export default function Inventory() {
  const { id, currency, can } = useBusiness();
  const toast = useToast();
  const [tab, setTab] = useState<'stock' | 'movements'>('stock');
  const [search, setSearch] = useState('');
  const q = useDebounce(search);
  const [status, setStatus] = useState<StockStatus | ''>('');
  const [page, setPage] = useState(1);
  const [edit, setEdit] = useState<InventoryRow | null>(null);
  useEffect(() => setPage(1), [q, status, tab]);

  const stats = useFetch(() => analyticsService.inventory(id), [id]);
  const list = useFetch(() => inventoryService.list(id, { page, limit: 10, search: q, status }), [id, page, q, status], tab === 'stock');
  const moves = useFetch(() => inventoryService.movements(id, { page, limit: 12 }), [id, page], tab === 'movements');
  const s = stats.data?.summary;
  const cur = stats.data?.currency ?? currency;

  const saved = () => { setEdit(null); toast('success', 'Stock updated'); void list.reload(); void stats.reload(); };
  return (
    <>
      <PageHeader title="Inventory" subtitle="Stock levels, value and movement history" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard loading={stats.loading && !stats.data} title="Total products" value={s?.totalProducts ?? 0} format={num} icon={<Boxes className="h-4 w-4" />} hint={`${num(s?.totalStockUnits)} units in stock`} />
        <StatCard loading={stats.loading && !stats.data} title="Inventory value" value={s?.inventoryValue ?? 0} format={(n) => money(n, cur)} icon={<Warehouse className="h-4 w-4" />} hint="stock × cost price" />
        <StatCard loading={stats.loading && !stats.data} title="Low stock" value={s?.lowStockProducts ?? 0} format={num} icon={<AlertTriangle className="h-4 w-4" />} hint="at or below minimum" />
        <StatCard loading={stats.loading && !stats.data} title="Out of stock" value={s?.outOfStockProducts ?? 0} format={num} icon={<PackageX className="h-4 w-4" />} hint="needs restocking" />
      </div>
      <div className="mt-6 grid gap-5 lg:grid-cols-3">
        <Card title="Stock level comparison" className="lg:col-span-2"><BarChart loading={stats.loading && !stats.data} data={(stats.data?.stockLevelComparison ?? []).map((p) => ({ name: p.name, stock: p.stockQuantity, minimum: p.minimumStockLevel }))} xKey="name" series={[{ key: 'stock', label: 'In stock' }, { key: 'minimum', label: 'Minimum level', color: 'var(--chart-2)' }]} /></Card>
        <Card title="Stock status"><DonutChart loading={stats.loading && !stats.data} data={(stats.data?.statusBreakdown ?? []).map((x) => ({ label: titleCase(x.status), value: x.products }))} /></Card>
        <Card title="Stock distribution"><BarChart loading={stats.loading && !stats.data} data={(stats.data?.stockDistribution ?? []).map((d) => ({ label: d.label, products: d.products }))} xKey="label" series={[{ key: 'products', label: 'Products' }]} height={240} /></Card>
        <Card title="Inventory value by category" className="lg:col-span-2"><BarChart loading={stats.loading && !stats.data} data={(stats.data?.valueByCategory ?? []).map((c) => ({ category: c.category ?? c.name ?? '—', value: c.value }))} xKey="category" series={[{ key: 'value', label: 'Value' }]} format={(n) => money(n, cur, true)} height={240} /></Card>
      </div>

      <div className="mb-3 mt-8 flex flex-wrap items-center gap-3">
        <div className="inline-flex rounded-lg border border-line bg-white p-1 text-sm">
          {(['stock', 'movements'] as const).map((t) => <button key={t} onClick={() => setTab(t)} className={`rounded-md px-3 py-1.5 font-medium ${tab === t ? 'bg-primary text-white' : 'text-muted hover:text-ink'}`}>{t === 'stock' ? 'Stock levels' : 'Movement log'}</button>)}
        </div>
        {tab === 'stock' && <><SearchBar value={search} onChange={setSearch} placeholder="Search name or SKU" />
          <select aria-label="Stock status" className="input !w-auto" value={status} onChange={(e) => setStatus(e.target.value as StockStatus | '')}><option value="">All statuses</option><option value="IN_STOCK">In stock</option><option value="LOW_STOCK">Low stock</option><option value="OUT_OF_STOCK">Out of stock</option></select></>}
      </div>

      {tab === 'stock' ? (
        <DataTable rows={list.data?.items} loading={list.loading} error={list.error} onRetry={list.reload} rowKey={(r) => r.id} meta={list.data?.meta} onPage={setPage}
          empty={<EmptyState title="No products match" hint="Try a different search or status filter." />}
          columns={[
            { header: 'Product', cell: (r) => <Link className="font-medium text-primary hover:underline" to={`/businesses/${id}/products/${r.id}`}>{r.name}</Link> },
            { header: 'SKU', cell: (r) => <span className="font-mono text-xs">{r.sku}</span> },
            { header: 'Category', cell: (r) => r.category },
            { header: 'Stock', cell: (r) => <b>{num(r.stockQuantity)}</b>, className: 'text-right' },
            { header: 'Min', cell: (r) => num(r.minimumStockLevel), className: 'text-right' },
            { header: 'Value', cell: (r) => money(r.stockValue, cur), className: 'text-right' },
            { header: 'Status', cell: (r) => <StockBadge s={r.status} /> },
            ...(can(P.INVENTORY_UPDATE) ? [{ header: '', cell: (r: InventoryRow) => <button className="btn-secondary !px-2.5 !py-1.5" onClick={() => setEdit(r)} aria-label={`Update stock for ${r.name}`}><Pencil className="h-3.5 w-3.5" />Update</button>, className: 'text-right' }] : []),
          ]} />
      ) : (
        <DataTable rows={moves.data?.items} loading={moves.loading} error={moves.error} onRetry={moves.reload} rowKey={(r) => r.id} meta={moves.data?.meta} onPage={setPage}
          columns={[
            { header: 'When', cell: (r) => dateTime(r.createdAt) },
            { header: 'Product', cell: (r) => r.product?.name ?? '—' },
            { header: 'Type', cell: (r) => <Badge tone={r.quantity >= 0 ? 'green' : 'amber'}>{titleCase(r.movementType)}</Badge> },
            { header: 'Change', cell: (r) => <span className={r.quantity >= 0 ? 'text-success' : 'text-danger'}>{r.quantity > 0 ? '+' : ''}{r.quantity}</span>, className: 'text-right' },
            { header: 'Before → After', cell: (r) => `${r.previousQuantity} → ${r.newQuantity}`, className: 'text-right' },
            { header: 'Reason', cell: (r) => r.reason ?? '—' },
          ]} />
      )}
      <StockModal row={edit} onClose={() => setEdit(null)} onSaved={saved} />
    </>
  );
}
