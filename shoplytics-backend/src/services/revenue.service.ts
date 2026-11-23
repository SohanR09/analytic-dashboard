import type { Business, Prisma } from '@prisma/client';
import { prisma } from '../config/prisma';
import { ApiError } from '../utils/ApiError';
import { previousRange, resolveRange, type DateRange } from '../utils/dates';
import { round } from '../utils/helpers';
import type { AnalyticsQuery, RecordsQuery } from '../validators/analytics.validator';
import * as m from './analytics.metrics';
import { buildCtx, cacheParams, loadOrders, rangeInfo } from './analytics.service';
import * as cache from './cache.service';

const filterWhere = (q: { productId?: string; categoryId?: string }): Prisma.OrderWhereInput =>
  q.productId || q.categoryId
    ? { items: { some: { ...(q.productId ? { productId: q.productId } : {}), ...(q.categoryId ? { categoryId: q.categoryId } : {}) } } }
    : {};

/** Per-order revenue records (eligible orders), newest first. */
export async function listRevenue(business: Business, q: RecordsQuery) {
  const range = resolveRange(q, business.timezone);
  const where: Prisma.OrderWhereInput = {
    businessId: business.id,
    orderDate: { gte: range.from, lte: range.to },
    orderStatus: q.orderStatus ?? { not: 'CANCELLED' },
    paymentStatus: { not: 'FAILED' },
    ...filterWhere(q),
  };
  const [rows, total] = await Promise.all([
    prisma.order.findMany({
      where,
      orderBy: { orderDate: 'desc' },
      skip: (q.page - 1) * q.limit,
      take: q.limit,
      select: {
        id: true,
        orderNumber: true,
        orderDate: true,
        orderStatus: true,
        paymentStatus: true,
        paymentMethod: true,
        subtotal: true,
        discountAmount: true,
        refundAmount: true,
        taxAmount: true,
        shippingAmount: true,
        totalAmount: true,
      },
    }),
    prisma.order.count({ where }),
  ]);
  return {
    items: rows.map((o) => ({
      id: o.id,
      orderNumber: o.orderNumber,
      orderDate: o.orderDate,
      orderStatus: o.orderStatus,
      paymentStatus: o.paymentStatus,
      paymentMethod: o.paymentMethod,
      grossRevenue: o.subtotal,
      discounts: o.discountAmount,
      refunds: o.refundAmount,
      netRevenue: round(m.netRevenueOf(o)),
      taxCollected: o.taxAmount,
      shipping: o.shippingAmount,
      billedTotal: o.totalAmount,
    })),
    total,
    range,
    currency: business.currency,
  };
}

function compareRange(q: AnalyticsQuery, tz: string, fallback: DateRange): DateRange {
  if (!q.compareFrom && !q.compareTo) return fallback;
  if (!q.compareFrom || !q.compareTo) throw ApiError.badRequest('Provide both compareFrom and compareTo');
  return resolveRange({ preset: 'custom', from: q.compareFrom, to: q.compareTo }, tz);
}

export async function getRevenueAnalytics(business: Business, q: AnalyticsQuery) {
  const ctx = buildCtx(business, q);
  const compare = compareRange(q, ctx.tz, ctx.prev);

  return cache.wrap(business.id, 'revenue-analytics', cacheParams(ctx, { f: [q.productId, q.categoryId], l: q.limit, c: [compare.from, compare.to] }), async () => {
    const load = async (range: DateRange) =>
      m.filterLines(await loadOrders(business.id, range, { items: true, where: filterWhere(q) }), q);
    const [orders, other] = await Promise.all([load(ctx.range), load(compare)]);
    const cmp = m.compareTotals(m.summarize(orders), m.summarize(other));

    return {
      ...rangeInfo(ctx),
      comparisonRange: compare,
      totals: {
        totalRevenue: cmp.current.netRevenue,
        grossRevenue: cmp.current.grossRevenue,
        netRevenue: cmp.current.netRevenue,
        discounts: cmp.current.discounts,
        refunds: cmp.current.refunds,
        taxCollected: cmp.current.taxCollected,
        shipping: cmp.current.shipping,
      },
      comparison: cmp.previous,
      growth: cmp.growth,
      revenueTrend: m.trend(orders, ctx.range, ctx.interval, ctx.tz),
      monthlyComparison: {
        current: m.trend(orders, ctx.range, 'month', ctx.tz).map((p) => ({ date: p.date, netRevenue: p.netRevenue })),
        comparison: m.trend(other, compare, 'month', ctx.tz).map((p) => ({ date: p.date, netRevenue: p.netRevenue })),
      },
      byProduct: m.productBreakdown(orders).slice(0, Math.max(q.limit, 10)),
      byCategory: m.categoryBreakdown(orders),
      byPaymentMethod: m.paymentMethodBreakdown(orders),
      highRevenueProducts: m.topProducts(orders, q.limit),
    };
  });
}

export async function getRevenueTrends(business: Business, q: AnalyticsQuery) {
  const ctx = buildCtx(business, q);
  return cache.wrap(business.id, 'revenue-trends', cacheParams(ctx, { f: [q.productId, q.categoryId] }), async () => {
    const orders = m.filterLines(await loadOrders(business.id, ctx.range, { items: !!(q.productId || q.categoryId), where: filterWhere(q) }), q);
    // `units` is omitted on purpose: line items are only loaded when a product/category filter is applied.
    return { ...rangeInfo(ctx), points: m.trend(orders, ctx.range, ctx.interval, ctx.tz).map(({ units: _units, ...p }) => p) };
  });
}

export { previousRange };
