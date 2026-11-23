import { BarChart3, Package, Receipt, ShoppingCart } from 'lucide-react';
import { AnalyticsFilters } from '@/components/common/AnalyticsFilters';
import { StatCard } from '@/components/common/StatCard';
import { BarChart } from '@/components/charts/BarChart';
import { DonutChart } from '@/components/charts/DonutChart';
import { HBarChart } from '@/components/charts/HBarChart';
import { LineChart } from '@/components/charts/LineChart';
import { Card, ErrorState, PageHeader } from '@/components/common/ui';
import { useBusiness, useFilters } from '@/hooks/useBusiness';
import { useFetch } from '@/hooks/useFetch';
import { analyticsService } from '@/services/analytics.service';
import { money, num, titleCase } from '@/utils/format';

export default function Sales() {
  const { id, currency } = useBusiness();
  const f = useFilters();
  const { data, loading, error, reload } = useFetch(() => analyticsService.sales(id, f), [id, f]);
  if (error && !data) return <div className="card"><ErrorState message={error} onRetry={reload} /></div>;
  const cur = data?.currency ?? currency;
  const busy = loading && !data;
  const g = data?.growth;
  return (
    <>
      <PageHeader title="Sales analytics" subtitle="Orders, units and average order value for the selected period" />
      <AnalyticsFilters status />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard loading={busy} title="Total sales" value={data?.totals.totalSales ?? 0} format={(n) => money(n, cur)} change={g?.sales} icon={<BarChart3 className="h-4 w-4" />} />
        <StatCard loading={busy} title="Total orders" value={data?.totals.totalOrders ?? 0} format={(n) => num(Math.round(n))} change={g?.orders} icon={<ShoppingCart className="h-4 w-4" />} />
        <StatCard loading={busy} title="Average order value" value={data?.totals.averageOrderValue ?? 0} format={(n) => money(n, cur)} change={g?.averageOrderValue} icon={<Receipt className="h-4 w-4" />} />
        <StatCard loading={busy} title="Units sold" value={data?.totals.unitsSold ?? 0} format={(n) => num(Math.round(n))} change={g?.units} icon={<Package className="h-4 w-4" />} />
      </div>
      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        <Card title="Orders over time" className="lg:col-span-2"><LineChart loading={busy} area data={data?.ordersOverTime ?? []} series={[{ key: 'orders', label: 'Orders' }, { key: 'units', label: 'Units', color: 'var(--chart-2)' }]} yLabel="Count" /></Card>
        <Card title="Sales by category (share)"><DonutChart loading={busy} donut={false} data={(data?.salesByCategory ?? []).map((c) => ({ label: c.category, value: c.revenue }))} format={(n) => money(n, cur)} /></Card>
        <Card title="Order status"><DonutChart loading={busy} data={(data?.orderStatus ?? []).map((s) => ({ label: titleCase(s.status), value: s.orders }))} /></Card>
        <Card title="Product performance"><BarChart loading={busy} data={(data?.salesByProduct ?? []).slice(0, 8).map((p) => ({ name: p.name, revenue: p.revenue }))} xKey="name" series={[{ key: 'revenue', label: 'Revenue' }]} format={(n) => money(n, cur, true)} /></Card>
        <Card title="Top selling products"><HBarChart loading={busy} data={(data?.salesByProduct ?? []).slice(0, 8).map((p) => ({ label: p.name, value: p.unitsSold, sub: money(p.revenue, cur) }))} format={(n) => `${num(n)} units`} color="var(--chart-2)" /></Card>
      </div>
    </>
  );
}
