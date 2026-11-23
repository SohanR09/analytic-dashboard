import { describe, expect, it } from 'vitest';
import * as m from '../../src/services/analytics.metrics';
import type { ItemRow, OrderRow } from '../../src/services/analytics.metrics';
import { resolveRange } from '../../src/utils/dates';
import { growth } from '../../src/utils/helpers';

let seq = 0;
const item = (o: Partial<ItemRow> = {}): ItemRow => ({
  productId: 'p1', name: 'Tee', sku: 'TEE', categoryId: 'c1', categoryName: 'Tops', quantity: 1, unitPrice: 10, unitCost: 4, totalPrice: 10, ...o,
});
const order = (o: Partial<OrderRow> = {}): OrderRow => {
  const items = o.items ?? [item()];
  const subtotal = o.subtotal ?? items.reduce((s, i) => s + i.totalPrice, 0);
  return {
    id: `o${++seq}`, orderNumber: `ORD-${seq}`, customerId: null, orderDate: new Date('2026-11-10T12:00:00Z'), orderStatus: 'DELIVERED', paymentStatus: 'PAID',
    paymentMethod: 'card', subtotal, discountAmount: 0, taxAmount: 0, shippingAmount: 0, refundAmount: 0, totalAmount: subtotal, ...o, items,
  };
};

describe('summarize', () => {
  it('computes gross / net revenue, tax, AOV and units per the spec formulas', () => {
    const t = m.summarize([
      order({ items: [item({ quantity: 2, totalPrice: 20 })], discountAmount: 2, taxAmount: 1.5, shippingAmount: 5 }),
      order({ items: [item({ quantity: 1, totalPrice: 10 })], refundAmount: 4, orderStatus: 'REFUNDED' }),
    ]);
    expect(t.orders).toBe(2);
    expect(t.units).toBe(3);
    expect(t.grossRevenue).toBe(30);
    expect(t.discounts).toBe(2);
    expect(t.refunds).toBe(4);
    expect(t.netRevenue).toBe(24); // 30 - 2 - 4
    expect(t.taxCollected).toBe(1.5);
    expect(t.shipping).toBe(5);
    expect(t.averageOrderValue).toBe(12); // 24 / 2
  });

  it('excludes cancelled orders and failed payments', () => {
    const t = m.summarize([order(), order({ orderStatus: 'CANCELLED' }), order({ paymentStatus: 'FAILED', orderStatus: 'PENDING' })]);
    expect(t.orders).toBe(1);
    expect(t.netRevenue).toBe(10);
  });

  it('handles an empty dataset', () => {
    const t = m.summarize([]);
    expect(t).toMatchObject({ orders: 0, units: 0, netRevenue: 0, averageOrderValue: 0, uniqueCustomers: 0 });
  });

  it('counts unique customers once', () => {
    expect(m.summarize([order({ customerId: 'a' }), order({ customerId: 'a' }), order({ customerId: 'b' }), order()]).uniqueCustomers).toBe(2);
  });
});

describe('growth', () => {
  it('computes percentage change', () => {
    expect(growth(150, 100)).toBe(50);
    expect(growth(50, 100)).toBe(-50);
  });
  it('handles a zero baseline separately (null = no baseline, 0 = unchanged)', () => {
    expect(growth(10, 0)).toBeNull();
    expect(growth(0, 0)).toBe(0);
  });
});

describe('trend', () => {
  const range = resolveRange({ from: '2026-11-01', to: '2026-11-05' }, 'Asia/Kolkata', new Date('2026-11-21T00:00:00Z'));

  it('zero-fills every bucket in the range', () => {
    const pts = m.trend([order({ orderDate: new Date('2026-11-03T06:00:00Z') })], range, 'day', 'Asia/Kolkata');
    expect(pts.map((p) => p.date)).toEqual(['2026-11-01', '2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05']);
    expect(pts.map((p) => p.orders)).toEqual([0, 0, 1, 0, 0]);
  });

  it('buckets by the business time zone, not UTC', () => {
    // 20:00 UTC on Nov 1 = 01:30 on Nov 2 in Kolkata
    const pts = m.trend([order({ orderDate: new Date('2026-11-01T20:00:00Z') })], range, 'day', 'Asia/Kolkata');
    expect(pts.find((p) => p.date === '2026-11-02')!.orders).toBe(1);
    expect(pts.find((p) => p.date === '2026-11-01')!.orders).toBe(0);
  });

  it('ignores orders outside the range and ineligible orders', () => {
    const pts = m.trend([order({ orderDate: new Date('2026-12-25T00:00:00Z') }), order({ orderDate: new Date('2026-11-02T06:00:00Z'), orderStatus: 'CANCELLED' })], range, 'day', 'Asia/Kolkata');
    expect(pts.reduce((s, p) => s + p.orders, 0)).toBe(0);
  });

  it('net revenue per bucket = gross - discounts - refunds', () => {
    const pts = m.trend([order({ orderDate: new Date('2026-11-02T06:00:00Z'), items: [item({ totalPrice: 100, quantity: 10 })], discountAmount: 10, refundAmount: 20 })], range, 'day', 'Asia/Kolkata');
    expect(pts.find((p) => p.date === '2026-11-02')).toMatchObject({ grossRevenue: 100, discounts: 10, refunds: 20, netRevenue: 70 });
  });
});

describe('filterLines', () => {
  const a = item({ productId: 'a', categoryId: 'c1', totalPrice: 60, quantity: 6 });
  const b = item({ productId: 'b', categoryId: 'c2', totalPrice: 40, quantity: 4 });

  it('returns orders untouched without filters', () => {
    const o = [order({ items: [a, b] })];
    expect(m.filterLines(o, {})).toBe(o);
  });

  it('keeps only matching lines and allocates order-level amounts proportionally', () => {
    const [f] = m.filterLines([order({ items: [a, b], discountAmount: 10, taxAmount: 5, refundAmount: 20 })], { productId: 'a' });
    expect(f.items).toHaveLength(1);
    expect(f.subtotal).toBe(60);
    expect(f.discountAmount).toBeCloseTo(6);
    expect(f.taxAmount).toBeCloseTo(3);
    expect(f.refundAmount).toBeCloseTo(12);
  });

  it('filtered parts add up to the whole', () => {
    const o = [order({ items: [a, b], discountAmount: 10 })];
    const sum = m.summarize(m.filterLines(o, { categoryId: 'c1' })).netRevenue + m.summarize(m.filterLines(o, { categoryId: 'c2' })).netRevenue;
    expect(sum).toBeCloseTo(m.summarize(o).netRevenue);
  });

  it('drops orders with no matching line', () => {
    expect(m.filterLines([order({ items: [a] })], { productId: 'zzz' })).toEqual([]);
  });
});

describe('breakdowns', () => {
  const orders = [
    order({ items: [item({ productId: 'a', name: 'A', quantity: 1, totalPrice: 50 }), item({ productId: 'b', name: 'B', categoryId: 'c2', categoryName: 'Shoes', quantity: 5, totalPrice: 25 })] }),
    order({ items: [item({ productId: 'a', name: 'A', quantity: 1, totalPrice: 50 })] }),
    order({ items: [item({ productId: 'a', name: 'A', totalPrice: 999 })], orderStatus: 'CANCELLED' }),
  ];

  it('ranks products by revenue or units and ignores cancelled orders', () => {
    expect(m.topProducts(orders, 5, 'revenue').map((p) => [p.productId, p.revenue, p.orders])).toEqual([['a', 100, 2], ['b', 25, 1]]);
    expect(m.topProducts(orders, 5, 'units')[0].productId).toBe('b');
    expect(m.topProducts(orders, 1)).toHaveLength(1);
  });

  it('category shares add up to 100', () => {
    const cats = m.categoryBreakdown(orders);
    expect(cats.reduce((s, c) => s + c.share, 0)).toBeCloseTo(100, 1);
    expect(cats[0].category).toBe('Tops');
  });

  it('status distribution always lists every status (including cancelled)', () => {
    const d = m.statusDistribution(orders);
    expect(d.map((x) => x.status)).toEqual(['PENDING', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'REFUNDED']);
    expect(d.find((x) => x.status === 'CANCELLED')!.orders).toBe(1);
    expect(d.find((x) => x.status === 'DELIVERED')!.orders).toBe(2);
  });

  it('revenue by payment method', () => {
    const r = m.paymentMethodBreakdown([order({ paymentMethod: 'upi' }), order({ paymentMethod: 'upi' }), order({ paymentMethod: null })]);
    expect(r).toEqual([{ method: 'upi', orders: 2, netRevenue: 20 }, { method: 'unknown', orders: 1, netRevenue: 10 }]);
  });
});

describe('customer stats & segments', () => {
  const asOf = new Date('2026-11-21T00:00:00Z');
  const buy = (customerId: string, total: number, daysAgo: number, o: Partial<OrderRow> = {}) =>
    order({ customerId, items: [item({ totalPrice: total })], orderDate: new Date(asOf.getTime() - daysAgo * 86_400_000), ...o });

  it('aggregates lifetime orders / spend / first and last purchase, ignoring ineligible orders', () => {
    const stats = m.buildCustomerStats([buy('a', 50, 30), buy('a', 70, 5), buy('a', 999, 2, { orderStatus: 'CANCELLED' }), buy('b', 10, 1)]);
    const a = stats.get('a')!;
    expect(a.orders).toBe(2);
    expect(a.spent).toBe(120);
    expect(a.firstOrderAt < a.lastOrderAt).toBe(true);
    expect(stats.get('b')!.orders).toBe(1);
  });

  it('segments: top 20% are HIGH_VALUE, stale buyers INACTIVE, the rest REGULAR', () => {
    const orders = [
      ...[500, 200, 150, 120, 100, 90, 80, 70, 60, 50].map((t, i) => buy(`c${i}`, t, 5 + i)),
      buy('old', 900, 200), // big spender but last purchase 200 days ago
    ];
    const stats = m.buildCustomerStats(orders);
    const seg = m.makeSegmenter(stats.values(), asOf);
    // Ranking is by lifetime spend over ALL 11 buyers: top 20% = 3 slots -> 900 (old), 500, 200.
    // "old" holds a slot but is INACTIVE (stale), so exactly two ACTIVE customers are high-value.
    expect(seg(stats.get('c0'))).toBe('HIGH_VALUE');
    expect(seg(stats.get('c1'))).toBe('HIGH_VALUE');
    expect(seg(stats.get('c2'))).toBe('REGULAR'); // 150 < threshold (200)
    expect(seg(stats.get('c5'))).toBe('REGULAR');
    expect(seg(stats.get('old'))).toBe('INACTIVE');
    expect(seg(undefined)).toBe('INACTIVE'); // never purchased
  });

  it('does not invent a high-value group with fewer than 5 buyers', () => {
    const stats = m.buildCustomerStats([buy('a', 500, 1), buy('b', 5, 1)]);
    const seg = m.makeSegmenter(stats.values(), asOf);
    expect(seg(stats.get('a'))).toBe('REGULAR');
  });
});
