import type { Business, Prisma } from '@prisma/client';
import { prisma } from '../config/prisma';
import { resolveRange } from '../utils/dates';
import type { AnalyticsQuery, RecordsQuery } from '../validators/analytics.validator';
import * as m from './analytics.metrics';
import { buildCtx, cacheParams, loadOrders, rangeInfo, type Ctx } from './analytics.service';
import * as cache from './cache.service';

/** Orders matching the product / category / status filters (a line must match BOTH product and category). */
function orderFilter(f: { productId?: string; categoryId?: string; orderStatus?: AnalyticsQuery['orderStatus'] }): Prisma.OrderWhereInput {
  return {
    ...(f.orderStatus ? { orderStatus: f.orderStatus } : {}),
    ...(f.productId || f.categoryId
      ? { items: { some: { ...(f.productId ? { productId: f.productId } : {}), ...(f.categoryId ? { categoryId: f.categoryId } : {}) } } }
      : {}),
  };
}

async function loadFiltered(ctx: Ctx, range: Ctx['range'], q: AnalyticsQuery) {
  const orders = await loadOrders(ctx.business.id, range, { items: true, where: orderFilter(q) });
  return m.filterLines(orders, { productId: q.productId, categoryId: q.categoryId });
}

/** Paginated sales records (eligible orders only), newest first. */
export async function listSales(business: Business, q: RecordsQuery) {
  const range = resolveRange(q, business.timezone);
  const where: Prisma.OrderWhereInput = {
    businessId: business.id,
    orderDate: { gte: range.from, lte: range.to },
    ...(q.orderStatus ? { orderStatus: q.orderStatus } : { orderStatus: { not: 'CANCELLED' } }),
    paymentStatus: { not: 'FAILED' },
    ...orderFilter(q),
  };
  const [rows, total] = await Promise.all([
    prisma.order.findMany({
      where,
      orderBy: { orderDate: 'desc' },
      skip: (q.page - 1) * q.limit,
      take: q.limit,
      include: { customer: { select: { id: true, name: true } } },
    }),
    prisma.order.count({ where }),
  ]);

  const items = rows.map((o) => {
    const lines = m.filterLines([{ ...o, items: o.items, customerId: o.customerId, paymentMethod: o.paymentMethod }], q)[0];
    return {
      id: o.id,
      orderNumber: o.orderNumber,
      orderDate: o.orderDate,
      customer: o.customer?.name ?? 'Guest',
      orderStatus: o.orderStatus,
      units: (lines?.items ?? o.items).reduce((s, i) => s + i.quantity, 0),
      grossSales: lines?.subtotal ?? o.subtotal,
      discounts: lines?.discountAmount ?? o.discountAmount,
      netSales: (lines ? m.netRevenueOf(lines) : m.netRevenueOf(o)),
    };
  });
  return { items, total, range, currency: business.currency };
}

export async function getSalesAnalytics(business: Business, q: AnalyticsQuery) {
  const ctx = buildCtx(business, q);
  return cache.wrap(business.id, 'sales-analytics', cacheParams(ctx, { f: [q.productId, q.categoryId, q.orderStatus], l: q.limit }), async () => {
    const [orders, prev] = await Promise.all([loadFiltered(ctx, ctx.range, q), loadFiltered(ctx, ctx.prev, q)]);
    const cmp = m.compareTotals(m.summarize(orders), m.summarize(prev));
    return {
      ...rangeInfo(ctx),
      totals: {
        totalSales: cmp.current.netRevenue,
        totalOrders: cmp.current.orders,
        averageOrderValue: cmp.current.averageOrderValue,
        unitsSold: cmp.current.units,
      },
      previous: cmp.previous,
      growth: { sales: cmp.growth.netRevenue, orders: cmp.growth.orders, units: cmp.growth.units, averageOrderValue: cmp.growth.averageOrderValue },
      salesByCategory: m.categoryBreakdown(orders),
      salesByProduct: m.productBreakdown(orders, q.sortBy).slice(0, Math.max(q.limit, 10)),
      ordersOverTime: m.trend(orders, ctx.range, ctx.interval, ctx.tz).map((p) => ({ date: p.date, orders: p.orders, units: p.units })),
      orderStatus: m.statusDistribution(orders),
    };
  });
}

export async function getSalesTrends(business: Business, q: AnalyticsQuery) {
  const ctx = buildCtx(business, q);
  return cache.wrap(business.id, 'sales-trends', cacheParams(ctx, { f: [q.productId, q.categoryId, q.orderStatus] }), async () => {
    const orders = await loadFiltered(ctx, ctx.range, q);
    return {
      ...rangeInfo(ctx),
      points: m.trend(orders, ctx.range, ctx.interval, ctx.tz).map((p) => ({
        date: p.date,
        sales: p.netRevenue,
        orders: p.orders,
        units: p.units,
      })),
    };
  });
}
