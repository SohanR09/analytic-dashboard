import { Banknote, Package, Receipt, ShoppingCart, TrendingUp, Users } from 'lucide-react';
import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { BarChart } from '@/components/charts/BarChart';
import { DonutChart } from '@/components/charts/DonutChart';
import { HBarChart } from '@/components/charts/HBarChart';
import { LineChart } from '@/components/charts/LineChart';
import { StatCard } from '@/components/common/StatCard';
import { Card, DataTable, ErrorState, OrderBadge, PageHeader, PaymentBadge } from '@/components/common/ui';
import { useBusiness } from '@/hooks/useBusiness';
import { useAppDispatch, useAppSelector } from '@/store';
import { fetchDashboard } from '@/store/slices/dashboardSlice';
import { dateTime, money, num, titleCase } from '@/utils/format';

const ICONS: Record<string, JSX.Element> = {
  totalRevenue: <Banknote className="h-4 w-4" />, totalOrders: <ShoppingCart className="h-4 w-4" />, totalCustomers: <Users className="h-4 w-4" />,
  totalProducts: <Package className="h-4 w-4" />, averageOrderValue: <Receipt className="h-4 w-4" />, unitsSold: <TrendingUp className="h-4 w-4" />,
};

export default function Dashboard() {
  const { id, currency, business } = useBusiness();
  const dispatch = useAppDispatch();
  const filters = useAppSelector((s) => s.filters);
  const { data, loading, error } = useAppSelector((s) => s.dashboard);
  const load = () => dispatch(fetchDashboard({ businessId: id, filters }));
  useEffect(() => { void dispatch(fetchDashboard({ businessId: id, filters })); }, [dispatch, id, filters]);

  if (error && !data) return <div className="card"><ErrorState message={error} onRetry={load} /></div>;
  const cur = data?.currency ?? currency;
  const fmt = (k: string) => (k === 'totalRevenue' || k === 'averageOrderValue' ? (n: number) => money(n, cur) : (n: number) => num(Math.round(n)));
  const busy = loading && !data;

  return (
    <>
      <PageHeader title="Overview" subtitle={<>How <b>{business.name}</b> is performing{data && <> · {data.range.from.slice(0, 10)} to {data.range.to.slice(0, 10)}</>}</>} />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {busy ? Array.from({ length: 6 }, (_, i) => <StatCard key={i} loading title="" value={0} format={String} />)
          : data?.cards.map((c) => <StatCard key={c.key} title={c.title} value={c.value} format={fmt(c.key)} change={c.change} icon={ICONS[c.key]} />)}
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        <Card title="Revenue overview"><LineChart loading={busy} area data={data?.revenueOverview ?? []} series={[{ key: 'netRevenue', label: 'Net revenue' }, { key: 'grossRevenue', label: 'Gross revenue', color: 'var(--chart-2)' }]} format={(n) => money(n, cur, true)} yLabel={cur} /></Card>
        <Card title="Sales overview"><BarChart loading={busy} data={data?.salesOverview ?? []} xKey="date" series={[{ key: 'orders', label: 'Orders' }, { key: 'units', label: 'Units', color: 'var(--chart-2)' }]} xFormat={(s) => s.slice(5)} yLabel="Count" /></Card>
        <Card title="Top selling products"><HBarChart loading={busy} data={(data?.topProducts ?? []).map((p) => ({ label: p.name, value: p.revenue, sub: `${p.unitsSold} units` }))} format={(n) => money(n, cur, true)} /></Card>
        <Card title="Order status">
          <DonutChart loading={busy} data={(data?.orderStatus ?? []).map((s) => ({ label: titleCase(s.status), value: s.orders }))} center={<><span className="text-2xl font-bold">{num(data?.orderStatus.reduce((a, s) => a + s.orders, 0))}</span><span className="text-xs text-muted">orders</span></>} />
        </Card>
        <Card title="Sales by category" className="lg:col-span-2">
          <BarChart loading={busy} data={(data?.salesByCategory ?? []).map((c) => ({ category: c.category, revenue: c.revenue }))} xKey="category" series={[{ key: 'revenue', label: 'Revenue' }]} format={(n) => money(n, cur, true)} yLabel={cur} />
        </Card>
      </div>

      <div className="mt-6">
        <h2 className="mb-3 text-lg font-semibold">Recent orders</h2>
        <DataTable loading={busy} rows={data?.recentOrders} rowKey={(o) => o.id}
          columns={[
            { header: 'Order', cell: (o) => <Link className="font-medium text-primary underline-offset-2 hover:underline" to={`/businesses/${id}/orders/${o.id}`}>{o.orderNumber}</Link> },
            { header: 'Customer', cell: (o) => o.customer },
            { header: 'Date', cell: (o) => dateTime(o.orderDate) },
            { header: 'Amount', cell: (o) => money(o.amount, cur), className: 'text-right' },
            { header: 'Status', cell: (o) => <OrderBadge s={o.orderStatus} /> },
            { header: 'Payment', cell: (o) => <PaymentBadge s={o.paymentStatus} /> },
          ]} />
      </div>
    </>
  );
}
