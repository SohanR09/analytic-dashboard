import type { Dashboard, Filters, RangeInfo, StatusSlice, CategorySlice, TopProduct, TrendPoint } from '@/types';
import { get } from './api';

/** Turn the global filter into API query params. A custom range sends from/to instead of a preset. */
export const rangeParams = (f: Filters) =>
  f.preset === 'custom' ? { from: f.from, to: f.to } : { preset: f.preset };
const q = (f: Filters, extra: Record<string, unknown> = {}) => ({
  ...rangeParams(f), productId: f.productId, categoryId: f.categoryId, orderStatus: f.orderStatus, ...extra,
});
const b = (id: string) => `/businesses/${id}`;

export interface SalesAnalytics extends RangeInfo {
  totals: { totalSales: number; totalOrders: number; averageOrderValue: number; unitsSold: number };
  growth: { sales: number | null; orders: number | null; units: number | null; averageOrderValue: number | null };
  salesByCategory: CategorySlice[];
  salesByProduct: TopProduct[];
  ordersOverTime: { date: string; orders: number; units: number }[];
  orderStatus: StatusSlice[];
}
export interface RevenueAnalytics extends RangeInfo {
  totals: { totalRevenue: number; grossRevenue: number; netRevenue: number; discounts: number; refunds: number; taxCollected: number; shipping: number };
  growth: Record<string, number | null>;
  revenueTrend: TrendPoint[];
  monthlyComparison: { current: { date: string; netRevenue: number }[]; comparison: { date: string; netRevenue: number }[] };
  byProduct: TopProduct[];
  byCategory: CategorySlice[];
  byPaymentMethod: { method: string; orders: number; netRevenue: number }[];
  highRevenueProducts: TopProduct[];
}
export interface InventoryAnalytics {
  currency: string;
  summary: { totalProducts: number; totalStockUnits: number; lowStockProducts: number; outOfStockProducts: number; inventoryValue: number };
  stockDistribution: { label: string; products: number }[];
  statusBreakdown: { status: string; products: number }[];
  stockLevelComparison: { id: string; name: string; stockQuantity: number; minimumStockLevel: number }[];
  valueByCategory: { category?: string; name?: string; value: number }[];
}
export interface CustomerAnalytics extends RangeInfo {
  summary: { totalCustomers: number; newCustomers: number; newCustomersGrowth: number | null; returningCustomers: number; averageLifetimeValue: number; averageOrdersPerCustomer: number };
  customerGrowth: { date: string; newCustomers: number; totalCustomers: number }[];
  newVsReturning: { type: string; customers: number }[];
  segments: { segment: string; customers: number }[];
  topCustomers: { customerId: string; name: string; email: string | null; orders: number; totalSpent: number; lastPurchaseDate: string }[];
  purchasingBehavior: { customerId: string; name: string; orders: number; totalSpent: number; averageOrderValue: number }[];
}

export const analyticsService = {
  dashboard: (id: string, f: Filters) => get<Dashboard>(`${b(id)}/dashboard`, { ...rangeParams(f), limit: 5 }),
  sales: (id: string, f: Filters) => get<SalesAnalytics>(`${b(id)}/sales/analytics`, q(f, { limit: 10 })),
  revenue: (id: string, f: Filters) => get<RevenueAnalytics>(`${b(id)}/revenue/analytics`, q(f, { orderStatus: undefined, limit: 10 })),
  inventory: (id: string) => get<InventoryAnalytics>(`${b(id)}/inventory/analytics`),
  customers: (id: string, f: Filters) => get<CustomerAnalytics>(`${b(id)}/customers/analytics`, { ...rangeParams(f), limit: 10 }),
};
