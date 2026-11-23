import type { Business, Prisma } from '@prisma/client';
import { prisma } from '../config/prisma';
import { ApiError } from '../utils/ApiError';
import { autoInterval, previousRange, resolveRange, type DateRange, type DateRangeInput, type Interval } from '../utils/dates';
import { growth } from '../utils/helpers';
import * as cache from './cache.service';
import * as m from './analytics.metrics';
import type { OrderRow } from './analytics.metrics';
import { settingsOf } from './business.service';

const BATCH = 1000;
const MAX_ORDERS = 100_000;

const BASE_SELECT = {
  id: true,
  orderNumber: true,
  customerId: true,
  orderDate: true,
  orderStatus: true,
  paymentStatus: true,
  paymentMethod: true,
  subtotal: true,
  discountAmount: true,
  taxAmount: true,
  shippingAmount: true,
  refundAmount: true,
  totalAmount: true,
} satisfies Prisma.OrderSelect;

/**
 * Streams a business's orders from MongoDB in id-ordered batches (cursor pagination) into lightweight rows.
 * `range = null` loads all time. Pass `items: true` only when line items are needed.
 */
export async function loadOrders(
  businessId: string,
  range: DateRange | null,
  opts: { items?: boolean; where?: Prisma.OrderWhereInput } = {},
): Promise<OrderRow[]> {
  const where: Prisma.OrderWhereInput = {
    businessId,
    ...(range ? { orderDate: { gte: range.from, lte: range.to } } : {}),
    ...opts.where,
  };
  const select = { ...BASE_SELECT, items: !!opts.items } satisfies Prisma.OrderSelect;

  const rows: OrderRow[] = [];
  let cursor: string | undefined;
  for (;;) {
    const batch = await prisma.order.findMany({
      where,
      select,
      orderBy: { id: 'asc' },
      take: BATCH,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    });
    for (const o of batch) rows.push({ ...o, items: (o as { items?: OrderRow['items'] }).items ?? [] });
    if (rows.length > MAX_ORDERS) {
      throw ApiError.badRequest(`Too many orders (over ${MAX_ORDERS}) for this query; narrow the date range`);
    }
    if (batch.length < BATCH) break;
    cursor = batch[batch.length - 1].id;
  }
  return rows;
}

// ---------------------------------------------------------------------------
// Query context shared by every analytics endpoint
// ---------------------------------------------------------------------------

export interface AnalyticsInput extends DateRangeInput {
  interval?: Interval | 'auto';
}

export interface Ctx {
  business: Business;
  tz: string;
  currency: string;
  range: DateRange;
  prev: DateRange;
  interval: Interval;
}

export function buildCtx(business: Business, q: AnalyticsInput): Ctx {
  const preset = q.preset ?? (q.from || q.to ? 'custom' : settingsOf(business).preferences.defaultDateRange);
  const range = resolveRange({ ...q, preset: preset as DateRangeInput['preset'] }, business.timezone);
  return {
    business,
    tz: business.timezone,
    currency: business.currency,
    range,
    prev: previousRange(range),
    interval: !q.interval || q.interval === 'auto' ? autoInterval(range) : q.interval,
  };
}

/** Cache key material: the RESOLVED range (stable within a day for presets), never raw "now". */
export const cacheParams = (ctx: Ctx, extra: unknown = {}) => ({
  from: ctx.range.from.toISOString(),
  to: ctx.range.to.toISOString(),
  interval: ctx.interval,
  extra,
});

export const rangeInfo = (ctx: Ctx) => ({
  range: ctx.range,
  previousRange: ctx.prev,
  interval: ctx.interval,
  timezone: ctx.tz,
  currency: ctx.currency,
});

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------

const card = (key: string, title: string, value: number, previous: number) => ({
  key,
  title,
  value,
  previous,
  change: growth(value, previous),
});

export async function getDashboard(business: Business, q: AnalyticsInput & { limit: number; sortBy: 'revenue' | 'units' }) {
  const ctx = buildCtx(business, q);
  return cache.wrap(business.id, 'dashboard', cacheParams(ctx, { limit: q.limit, sortBy: q.sortBy }), async () => {
    const [orders, prevOrders, customers, customersPrev, products, productsPrev, recent] = await Promise.all([
      loadOrders(business.id, ctx.range, { items: true }),
      loadOrders(business.id, ctx.prev, { items: true }),
      prisma.customer.count({ where: { businessId: business.id, createdAt: { lte: ctx.range.to } } }),
      prisma.customer.count({ where: { businessId: business.id, createdAt: { lte: ctx.prev.to } } }),
      prisma.product.count({ where: { businessId: business.id, createdAt: { lte: ctx.range.to } } }),
      prisma.product.count({ where: { businessId: business.id, createdAt: { lte: ctx.prev.to } } }),
      prisma.order.findMany({
        where: { businessId: business.id, orderDate: { gte: ctx.range.from, lte: ctx.range.to } },
        orderBy: { orderDate: 'desc' },
        take: 10,
        select: {
          id: true,
          orderNumber: true,
          orderDate: true,
          totalAmount: true,
          orderStatus: true,
          paymentStatus: true,
          customer: { select: { id: true, name: true } },
        },
      }),
    ]);

    const cur = m.summarize(orders);
    const prv = m.summarize(prevOrders);
    const series = m.trend(orders, ctx.range, ctx.interval, ctx.tz);

    return {
      ...rangeInfo(ctx),
      cards: [
        card('totalRevenue', 'Total Revenue', cur.netRevenue, prv.netRevenue),
        card('totalOrders', 'Total Orders', cur.orders, prv.orders),
        card('totalCustomers', 'Total Customers', customers, customersPrev),
        card('totalProducts', 'Total Products', products, productsPrev),
        card('averageOrderValue', 'Average Order Value', cur.averageOrderValue, prv.averageOrderValue),
        card('unitsSold', 'Total Units Sold', cur.units, prv.units),
      ],
      revenueOverview: series.map((p) => ({ date: p.date, netRevenue: p.netRevenue, grossRevenue: p.grossRevenue })),
      salesOverview: series.map((p) => ({ date: p.date, orders: p.orders, units: p.units, netRevenue: p.netRevenue })),
      orderStatus: m.statusDistribution(orders),
      topProducts: m.topProducts(orders, q.limit, q.sortBy),
      salesByCategory: m.categoryBreakdown(orders),
      recentOrders: recent.map((o) => ({
        id: o.id,
        orderNumber: o.orderNumber,
        customer: o.customer?.name ?? 'Guest',
        orderDate: o.orderDate,
        amount: o.totalAmount,
        orderStatus: o.orderStatus,
        paymentStatus: o.paymentStatus,
      })),
    };
  });
}

export async function getRevenueOverview(business: Business, q: AnalyticsInput) {
  const ctx = buildCtx(business, q);
  return cache.wrap(business.id, 'dash-revenue', cacheParams(ctx), async () => {
    const orders = await loadOrders(business.id, ctx.range);
    const series = m.trend(orders, ctx.range, ctx.interval, ctx.tz);
    return { ...rangeInfo(ctx), points: series.map((p) => ({ date: p.date, netRevenue: p.netRevenue, grossRevenue: p.grossRevenue })) };
  });
}

export async function getSalesOverview(business: Business, q: AnalyticsInput) {
  const ctx = buildCtx(business, q);
  return cache.wrap(business.id, 'dash-sales', cacheParams(ctx), async () => {
    const orders = await loadOrders(business.id, ctx.range, { items: true });
    const series = m.trend(orders, ctx.range, ctx.interval, ctx.tz);
    return { ...rangeInfo(ctx), points: series.map((p) => ({ date: p.date, orders: p.orders, units: p.units, netRevenue: p.netRevenue })) };
  });
}

export async function getTopProducts(business: Business, q: AnalyticsInput & { limit: number; sortBy: 'revenue' | 'units' }) {
  const ctx = buildCtx(business, q);
  return cache.wrap(business.id, 'dash-top', cacheParams(ctx, { l: q.limit, s: q.sortBy }), async () => {
    const orders = await loadOrders(business.id, ctx.range, { items: true });
    return { ...rangeInfo(ctx), products: m.topProducts(orders, q.limit, q.sortBy) };
  });
}

export async function getOrderStatus(business: Business, q: AnalyticsInput) {
  const ctx = buildCtx(business, q);
  return cache.wrap(business.id, 'dash-status', cacheParams(ctx), async () => {
    const orders = await loadOrders(business.id, ctx.range);
    return { ...rangeInfo(ctx), distribution: m.statusDistribution(orders) };
  });
}
