export type Role = 'OWNER' | 'ADMIN' | 'MANAGER' | 'ANALYST';
export type OrderStatus = 'PENDING' | 'PROCESSING' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED' | 'REFUNDED';
export type PaymentStatus = 'PENDING' | 'PAID' | 'FAILED' | 'PARTIALLY_REFUNDED' | 'REFUNDED';
export type StockStatus = 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK';
export type Segment = 'HIGH_VALUE' | 'REGULAR' | 'INACTIVE';

export interface ApiEnvelope<T> {
  success: boolean;
  data: T;
  meta?: PageMeta;
}
export interface PageMeta { page: number; limit: number; total: number; totalPages: number }
export interface Paged<T> { items: T[]; meta: PageMeta }

export interface User {
  id: string; name: string; email: string; profileImage?: string | null;
  defaultBusinessId?: string | null;
  memberships?: { businessId: string; businessName: string; role: Role }[];
}
export interface TokenPair { accessToken: string; refreshToken: string; expiresIn: number; refreshExpiresIn: number }
export interface AuthResult extends TokenPair { user: User }

export interface BusinessSettings { lowStockThreshold?: number; [k: string]: unknown }
export interface Business {
  id: string; name: string; description?: string | null; category: string; currency: string; timezone: string;
  logo?: string | null; website?: string | null; createdAt: string; role: Role; isDefault: boolean;
  settings?: BusinessSettings; memberCount?: number; permissions?: string[];
}
export interface Member { userId: string; name: string; email: string; profileImage?: string | null; role: Role; joinedAt: string }

export interface Category { id: string; name: string; description?: string | null; productCount?: number }
export interface Product {
  id: string; name: string; sku: string; description?: string | null; price: number; costPrice: number;
  stockQuantity: number; minimumStockLevel: number; image?: string | null; categoryId?: string | null;
  category?: { id: string; name: string } | null; createdAt: string; updatedAt: string;
}
export interface InventoryRow {
  id: string; image?: string | null; name: string; sku: string; categoryId?: string | null; category: string;
  stockQuantity: number; minimumStockLevel: number; costPrice: number; price: number; stockValue: number;
  status: StockStatus; updatedAt: string;
}
export interface Customer {
  id: string; name: string; email?: string | null; phone?: string | null; city?: string | null; country?: string | null;
  notes?: string | null; createdAt: string; totalOrders: number; totalSpent: number; averageOrderValue: number;
  lastPurchaseDate: string | null; customerType: Segment;
}
export interface OrderItem {
  productId: string; name: string; sku: string; categoryName?: string; quantity: number; unitPrice: number; totalPrice: number;
}
export interface Order {
  id: string; orderNumber: string; orderDate: string; orderStatus: OrderStatus; paymentStatus: PaymentStatus;
  paymentMethod?: string | null; subtotal: number; discountAmount: number; taxAmount: number; shippingAmount: number;
  refundAmount: number; totalAmount: number; notes?: string | null; itemCount?: number; items: OrderItem[];
  customer?: { id: string; name: string; email?: string | null } | null;
  timeline?: { status: string; at: string; note?: string }[];
  shippingAddress?: Record<string, string> | null;
}

// ---- analytics ----
export interface RangeInfo {
  range: { from: string; to: string }; previousRange: { from: string; to: string }; interval: string; timezone: string; currency: string;
}
export interface StatCard { key: string; title: string; value: number; previous: number; change: number | null }
export interface TrendPoint { date: string; netRevenue: number; grossRevenue: number; orders?: number; units?: number; discounts?: number; refunds?: number }
export interface TopProduct { productId: string; name: string; sku?: string; categoryName?: string; orders: number; unitsSold: number; revenue: number }
export interface CategorySlice { categoryId?: string | null; category: string; revenue: number; unitsSold: number; share: number }
export interface StatusSlice { status: OrderStatus; orders: number }
export interface Dashboard extends RangeInfo {
  cards: StatCard[];
  revenueOverview: { date: string; netRevenue: number; grossRevenue: number }[];
  salesOverview: { date: string; orders: number; units: number; netRevenue: number }[];
  orderStatus: StatusSlice[];
  topProducts: TopProduct[];
  salesByCategory: CategorySlice[];
  recentOrders: { id: string; orderNumber: string; customer: string; orderDate: string; amount: number; orderStatus: OrderStatus; paymentStatus: PaymentStatus }[];
}

export interface Filters {
  preset: string; from?: string; to?: string; productId?: string; categoryId?: string; orderStatus?: string;
}

export interface ReportColumn { key: string; label: string; type: 'text' | 'number' | 'money' | 'percent' | 'date' }
export interface ReportData { title: string; columns: ReportColumn[]; rows: Record<string, unknown>[]; summary: Record<string, unknown> }
export interface Report {
  id: string; reportType: string; title: string; status: 'PENDING' | 'COMPLETED' | 'FAILED'; createdAt: string;
  filters?: Record<string, unknown>; data?: ReportData; error?: string | null;
}
