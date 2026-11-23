import { ArrowLeft, Mail, MapPin, Pencil, Phone } from 'lucide-react';
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { HBarChart } from '@/components/charts/HBarChart';
import { StatCard } from '@/components/common/StatCard';
import { Card, DataTable, ErrorState, FullPageSpinner, OrderBadge, PageHeader, PaymentBadge, SegmentBadge } from '@/components/common/ui';
import { useBusiness } from '@/hooks/useBusiness';
import { useFetch } from '@/hooks/useFetch';
import { customerService } from '@/services/resources.service';
import type { OrderStatus, PaymentStatus, Segment } from '@/types';
import { date, dateTime, money, num } from '@/utils/format';
import { P } from '@/utils/permissions';
import { CustomerModal } from './CustomerForm';

export default function CustomerDetail() {
  const { customerId = '' } = useParams();
  const { id, currency, can } = useBusiness();
  const [edit, setEdit] = useState(false);
  const { data, loading, error, reload } = useFetch(() => customerService.get(id, customerId), [id, customerId]);
  if (error && !data) return <div className="card"><ErrorState message={error} onRetry={reload} /></div>;
  if (!data) return loading ? <FullPageSpinner /> : null;
  const { customer: c, stats } = data;
  const cur = data.currency ?? currency;
  return (
    <>
      <Link to={`/businesses/${id}/customers`} className="mb-3 inline-flex items-center gap-1 text-sm text-muted hover:text-ink"><ArrowLeft className="h-4 w-4" />Customers</Link>
      <PageHeader title={c.name} subtitle={<span className="flex flex-wrap items-center gap-x-4 gap-y-1">
        {c.email && <span className="inline-flex items-center gap-1"><Mail className="h-3.5 w-3.5" />{c.email}</span>}
        {c.phone && <span className="inline-flex items-center gap-1"><Phone className="h-3.5 w-3.5" />{c.phone}</span>}
        {(c.city || c.country) && <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{[c.city, c.country].filter(Boolean).join(', ')}</span>}
      </span>} actions={<><SegmentBadge s={stats.customerType as Segment} />{can(P.CUSTOMER_UPDATE) && <button className="btn-secondary" onClick={() => setEdit(true)}><Pencil className="h-4 w-4" />Edit</button>}</>} />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Total orders" value={stats.totalOrders} format={num} />
        <StatCard title="Total spent" value={stats.totalSpent} format={(n) => money(n, cur)} />
        <StatCard title="Average order value" value={stats.averageOrderValue} format={(n) => money(n, cur)} />
        <div className="card p-5"><p className="text-sm font-medium text-muted">First / last purchase</p><p className="mt-3 text-lg font-bold">{date(stats.firstPurchaseDate)}</p><p className="mt-1 text-sm text-muted">last: {date(stats.lastPurchaseDate)}</p></div>
      </div>
      {c.notes && <p className="card mt-4 p-4 text-sm"><b>Notes: </b>{c.notes}</p>}
      <div className="mt-6 grid gap-5 lg:grid-cols-3">
        <Card title="Most purchased products"><HBarChart data={data.mostPurchasedProducts.slice(0, 6).map((p) => ({ label: p.name, value: p.unitsSold, sub: money(p.revenue, cur) }))} format={(n) => `${n} units`} color="var(--chart-2)" /></Card>
        <div className="lg:col-span-2">
          <h2 className="mb-3 text-lg font-semibold">Purchase history</h2>
          <DataTable rows={data.purchaseHistory} rowKey={(o) => o.id}
            columns={[
              { header: 'Order', cell: (o) => <Link className="font-medium text-primary hover:underline" to={`/businesses/${id}/orders/${o.id}`}>{o.orderNumber}</Link> },
              { header: 'Date', cell: (o) => dateTime(o.orderDate) },
              { header: 'Items', cell: (o) => o.itemCount, className: 'text-right' },
              { header: 'Total', cell: (o) => money(o.totalAmount, cur), className: 'text-right' },
              { header: 'Status', cell: (o) => <OrderBadge s={o.orderStatus as OrderStatus} /> },
              { header: 'Payment', cell: (o) => <PaymentBadge s={o.paymentStatus as PaymentStatus} /> },
            ]} />
        </div>
      </div>
      <CustomerModal open={edit} customer={c} onClose={() => setEdit(false)} onSaved={() => { setEdit(false); void reload(); }} />
    </>
  );
}
