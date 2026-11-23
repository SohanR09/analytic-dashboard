import { Plus } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { SearchBar } from '@/components/common/SearchBar';
import { DataTable, EmptyState, OrderBadge, PageHeader, PaymentBadge, useToast } from '@/components/common/ui';
import { PRESETS } from '@/store/slices/filterSlice';
import { useBusiness } from '@/hooks/useBusiness';
import { useDebounce } from '@/hooks/useDebounce';
import { useFetch } from '@/hooks/useFetch';
import { orderService } from '@/services/resources.service';
import { dateTime, money } from '@/utils/format';
import { P } from '@/utils/permissions';
import { OrderModal } from './OrderForm';

const STATUSES = ['PENDING', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'REFUNDED'];
const PAYMENTS = ['PENDING', 'PAID', 'FAILED', 'PARTIALLY_REFUNDED', 'REFUNDED'];

export default function Orders() {
  const { id, currency, can } = useBusiness();
  const nav = useNavigate();
  const toast = useToast();
  const [search, setSearch] = useState('');
  const q = useDebounce(search);
  const [status, setStatus] = useState(''); const [payment, setPayment] = useState(''); const [preset, setPreset] = useState('');
  const [sort, setSort] = useState('orderDate:desc');
  const [page, setPage] = useState(1);
  const [create, setCreate] = useState(false);
  useEffect(() => setPage(1), [q, status, payment, preset, sort]);
  const [sortBy, order] = sort.split(':');
  const { data, loading, error, reload } = useFetch(() => orderService.list(id, { page, limit: 10, search: q, status, paymentStatus: payment, preset, sortBy, order }), [id, page, q, status, payment, preset, sort]);

  return (
    <>
      <PageHeader title="Orders" subtitle="Track and manage every order" actions={can(P.ORDER_CREATE) ? <button className="btn-primary" onClick={() => setCreate(true)}><Plus className="h-4 w-4" />Create order</button> : undefined} />
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <SearchBar value={search} onChange={setSearch} placeholder="Order number or customer" />
        <select aria-label="Order status" className="input !w-auto" value={status} onChange={(e) => setStatus(e.target.value)}><option value="">All statuses</option>{STATUSES.map((s) => <option key={s} value={s}>{s[0] + s.slice(1).toLowerCase()}</option>)}</select>
        <select aria-label="Payment status" className="input !w-auto" value={payment} onChange={(e) => setPayment(e.target.value)}><option value="">All payments</option>{PAYMENTS.map((s) => <option key={s} value={s}>{s[0] + s.slice(1).toLowerCase().replace('_', ' ')}</option>)}</select>
        <select aria-label="Date range" className="input !w-auto" value={preset} onChange={(e) => setPreset(e.target.value)}><option value="">All time</option>{PRESETS.filter((p) => p.value !== 'custom').map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}</select>
        <select aria-label="Sort" className="input !w-auto" value={sort} onChange={(e) => setSort(e.target.value)}><option value="orderDate:desc">Newest first</option><option value="orderDate:asc">Oldest first</option><option value="totalAmount:desc">Highest value</option></select>
      </div>
      <DataTable rows={data?.items} loading={loading} error={error} onRetry={reload} rowKey={(o) => o.id} meta={data?.meta} onPage={setPage} onRowClick={(o) => nav(`/businesses/${id}/orders/${o.id}`)}
        empty={<EmptyState title="No orders found" hint="Try different filters, or create an order." />}
        columns={[
          { header: 'Order', cell: (o) => <Link className="font-medium text-primary hover:underline" to={`/businesses/${id}/orders/${o.id}`} onClick={(e) => e.stopPropagation()}>{o.orderNumber}</Link> },
          { header: 'Customer', cell: (o) => o.customer?.name ?? <span className="text-muted">Guest</span> },
          { header: 'Date', cell: (o) => dateTime(o.orderDate) },
          { header: 'Items', cell: (o) => o.itemCount ?? o.items?.length, className: 'text-right' },
          { header: 'Total', cell: (o) => money(o.totalAmount, currency), className: 'text-right' },
          { header: 'Status', cell: (o) => <OrderBadge s={o.orderStatus} /> },
          { header: 'Payment', cell: (o) => <PaymentBadge s={o.paymentStatus} /> },
        ]} />
      <OrderModal open={create} onClose={() => setCreate(false)} onSaved={(o) => { setCreate(false); toast('success', `Order ${o.orderNumber} created`); void reload(); }} />
    </>
  );
}
