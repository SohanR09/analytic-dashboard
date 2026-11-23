import type { Business, Prisma } from '@prisma/client';
import { prisma } from '../config/prisma';
import { ApiError } from '../utils/ApiError';
import { toCsv } from '../utils/csv';
import { bucketKey, buildBuckets, isoDay, type Interval } from '../utils/dates';
import { round } from '../utils/helpers';
import type { GenerateReportInput, ReportType } from '../validators/report.validator';
import { REPORT_CATEGORIES } from '../validators/report.validator';
import * as m from './analytics.metrics';
import { buildCtx, loadOrders, type Ctx } from './analytics.service';
import { customerStats } from './customer.service';
import { stockStatus } from './inventory.service';

const MAX_ROWS = 20_000;

export interface ReportColumn {
  key: string;
  label: string;
  type: 'text' | 'number' | 'money' | 'percent' | 'date';
}

export interface ReportData {
  title: string;
  columns: ReportColumn[];
  rows: Record<string, unknown>[];
  summary: Record<string, unknown>;
}

const text = (key: string, label: string): ReportColumn => ({ key, label, type: 'text' });
const num = (key: string, label: string): ReportColumn => ({ key, label, type: 'number' });
const money = (key: string, label: string): ReportColumn => ({ key, label, type: 'money' });
const pct = (key: string, label: string): ReportColumn => ({ key, label, type: 'percent' });
const date = (key: string, label: string): ReportColumn => ({ key, label, type: 'date' });

const TITLES: Record<ReportType, string> = {
  daily_sales: 'Daily Sales Report',
  weekly_sales: 'Weekly Sales Report',
  monthly_sales: 'Monthly Sales Report',
  yearly_sales: 'Yearly Sales Report',
  product_sales: 'Product Sales Report',
  current_inventory: 'Current Inventory Report',
  low_stock: 'Low-Stock Products Report',
  out_of_stock: 'Out-of-Stock Products Report',
  inventory_valuation: 'Inventory Valuation Report',
  customer_growth: 'Customer Growth Report',
  new_customers: 'New Customers Report',
  returning_customers: 'Returning Customers Report',
  high_value_customers: 'High-Value Customers Report',
  revenue_summary: 'Revenue Summary Report',
  monthly_revenue: 'Monthly Revenue Report',
  product_revenue: 'Product Revenue Report',
  category_revenue: 'Category Revenue Report',
};

export const categoryOf = (t: ReportType) => Object.entries(REPORT_CATEGORIES).find(([, list]) => list.includes(t))![0];

const periodColumns = [text('period', 'Period'), num('orders', 'Orders'), num('units', 'Units'), money('grossRevenue', 'Gross revenue'), money('discounts', 'Discounts'), money('refunds', 'Refunds'), money('netRevenue', 'Net revenue'), money('taxCollected', 'Tax collected')];

function salesByPeriod(orders: m.OrderRow[], ctx: Ctx, interval: Interval): ReportData['rows'] {
  return m.trend(orders, ctx.range, interval, ctx.tz).map((p) => ({ period: p.date, orders: p.orders, units: p.units, grossRevenue: p.grossRevenue, discounts: p.discounts, refunds: p.refunds, netRevenue: p.netRevenue, taxCollected: p.taxCollected }));
}

const sum = (rows: Record<string, unknown>[], key: string) => round(rows.reduce((s, r) => s + Number(r[key] ?? 0), 0));

async function inventoryRows(businessId: string, filter?: (status: string) => boolean) {
  const products = await prisma.product.findMany({ where: { businessId }, include: { category: { select: { name: true } } }, orderBy: { name: 'asc' } });
  return products
    .map((p) => ({
      name: p.name,
      sku: p.sku,
      category: p.category?.name ?? 'Uncategorized',
      stockQuantity: p.stockQuantity,
      minimumStockLevel: p.minimumStockLevel,
      costPrice: p.costPrice,
      price: p.price,
      stockValue: round(p.stockQuantity * p.costPrice),
      status: stockStatus(p.stockQuantity, p.minimumStockLevel),
    }))
    .filter((r) => !filter || filter(r.status));
}

const inventoryColumns = [text('name', 'Product'), text('sku', 'SKU'), text('category', 'Category'), num('stockQuantity', 'Stock'), num('minimumStockLevel', 'Min. level'), money('costPrice', 'Unit cost'), money('stockValue', 'Stock value'), text('status', 'Status')];

/** Builds the tabular content of a report. Everything is computed server-side from this business's records. */
export async function buildReport(business: Business, input: GenerateReportInput): Promise<ReportData> {
  const t = input.reportType;
  const type = t;
  const ctx = buildCtx(business, {
    ...input,
    preset: input.preset ?? (input.from || input.to ? 'custom' : type === 'yearly_sales' || type === 'monthly_revenue' ? 'this_year' : 'last_30_days'),
  });
  const withItems = ['product_sales', 'product_revenue', 'category_revenue'].includes(type) || !!(input.filters.productId || input.filters.categoryId);
  const base: Pick<ReportData, 'title'> = { title: TITLES[type] };
  const meta = { currency: business.currency, timezone: business.timezone };
  const rangeMeta = { from: isoDay(ctx.range.from, ctx.tz), to: isoDay(ctx.range.to, ctx.tz) };

  const salesLike = async () => m.filterLines(await loadOrders(business.id, ctx.range, { items: withItems }), input.filters);

  switch (type) {
    case 'daily_sales':
    case 'weekly_sales':
    case 'monthly_sales':
    case 'yearly_sales':
    case 'monthly_revenue': {
      const interval: Interval = { daily_sales: 'day', weekly_sales: 'week', monthly_sales: 'month', yearly_sales: 'year', monthly_revenue: 'month' }[type] as Interval;
      const orders = await salesLike();
      const rows = salesByPeriod(orders, ctx, interval);
      return { ...base, columns: periodColumns, rows, summary: { ...meta, ...rangeMeta, orders: sum(rows, 'orders'), units: sum(rows, 'units'), netRevenue: sum(rows, 'netRevenue') } };
    }

    case 'product_sales':
    case 'product_revenue': {
      const rows = m.productBreakdown(await salesLike()).map((p) => ({ name: p.name, sku: p.sku, category: p.categoryName, orders: p.orders, unitsSold: p.unitsSold, revenue: p.revenue }));
      return { ...base, columns: [text('name', 'Product'), text('sku', 'SKU'), text('category', 'Category'), num('orders', 'Orders'), num('unitsSold', 'Units sold'), money('revenue', 'Revenue')], rows, summary: { ...meta, ...rangeMeta, products: rows.length, revenue: sum(rows, 'revenue') } };
    }

    case 'category_revenue': {
      const rows = m.categoryBreakdown(await salesLike()).map((c) => ({ category: c.category, unitsSold: c.unitsSold, revenue: c.revenue, share: c.share }));
      return { ...base, columns: [text('category', 'Category'), num('unitsSold', 'Units sold'), money('revenue', 'Revenue'), pct('share', 'Share')], rows, summary: { ...meta, ...rangeMeta, revenue: sum(rows, 'revenue') } };
    }

    case 'revenue_summary': {
      const [cur, prev] = await Promise.all([salesLike(), loadOrders(business.id, ctx.prev, { items: withItems }).then((o) => m.filterLines(o, input.filters))]);
      const cmp = m.compareTotals(m.summarize(cur), m.summarize(prev));
      const metrics: [string, keyof m.Totals][] = [['Gross revenue', 'grossRevenue'], ['Discounts', 'discounts'], ['Refunds', 'refunds'], ['Net revenue', 'netRevenue'], ['Tax collected', 'taxCollected'], ['Orders', 'orders'], ['Average order value', 'averageOrderValue']];
      const rows = metrics.map(([label, k]) => ({ metric: label, current: cmp.current[k], previous: cmp.previous[k], change: cmp.growth[k] ?? null }));
      return { ...base, columns: [text('metric', 'Metric'), money('current', 'Current period'), money('previous', 'Previous period'), pct('change', 'Change')], rows, summary: { ...meta, ...rangeMeta, netRevenue: cmp.current.netRevenue } };
    }

    case 'current_inventory':
    case 'low_stock':
    case 'out_of_stock':
    case 'inventory_valuation': {
      const filter = type === 'low_stock' ? (s: string) => s === 'LOW_STOCK' : type === 'out_of_stock' ? (s: string) => s === 'OUT_OF_STOCK' : undefined;
      const rows = await inventoryRows(business.id, filter);
      const valueByCategory: Record<string, number> = {};
      for (const r of rows) valueByCategory[r.category] = round((valueByCategory[r.category] ?? 0) + r.stockValue);
      return {
        ...base,
        columns: inventoryColumns,
        rows,
        summary: { ...meta, asOf: new Date().toISOString(), products: rows.length, stockUnits: sum(rows, 'stockQuantity'), inventoryValue: sum(rows, 'stockValue'), ...(type === 'inventory_valuation' ? { valueByCategory } : {}) },
      };
    }

    case 'customer_growth': {
      const [created, before] = await Promise.all([
        prisma.customer.findMany({ where: { businessId: business.id, createdAt: { gte: ctx.range.from, lte: ctx.range.to } }, select: { createdAt: true } }),
        prisma.customer.count({ where: { businessId: business.id, createdAt: { lt: ctx.range.from } } }),
      ]);
      const buckets = new Map(buildBuckets(ctx.range, ctx.interval, ctx.tz).map((d) => [d, 0]));
      for (const c of created) {
        const k = bucketKey(c.createdAt, ctx.interval, ctx.tz);
        if (buckets.has(k)) buckets.set(k, (buckets.get(k) ?? 0) + 1);
      }
      let running = before;
      const rows = [...buckets.entries()].map(([period, n]) => ({ period, newCustomers: n, totalCustomers: (running += n) }));
      return { ...base, columns: [text('period', 'Period'), num('newCustomers', 'New customers'), num('totalCustomers', 'Total customers')], rows, summary: { ...rangeMeta, newCustomers: created.length, totalCustomers: running } };
    }

    case 'new_customers': {
      const customers = await prisma.customer.findMany({ where: { businessId: business.id, createdAt: { gte: ctx.range.from, lte: ctx.range.to } }, orderBy: { createdAt: 'desc' }, take: MAX_ROWS });
      const rows = customers.map((c) => ({ name: c.name, email: c.email ?? '', phone: c.phone ?? '', city: c.city ?? '', country: c.country ?? '', joined: isoDay(c.createdAt, ctx.tz) }));
      return { ...base, columns: [text('name', 'Name'), text('email', 'Email'), text('phone', 'Phone'), text('city', 'City'), text('country', 'Country'), date('joined', 'Joined')], rows, summary: { ...rangeMeta, newCustomers: rows.length } };
    }

    case 'returning_customers':
    case 'high_value_customers': {
      // Reuse the cached per-customer stats (shared with the customer endpoints) and fetch only the columns we print.
      const [customers, stats] = await Promise.all([
        prisma.customer.findMany({ where: { businessId: business.id }, select: { id: true, name: true, email: true } }),
        customerStats(business.id),
      ]);
      const segment = m.makeSegmenter(stats.values(), new Date());
      const rows = customers
        .map((c) => ({ c, s: stats.get(c.id) }))
        .filter(({ s }) => (type === 'returning_customers' ? (s?.orders ?? 0) > 1 : segment(s) === 'HIGH_VALUE'))
        .sort((a, b) => (b.s?.spent ?? 0) - (a.s?.spent ?? 0))
        .slice(0, MAX_ROWS)
        .map(({ c, s }) => ({ name: c.name, email: c.email ?? '', orders: s?.orders ?? 0, totalSpent: s?.spent ?? 0, averageOrderValue: s?.orders ? round(s.spent / s.orders) : 0, lastPurchase: s ? isoDay(s.lastOrderAt, ctx.tz) : '' }));
      return { ...base, columns: [text('name', 'Customer'), text('email', 'Email'), num('orders', 'Orders'), money('totalSpent', 'Total spent'), money('averageOrderValue', 'Avg. order value'), date('lastPurchase', 'Last purchase')], rows, summary: { ...meta, customers: rows.length, totalSpent: sum(rows, 'totalSpent') } };
    }
  }
}

// ---------------------------------------------------------------------------
// Persistence
// ---------------------------------------------------------------------------

export async function generateReport(business: Business, userId: string, input: GenerateReportInput) {
  const created = await prisma.report.create({
    data: { businessId: business.id, userId, reportType: input.reportType, title: TITLES[input.reportType], filters: input as unknown as Prisma.InputJsonValue, status: 'PENDING' },
  });
  try {
    const data = await buildReport(business, input);
    const truncated = data.rows.length > MAX_ROWS;
    if (truncated) data.rows = data.rows.slice(0, MAX_ROWS);
    return await prisma.report.update({
      where: { id: created.id },
      data: { status: 'COMPLETED', title: data.title, data: { ...data, summary: { ...data.summary, truncated } } as unknown as Prisma.InputJsonValue },
    });
  } catch (err) {
    await prisma.report.update({ where: { id: created.id }, data: { status: 'FAILED', error: (err as Error).message.slice(0, 300) } });
    throw err;
  }
}

const listSelect = { id: true, businessId: true, userId: true, reportType: true, title: true, status: true, filters: true, createdAt: true } as const;

export async function listReports(businessId: string, q: { page: number; limit: number; reportType?: string }) {
  const where: Prisma.ReportWhereInput = { businessId, ...(q.reportType ? { reportType: q.reportType } : {}) };
  const [items, total] = await Promise.all([
    prisma.report.findMany({ where, select: listSelect, orderBy: { createdAt: 'desc' }, skip: (q.page - 1) * q.limit, take: q.limit }),
    prisma.report.count({ where }),
  ]);
  return { items, total };
}

export async function getReport(businessId: string, id: string) {
  const report = await prisma.report.findFirst({ where: { id, businessId } });
  if (!report) throw ApiError.notFound('Report not found');
  return report;
}

export async function deleteReport(businessId: string, id: string) {
  await getReport(businessId, id);
  await prisma.report.delete({ where: { id } });
}

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

export async function loadReportData(businessId: string, id: string) {
  const report = await getReport(businessId, id);
  if (report.status !== 'COMPLETED' || !report.data) throw ApiError.conflict('This report has no data to export');
  return { report, data: report.data as unknown as ReportData };
}

export const exportFileName = (title: string, id: string, ext: string) =>
  `${title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}-${id.slice(-6)}.${ext}`;

export function reportToCsv(data: ReportData): string {
  return toCsv(data.columns, data.rows);
}

