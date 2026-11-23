import { Banknote, Percent, ReceiptText, Truck, Undo2, Tag } from 'lucide-react';
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
import { money, shortDate, titleCase } from '@/utils/format';

export default function Revenue() {
  const { id, currency } = useBusiness();
  const f = useFilters();
  const { data, loading, error, reload } = useFetch(() => analyticsService.revenue(id, f), [id, f]);
  if (error && !data) return <div className="card"><ErrorState message={error} onRetry={reload} /></div>;
  const cur = data?.currency ?? currency;
  const busy = loading && !data;
  const t = data?.totals;
  const g = data?.growth ?? {};
  const fm = (n: number) => money(n, cur);
  const cmp = data
    ? data.monthlyComparison.current.map((p, i) => ({ label: shortDate(p.date), current: p.netRevenue, previous: data.monthlyComparison.comparison[i]?.netRevenue ?? 0 }))
    : [];
  return (
    <>
      <PageHeader title="Revenue analytics" subtitle="Net revenue = gross revenue − discounts − refunds" />
      <AnalyticsFilters />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard loading={busy} title="Net revenue" value={t?.netRevenue ?? 0} format={fm} change={g.netRevenue} icon={<Banknote className="h-4 w-4" />} />
        <StatCard loading={busy} title="Gross revenue" value={t?.grossRevenue ?? 0} format={fm} change={g.grossRevenue} icon={<ReceiptText className="h-4 w-4" />} />
        <StatCard loading={busy} title="Discounts" value={t?.discounts ?? 0} format={fm} change={g.discounts} invert icon={<Tag className="h-4 w-4" />} />
        <StatCard loading={busy} title="Refunds" value={t?.refunds ?? 0} format={fm} change={g.refunds} invert icon={<Undo2 className="h-4 w-4" />} />
        <StatCard loading={busy} title="Tax collected" value={t?.taxCollected ?? 0} format={fm} change={g.taxCollected} icon={<Percent className="h-4 w-4" />} />
        <StatCard loading={busy} title="Shipping" value={t?.shipping ?? 0} format={fm} change={g.shipping} icon={<Truck className="h-4 w-4" />} />
      </div>
      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        <Card title="Revenue trend" className="lg:col-span-2"><LineChart loading={busy} area data={data?.revenueTrend ?? []} series={[{ key: 'netRevenue', label: 'Net' }, { key: 'grossRevenue', label: 'Gross', color: 'var(--chart-2)' }]} format={(n) => money(n, cur, true)} yLabel={cur} /></Card>
        <Card title="Monthly comparison (current vs comparison period)"><BarChart loading={busy} data={cmp} xKey="label" series={[{ key: 'current', label: 'Current' }, { key: 'previous', label: 'Comparison', color: 'var(--chart-3)' }]} format={(n) => money(n, cur, true)} /></Card>
        <Card title="Revenue by category (stacked by product)">
          <BarChart loading={busy} stacked data={(data?.byCategory ?? []).map((c) => ({ category: c.category, revenue: c.revenue, units: c.unitsSold }))} xKey="category" series={[{ key: 'revenue', label: 'Revenue' }]} format={(n) => money(n, cur, true)} />
        </Card>
        <Card title="Revenue by product"><HBarChart loading={busy} data={(data?.byProduct ?? []).slice(0, 8).map((p) => ({ label: p.name, value: p.revenue }))} format={(n) => money(n, cur, true)} /></Card>
        <Card title="Payment methods"><DonutChart loading={busy} data={(data?.byPaymentMethod ?? []).map((p) => ({ label: titleCase(p.method), value: p.netRevenue }))} format={fm} /></Card>
      </div>
    </>
  );
}
