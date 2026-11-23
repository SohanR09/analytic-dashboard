import type { Business, Prisma } from '@prisma/client';
import { prisma } from '../config/prisma';
import { ApiError } from '../utils/ApiError';
import { bucketKey, buildBuckets } from '../utils/dates';
import { growth, round } from '../utils/helpers';
import { pageMeta, paginate } from '../utils/response';
import type { CreateCustomerInput, CustomerAnalyticsQuery, ListCustomersQuery, UpdateCustomerInput } from '../validators/customer.validator';
import * as m from './analytics.metrics';
import { buildCtx, cacheParams, loadOrders, rangeInfo } from './analytics.service';
import * as cache from './cache.service';

/**
 * Lifetime stats per buying customer, cached (versioned). We cache the AGGREGATE - one small record per
 * customer - not the raw orders: 100k orders serialize to ~16 MB of JSON, and stringifying / parsing that on
 * every request blocked the event loop for 50-100 ms.
 */
export async function customerStats(businessId: string): Promise<Map<string, m.CustomerStat>> {
  const rows = await cache.wrap(businessId, 'customer-stats', {}, async () => {
    const orders = await loadOrders(businessId, null, { where: { customerId: { not: null } } });
    return [...m.buildCustomerStats(orders).values()];
  });
  // dates are strings after a cache hit
  return new Map(rows.map((s) => [s.customerId, { ...s, firstOrderAt: new Date(s.firstOrderAt), lastOrderAt: new Date(s.lastOrderAt) }]));
}

export async function listCustomers(businessId: string, q: ListCustomersQuery) {
  const where: Prisma.CustomerWhereInput = {
    businessId,
    ...(q.search
      ? {
          OR: [
            { name: { contains: q.search, mode: 'insensitive' } },
            { email: { contains: q.search, mode: 'insensitive' } },
            { phone: { contains: q.search } },
          ],
        }
      : {}),
  };

  // Sorting/filtering on derived stats (spend, order count, segment) needs every customer in memory.
  // The default listing (by join date, no segment filter) is paginated by MongoDB instead.
  const dbPaged = q.sortBy === 'createdAt' && !q.type;

  const [customers, total, stats] = await Promise.all([
    dbPaged
      ? prisma.customer.findMany({ where, orderBy: { createdAt: q.order }, skip: (q.page - 1) * q.limit, take: q.limit })
      : prisma.customer.findMany({ where }),
    dbPaged ? prisma.customer.count({ where }) : Promise.resolve(0),
    customerStats(businessId),
  ]);

  const segment = m.makeSegmenter(stats.values(), new Date());

  let rows = customers.map((c) => {
    const s = stats.get(c.id);
    return {
      ...c,
      totalOrders: s?.orders ?? 0,
      totalSpent: s?.spent ?? 0,
      averageOrderValue: s && s.orders ? round(s.spent / s.orders) : 0,
      lastPurchaseDate: s?.lastOrderAt ?? null,
      customerType: segment(s),
    };
  });
  if (dbPaged) return { items: rows, meta: pageMeta(q.page, q.limit, total) };

  if (q.type) rows = rows.filter((r) => r.customerType === q.type);

  const dir = q.order === 'asc' ? 1 : -1;
  rows.sort((a, b) => {
    switch (q.sortBy) {
      case 'name':
        return a.name.localeCompare(b.name) * dir;
      case 'totalSpent':
        return (a.totalSpent - b.totalSpent) * dir;
      case 'totalOrders':
        return (a.totalOrders - b.totalOrders) * dir;
      default:
        return (a.createdAt.getTime() - b.createdAt.getTime()) * dir;
    }
  });
  return paginate(rows, q.page, q.limit);
}

export async function getCustomerDetail(business: Business, id: string) {
  const customer = await prisma.customer.findFirst({ where: { id, businessId: business.id } });
  if (!customer) throw ApiError.notFound('Customer not found');

  const [mine, all] = await Promise.all([
    loadOrders(business.id, null, { items: true, where: { customerId: id } }),
    customerStats(business.id),
  ]);

  const eligible = mine.filter(m.isEligible);
  const stats = m.buildCustomerStats(mine).get(id);
  const segment = m.makeSegmenter(all.values(), new Date());

  return {
    customer,
    currency: business.currency,
    stats: {
      totalOrders: stats?.orders ?? 0,
      totalSpent: stats?.spent ?? 0,
      averageOrderValue: stats && stats.orders ? round(stats.spent / stats.orders) : 0,
      firstPurchaseDate: stats?.firstOrderAt ?? null,
      lastPurchaseDate: stats?.lastOrderAt ?? null,
      customerType: segment(stats),
    },
    mostPurchasedProducts: m.productBreakdown(eligible, 'units').slice(0, 10),
    purchaseHistory: [...mine]
      .sort((a, b) => b.orderDate.getTime() - a.orderDate.getTime())
      .slice(0, 50)
      .map((o) => ({
        id: o.id,
        orderNumber: o.orderNumber,
        orderDate: o.orderDate,
        orderStatus: o.orderStatus,
        paymentStatus: o.paymentStatus,
        totalAmount: o.totalAmount,
        itemCount: o.items.reduce((s, i) => s + i.quantity, 0),
      })),
  };
}

export async function createCustomer(businessId: string, input: CreateCustomerInput) {
  const created = await prisma.customer.create({ data: { ...input, email: input.email || null, businessId } });
  await cache.invalidateBusiness(businessId);
  return created;
}

export async function updateCustomer(businessId: string, id: string, input: UpdateCustomerInput) {
  const exists = await prisma.customer.findFirst({ where: { id, businessId }, select: { id: true } });
  if (!exists) throw ApiError.notFound('Customer not found');
  const { email, ...rest } = input;
  const updated = await prisma.customer.update({ where: { id }, data: { ...rest, ...(email !== undefined ? { email: email || null } : {}) } });
  await cache.invalidateBusiness(businessId);
  return updated;
}

/** Their orders are kept (revenue is unaffected) and become guest orders. */
export async function deleteCustomer(businessId: string, id: string) {
  const exists = await prisma.customer.findFirst({ where: { id, businessId }, select: { id: true } });
  if (!exists) throw ApiError.notFound('Customer not found');
  await prisma.$transaction([
    prisma.order.updateMany({ where: { businessId, customerId: id }, data: { customerId: null } }),
    prisma.customer.delete({ where: { id } }),
  ]);
  await cache.invalidateBusiness(businessId);
}

// ---------------------------------------------------------------------------
// Customer analytics
// ---------------------------------------------------------------------------

export async function getCustomerAnalytics(business: Business, q: CustomerAnalyticsQuery) {
  const ctx = buildCtx(business, q);
  return cache.wrap(business.id, 'customer-analytics', cacheParams(ctx, { limit: q.limit }), async () => {
    // Needs per-order dates (stats as of the period end, buyers active within it), so it reads orders up to
    // the period end directly; the whole response is cached below, so this runs once per range per minute.
    const [orders, totalNow, totalAtEnd, createdInRange, createdPrev, createdBefore, newCustomerDates] = await Promise.all([
      loadOrders(business.id, { from: new Date(0), to: ctx.range.to }, { where: { customerId: { not: null } } }),
      prisma.customer.count({ where: { businessId: business.id } }),
      prisma.customer.count({ where: { businessId: business.id, createdAt: { lte: ctx.range.to } } }),
      prisma.customer.count({ where: { businessId: business.id, createdAt: { gte: ctx.range.from, lte: ctx.range.to } } }),
      prisma.customer.count({ where: { businessId: business.id, createdAt: { gte: ctx.prev.from, lte: ctx.prev.to } } }),
      prisma.customer.count({ where: { businessId: business.id, createdAt: { lt: ctx.range.from } } }),
      prisma.customer.findMany({ where: { businessId: business.id, createdAt: { gte: ctx.range.from, lte: ctx.range.to } }, select: { createdAt: true } }),
    ]);

    // Lifetime stats as of the END of the selected period.
    const upToEnd = orders.filter((o) => o.orderDate <= ctx.range.to);
    const stats = m.buildCustomerStats(upToEnd);
    const buyers = [...stats.values()];

    const activeIds = new Set(
      upToEnd.filter((o) => o.orderDate >= ctx.range.from && m.isEligible(o) && o.customerId).map((o) => o.customerId as string),
    );
    const returning = [...activeIds].filter((id) => (stats.get(id)?.orders ?? 0) > 1).length; // more than one qualifying order

    const segment = m.makeSegmenter(buyers, ctx.range.to);
    const seg = { HIGH_VALUE: 0, REGULAR: 0, INACTIVE: 0 };
    for (const s of buyers) seg[segment(s)]++;
    seg.INACTIVE += Math.max(0, totalAtEnd - buyers.length); // registered but never purchased

    // Customer growth chart: new customers per bucket + running total.
    const perBucket = new Map(buildBuckets(ctx.range, ctx.interval, ctx.tz).map((d) => [d, 0]));
    for (const c of newCustomerDates) {
      const key = bucketKey(c.createdAt, ctx.interval, ctx.tz);
      if (perBucket.has(key)) perBucket.set(key, (perBucket.get(key) ?? 0) + 1);
    }
    let running = createdBefore;
    const growthSeries = [...perBucket.entries()].map(([date, n]) => ({ date, newCustomers: n, totalCustomers: (running += n) }));

    const totalSpent = buyers.reduce((s, b) => s + b.spent, 0);
    const totalOrders = buyers.reduce((s, b) => s + b.orders, 0);

    const top = [...buyers].sort((a, b) => b.spent - a.spent).slice(0, Math.max(q.limit, 1));
    const scatterBuyers = [...buyers].sort((a, b) => b.spent - a.spent).slice(0, 300);
    const named = await prisma.customer.findMany({
      where: { businessId: business.id, id: { in: [...new Set([...top, ...scatterBuyers].map((b) => b.customerId))] } },
      select: { id: true, name: true, email: true },
    });
    const nameOf = new Map(named.map((c) => [c.id, c]));

    return {
      ...rangeInfo(ctx),
      summary: {
        totalCustomers: totalNow,
        newCustomers: createdInRange,
        newCustomersGrowth: growth(createdInRange, createdPrev),
        returningCustomers: returning,
        averageLifetimeValue: buyers.length ? round(totalSpent / buyers.length) : 0,
        averageOrdersPerCustomer: buyers.length ? round(totalOrders / buyers.length) : 0,
      },
      customerGrowth: growthSeries,
      newVsReturning: [
        { type: 'first_time', customers: activeIds.size - returning },
        { type: 'returning', customers: returning },
      ],
      segments: [
        { segment: 'HIGH_VALUE', customers: seg.HIGH_VALUE },
        { segment: 'REGULAR', customers: seg.REGULAR },
        { segment: 'INACTIVE', customers: seg.INACTIVE },
      ],
      topCustomers: top.map((b) => ({
        customerId: b.customerId,
        name: nameOf.get(b.customerId)?.name ?? 'Unknown',
        email: nameOf.get(b.customerId)?.email ?? null,
        orders: b.orders,
        totalSpent: b.spent,
        lastPurchaseDate: b.lastOrderAt,
      })),
      purchasingBehavior: scatterBuyers.map((b) => ({
        customerId: b.customerId,
        name: nameOf.get(b.customerId)?.name ?? 'Unknown',
        orders: b.orders,
        totalSpent: b.spent,
        averageOrderValue: round(b.spent / b.orders),
      })),
    };
  });
}

export type CustomerWhere = Prisma.CustomerWhereInput;
