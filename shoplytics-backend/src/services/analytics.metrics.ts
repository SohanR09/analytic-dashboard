import type { OrderStatus, PaymentStatus } from '@prisma/client';
import { buildBuckets, bucketKey, type DateRange, type Interval } from '../utils/dates';
import { growth, round } from '../utils/helpers';

/**
 * Pure analytics calculations (no I/O) following docs/REQUIREMENTS.md section 12.
 *
 *  Eligible order   : not CANCELLED and payment not FAILED. (REFUNDED orders stay eligible; their refund is subtracted.)
 *  Gross revenue    : sum of item totals before discounts            (order.subtotal)
 *  Net revenue      : gross - discounts - refunds                    (tax and shipping reported separately)
 *  Average order    : net revenue / number of eligible orders
 *  Product/category : "line revenue" = quantity * unitPrice, before order-level discounts
 */

export interface ItemRow {
  productId: string;
  name: string;
  sku: string;
  categoryId: string | null;
  categoryName: string;
  quantity: number;
  unitPrice: number;
  unitCost: number;
  totalPrice: number;
}

export interface OrderRow {
  id: string;
  orderNumber: string;
  customerId: string | null;
  orderDate: Date;
  orderStatus: OrderStatus;
  paymentStatus: PaymentStatus;
  paymentMethod: string | null;
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  shippingAmount: number;
  refundAmount: number;
  totalAmount: number;
  items: ItemRow[];
}

export const ORDER_STATUS_ORDER: OrderStatus[] = ['PENDING', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'REFUNDED'];

export const isEligible = (o: Pick<OrderRow, 'orderStatus' | 'paymentStatus'>): boolean =>
  o.orderStatus !== 'CANCELLED' && o.paymentStatus !== 'FAILED';

export const netRevenueOf = (o: Pick<OrderRow, 'subtotal' | 'discountAmount' | 'refundAmount'>): number =>
  o.subtotal - o.discountAmount - o.refundAmount;

const units = (o: OrderRow) => o.items.reduce((s, i) => s + i.quantity, 0);

// ---------------------------------------------------------------------------
// Filtering by product / category
// ---------------------------------------------------------------------------

/**
 * Restrict orders to matching line items. Order-level amounts (discount, tax, shipping, refund) are
 * allocated to the matching lines in proportion to their share of the order subtotal, so filtered
 * figures still add up consistently.
 */
export function filterLines(orders: OrderRow[], f: { productId?: string; categoryId?: string }): OrderRow[] {
  if (!f.productId && !f.categoryId) return orders;
  const out: OrderRow[] = [];
  for (const o of orders) {
    const items = o.items.filter(
      (i) => (!f.productId || i.productId === f.productId) && (!f.categoryId || i.categoryId === f.categoryId),
    );
    if (!items.length) continue;
    const subtotal = items.reduce((s, i) => s + i.totalPrice, 0);
    const share = o.subtotal > 0 ? subtotal / o.subtotal : 0;
    out.push({
      ...o,
      items,
      subtotal,
      discountAmount: o.discountAmount * share,
      taxAmount: o.taxAmount * share,
      shippingAmount: o.shippingAmount * share,
      refundAmount: o.refundAmount * share,
      totalAmount: o.totalAmount * share,
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Totals
// ---------------------------------------------------------------------------

export interface Totals {
  orders: number;
  units: number;
  grossRevenue: number;
  discounts: number;
  refunds: number;
  netRevenue: number;
  taxCollected: number;
  shipping: number;
  averageOrderValue: number;
  uniqueCustomers: number;
}

export function summarize(orders: OrderRow[]): Totals {
  let count = 0,
    unitCount = 0,
    gross = 0,
    discounts = 0,
    refunds = 0,
    tax = 0,
    shipping = 0;
  const customers = new Set<string>();

  for (const o of orders) {
    if (!isEligible(o)) continue;
    count++;
    unitCount += units(o);
    gross += o.subtotal;
    discounts += o.discountAmount;
    refunds += o.refundAmount;
    tax += o.taxAmount;
    shipping += o.shippingAmount;
    if (o.customerId) customers.add(o.customerId);
  }

  const net = gross - discounts - refunds;
  return {
    orders: count,
    units: unitCount,
    grossRevenue: round(gross),
    discounts: round(discounts),
    refunds: round(refunds),
    netRevenue: round(net),
    taxCollected: round(tax),
    shipping: round(shipping),
    averageOrderValue: count > 0 ? round(net / count) : 0,
    uniqueCustomers: customers.size,
  };
}

export interface Compared<T> {
  current: T;
  previous: T;
  growth: Record<string, number | null>;
}

export function compareTotals(current: Totals, previous: Totals): Compared<Totals> {
  const keys = ['orders', 'units', 'grossRevenue', 'discounts', 'refunds', 'netRevenue', 'taxCollected', 'averageOrderValue'] as const;
  const g: Record<string, number | null> = {};
  for (const k of keys) g[k] = growth(current[k], previous[k]);
  return { current, previous, growth: g };
}

// ---------------------------------------------------------------------------
// Time series
// ---------------------------------------------------------------------------

export interface TrendPoint {
  date: string;
  orders: number;
  units: number;
  grossRevenue: number;
  discounts: number;
  refunds: number;
  netRevenue: number;
  taxCollected: number;
}

/** One point per bucket (zero-filled), bucketed in the business time zone. */
export function trend(orders: OrderRow[], range: DateRange, interval: Interval, tz: string): TrendPoint[] {
  const points = new Map<string, TrendPoint>();
  for (const date of buildBuckets(range, interval, tz)) {
    points.set(date, { date, orders: 0, units: 0, grossRevenue: 0, discounts: 0, refunds: 0, netRevenue: 0, taxCollected: 0 });
  }
  for (const o of orders) {
    if (!isEligible(o)) continue;
    const p = points.get(bucketKey(o.orderDate, interval, tz));
    if (!p) continue;
    p.orders++;
    p.units += units(o);
    p.grossRevenue += o.subtotal;
    p.discounts += o.discountAmount;
    p.refunds += o.refundAmount;
    p.taxCollected += o.taxAmount;
  }
  return [...points.values()].map((p) => ({
    ...p,
    grossRevenue: round(p.grossRevenue),
    discounts: round(p.discounts),
    refunds: round(p.refunds),
    taxCollected: round(p.taxCollected),
    netRevenue: round(p.grossRevenue - p.discounts - p.refunds),
  }));
}

// ---------------------------------------------------------------------------
// Breakdowns
// ---------------------------------------------------------------------------

export function statusDistribution(orders: OrderRow[]) {
  const map = new Map(ORDER_STATUS_ORDER.map((s) => [s, { status: s, orders: 0, amount: 0 }]));
  for (const o of orders) {
    const e = map.get(o.orderStatus)!;
    e.orders++;
    e.amount += o.totalAmount;
  }
  return [...map.values()].map((e) => ({ ...e, amount: round(e.amount) }));
}

export interface ProductSales {
  productId: string;
  name: string;
  sku: string;
  categoryName: string;
  unitsSold: number;
  orders: number;
  revenue: number;
}

export function productBreakdown(orders: OrderRow[], sortBy: 'revenue' | 'units' = 'revenue'): ProductSales[] {
  const map = new Map<string, ProductSales>();
  for (const o of orders) {
    if (!isEligible(o)) continue;
    const seen = new Set<string>();
    for (const i of o.items) {
      const e =
        map.get(i.productId) ??
        { productId: i.productId, name: i.name, sku: i.sku, categoryName: i.categoryName, unitsSold: 0, orders: 0, revenue: 0 };
      e.unitsSold += i.quantity;
      e.revenue += i.totalPrice;
      if (!seen.has(i.productId)) {
        e.orders++;
        seen.add(i.productId);
      }
      map.set(i.productId, e);
    }
  }
  return [...map.values()]
    .map((e) => ({ ...e, revenue: round(e.revenue) }))
    .sort((a, b) =>
      sortBy === 'units' ? b.unitsSold - a.unitsSold || b.revenue - a.revenue : b.revenue - a.revenue || b.unitsSold - a.unitsSold,
    );
}

export const topProducts = (orders: OrderRow[], limit: number, sortBy: 'revenue' | 'units' = 'revenue') =>
  productBreakdown(orders, sortBy).slice(0, limit);

export function categoryBreakdown(orders: OrderRow[]) {
  const map = new Map<string, { categoryId: string | null; category: string; unitsSold: number; revenue: number }>();
  for (const o of orders) {
    if (!isEligible(o)) continue;
    for (const i of o.items) {
      const key = i.categoryId ?? '__none__';
      const e = map.get(key) ?? { categoryId: i.categoryId, category: i.categoryName, unitsSold: 0, revenue: 0 };
      e.unitsSold += i.quantity;
      e.revenue += i.totalPrice;
      map.set(key, e);
    }
  }
  const rows = [...map.values()].sort((a, b) => b.revenue - a.revenue);
  const total = rows.reduce((s, r) => s + r.revenue, 0);
  return rows.map((r) => ({ ...r, revenue: round(r.revenue), share: total > 0 ? round((r.revenue / total) * 100) : 0 }));
}

export function paymentMethodBreakdown(orders: OrderRow[]) {
  const map = new Map<string, { method: string; orders: number; netRevenue: number }>();
  for (const o of orders) {
    if (!isEligible(o)) continue;
    const method = o.paymentMethod || 'unknown';
    const e = map.get(method) ?? { method, orders: 0, netRevenue: 0 };
    e.orders++;
    e.netRevenue += netRevenueOf(o);
    map.set(method, e);
  }
  return [...map.values()].map((e) => ({ ...e, netRevenue: round(e.netRevenue) })).sort((a, b) => b.netRevenue - a.netRevenue);
}

// ---------------------------------------------------------------------------
// Customers
// ---------------------------------------------------------------------------

export interface CustomerStat {
  customerId: string;
  orders: number;
  spent: number;
  firstOrderAt: Date;
  lastOrderAt: Date;
}

export type Segment = 'HIGH_VALUE' | 'REGULAR' | 'INACTIVE';

export function buildCustomerStats(orders: Pick<OrderRow, 'customerId' | 'orderDate' | 'orderStatus' | 'paymentStatus' | 'subtotal' | 'discountAmount' | 'refundAmount'>[]): Map<string, CustomerStat> {
  const map = new Map<string, CustomerStat>();
  for (const o of orders) {
    if (!o.customerId || !isEligible(o)) continue;
    const e = map.get(o.customerId) ?? { customerId: o.customerId, orders: 0, spent: 0, firstOrderAt: o.orderDate, lastOrderAt: o.orderDate };
    e.orders++;
    e.spent += netRevenueOf(o);
    if (o.orderDate < e.firstOrderAt) e.firstOrderAt = o.orderDate;
    if (o.orderDate > e.lastOrderAt) e.lastOrderAt = o.orderDate;
    map.set(o.customerId, e);
  }
  for (const e of map.values()) e.spent = round(e.spent);
  return map;
}

/**
 * Customer segments:
 *  INACTIVE   - never purchased, or last purchase more than `inactiveDays` before `asOf`
 *  HIGH_VALUE - top 20% of buyers by lifetime spend (only meaningful with at least 5 buyers)
 *  REGULAR    - everyone else
 */
export function makeSegmenter(stats: Iterable<CustomerStat>, asOf: Date, inactiveDays = 90) {
  const buyers = [...stats].filter((s) => s.orders > 0).sort((a, b) => b.spent - a.spent);
  const threshold = buyers.length >= 5 ? buyers[Math.max(1, Math.ceil(buyers.length * 0.2)) - 1].spent : Infinity;
  const cutoff = asOf.getTime() - inactiveDays * 86_400_000;

  return (s?: CustomerStat): Segment => {
    if (!s || s.orders === 0 || s.lastOrderAt.getTime() < cutoff) return 'INACTIVE';
    return s.spent >= threshold && s.spent > 0 ? 'HIGH_VALUE' : 'REGULAR';
  };
}
