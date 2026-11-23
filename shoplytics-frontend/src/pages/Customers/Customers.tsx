import { Pencil, Plus, Repeat, Trash2, UserPlus, Users, Wallet } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { DonutChart } from '@/components/charts/DonutChart';
import { LineChart } from '@/components/charts/LineChart';
import { ScatterChart } from '@/components/charts/ScatterChart';
import { SearchBar } from '@/components/common/SearchBar';
import { StatCard } from '@/components/common/StatCard';
import { Card, ConfirmDialog, DataTable, EmptyState, PageHeader, SegmentBadge, useToast } from '@/components/common/ui';
import { useBusiness, useFilters } from '@/hooks/useBusiness';
import { useDebounce } from '@/hooks/useDebounce';
import { useFetch } from '@/hooks/useFetch';
import { analyticsService } from '@/services/analytics.service';
import { customerService } from '@/services/resources.service';
import type { Customer, Segment } from '@/types';
import { date, errorMessage, money, num, titleCase } from '@/utils/format';
import { P } from '@/utils/permissions';
import { CustomerModal } from './CustomerForm';

export default function Customers() {
  const { id, currency, can } = useBusiness();
  const f = useFilters();
  const toast = useToast();
  const [search, setSearch] = useState('');
  const q = useDebounce(search);
  const [type, setType] = useState<Segment | ''>('');
  const [sort, setSort] = useState('createdAt:desc');
  const [page, setPage] = useState(1);
  const [modal, setModal] = useState<{ open: boolean; customer?: Customer }>({ open: false });
  const [del, setDel] = useState<Customer | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => setPage(1), [q, type, sort]);
  const [sortBy, order] = sort.split(':');

  const stats = useFetch(() => analyticsService.customers(id, f), [id, f]);
  const list = useFetch(() => customerService.list(id, { page, limit: 10, search: q, type, sortBy, order }), [id, page, q, type, sort]);
  const s = stats.data?.summary;
  const cur = stats.data?.currency ?? currency;
  const sb = stats.loading && !stats.data;

  const remove = async () => {
    if (!del) return;
    setBusy(true);
    try { await customerService.remove(id, del.id); toast('success', 'Customer deleted'); setDel(null); void list.reload(); void stats.reload(); } catch (e) { toast('error', errorMessage(e)); } finally { setBusy(false); }
  };
  const saved = () => { setModal({ open: false }); toast('success', 'Customer saved'); void list.reload(); void stats.reload(); };

  return (
    <>
      <PageHeader title="Customers" subtitle="Who buys from you, and how much" actions={can(P.CUSTOMER_CREATE) ? <button className="btn-primary" onClick={() => setModal({ open: true })}><Plus className="h-4 w-4" />Add customer</button> : undefined} />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard loading={sb} title="Total customers" value={s?.totalCustomers ?? 0} format={num} icon={<Users className="h-4 w-4" />} hint="all time" />
        <StatCard loading={sb} title="New customers" value={s?.newCustomers ?? 0} format={num} change={s?.newCustomersGrowth} icon={<UserPlus className="h-4 w-4" />} />
        <StatCard loading={sb} title="Returning customers" value={s?.returningCustomers ?? 0} format={num} icon={<Repeat className="h-4 w-4" />} hint="2+ orders" />
        <StatCard loading={sb} title="Avg. lifetime value" value={s?.averageLifetimeValue ?? 0} format={(n) => money(n, cur)} icon={<Wallet className="h-4 w-4" />} hint={`${s?.averageOrdersPerCustomer ?? 0} orders each`} />
      </div>
      <div className="mt-6 grid gap-5 lg:grid-cols-3">
        <Card title="Customer growth" className="lg:col-span-2"><LineChart loading={sb} area data={stats.data?.customerGrowth ?? []} series={[{ key: 'totalCustomers', label: 'Total customers' }, { key: 'newCustomers', label: 'New customers', color: 'var(--chart-2)' }]} /></Card>
        <Card title="Segments"><DonutChart loading={sb} data={(stats.data?.segments ?? []).map((x) => ({ label: titleCase(x.segment), value: x.customers }))} /></Card>
        <Card title="New vs returning"><DonutChart loading={sb} height={220} data={(stats.data?.newVsReturning ?? []).map((x) => ({ label: titleCase(x.type), value: x.customers }))} /></Card>
        <Card title="Purchasing behaviour" className="lg:col-span-2"><ScatterChart loading={sb} xLabel="Orders" yLabel="Total spent" yFormat={(n) => money(n, cur, true)} data={(stats.data?.purchasingBehavior ?? []).map((p) => ({ label: p.name, x: p.orders, y: p.totalSpent }))} /></Card>
      </div>

      <div className="mb-3 mt-8 flex flex-wrap items-center gap-3">
        <SearchBar value={search} onChange={setSearch} placeholder="Search name, email, phone" />
        <select aria-label="Segment" className="input !w-auto" value={type} onChange={(e) => setType(e.target.value as Segment | '')}><option value="">All segments</option><option value="HIGH_VALUE">High value</option><option value="REGULAR">Regular</option><option value="INACTIVE">Inactive</option></select>
        <select aria-label="Sort" className="input !w-auto" value={sort} onChange={(e) => setSort(e.target.value)}><option value="createdAt:desc">Newest first</option><option value="name:asc">Name A–Z</option><option value="totalSpent:desc">Top spenders</option><option value="totalOrders:desc">Most orders</option></select>
      </div>
      <DataTable rows={list.data?.items} loading={list.loading} error={list.error} onRetry={list.reload} rowKey={(c) => c.id} meta={list.data?.meta} onPage={setPage}
        empty={<EmptyState title="No customers found" hint={search || type ? 'Try clearing your filters.' : 'Customers appear here as you add them or take orders.'} />}
        columns={[
          { header: 'Customer', cell: (c) => <Link className="block" to={`/businesses/${id}/customers/${c.id}`}><span className="font-medium text-primary hover:underline">{c.name}</span><span className="block text-xs text-muted">{c.email ?? '—'}</span></Link> },
          { header: 'Location', cell: (c) => [c.city, c.country].filter(Boolean).join(', ') || '—' },
          { header: 'Orders', cell: (c) => num(c.totalOrders), className: 'text-right' },
          { header: 'Total spent', cell: (c) => money(c.totalSpent, cur), className: 'text-right' },
          { header: 'Last purchase', cell: (c) => date(c.lastPurchaseDate) },
          { header: 'Segment', cell: (c) => <SegmentBadge s={c.customerType} /> },
          ...(can(P.CUSTOMER_UPDATE) || can(P.CUSTOMER_DELETE) ? [{ header: '', className: 'text-right', cell: (c: Customer) => (
            <div className="flex justify-end gap-1">
              {can(P.CUSTOMER_UPDATE) && <button className="btn-ghost !p-2" aria-label={`Edit ${c.name}`} onClick={() => setModal({ open: true, customer: c })}><Pencil className="h-4 w-4" /></button>}
              {can(P.CUSTOMER_DELETE) && <button className="btn-ghost !p-2 hover:!text-danger" aria-label={`Delete ${c.name}`} onClick={() => setDel(c)}><Trash2 className="h-4 w-4" /></button>}
            </div>) }] : []),
        ]} />
      <CustomerModal open={modal.open} customer={modal.customer} onClose={() => setModal({ open: false })} onSaved={saved} />
      <ConfirmDialog open={!!del} busy={busy} title="Delete customer" message={<>Delete <b>{del?.name}</b>? Their past orders are kept but will show as a guest.</>} onConfirm={remove} onClose={() => setDel(null)} />
    </>
  );
}
