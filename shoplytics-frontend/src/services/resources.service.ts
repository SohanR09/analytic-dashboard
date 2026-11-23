import type { Customer, InventoryRow, Order, Product, Report, Filters, StockStatus } from '@/types';
import { del, get, getPaged, post, put } from './api';
import { rangeParams } from './analytics.service';

const b = (id: string) => `/businesses/${id}`;
type Q = Record<string, unknown>;

export const productService = {
  list: (id: string, p: Q) => getPaged<Product>(`${b(id)}/products`, p),
  get: (id: string, pid: string, p?: Q) => get<{
    product: Product; stockStatus: StockStatus; currency: string;
    performance: { lifetime: { unitsSold: number; revenue: number; orders: number }; period: { unitsSold: number; revenue: number; orders: number } };
    salesHistory: { date: string; unitsSold: number; revenue: number; orders: number }[];
    stockMovements: Movement[];
  }>(`${b(id)}/products/${pid}`, p),
  create: (id: string, d: Q) => post<Product>(`${b(id)}/products`, d),
  update: (id: string, pid: string, d: Q) => put<Product>(`${b(id)}/products/${pid}`, d),
  remove: (id: string, pid: string) => del(`${b(id)}/products/${pid}`),
};
export interface Movement { id: string; productId: string; movementType: string; quantity: number; previousQuantity: number; newQuantity: number; reason?: string | null; createdAt: string; product?: { name: string; sku: string } }
export const inventoryService = {
  list: (id: string, p: Q) => getPaged<InventoryRow>(`${b(id)}/inventory`, p),
  movements: (id: string, p: Q) => getPaged<Movement>(`${b(id)}/inventory/movements`, p),
  update: (id: string, pid: string, d: Q) => put(`${b(id)}/inventory/${pid}`, d),
};
export const customerService = {
  list: (id: string, p: Q) => getPaged<Customer>(`${b(id)}/customers`, p),
  get: (id: string, cid: string) => get<{
    customer: Customer; currency: string;
    stats: { totalOrders: number; totalSpent: number; averageOrderValue: number; firstPurchaseDate: string | null; lastPurchaseDate: string | null; customerType: string };
    mostPurchasedProducts: { productId: string; name: string; unitsSold: number; orders: number; revenue: number }[];
    purchaseHistory: { id: string; orderNumber: string; orderDate: string; orderStatus: string; paymentStatus: string; totalAmount: number; itemCount: number }[];
  }>(`${b(id)}/customers/${cid}`),
  create: (id: string, d: Q) => post<Customer>(`${b(id)}/customers`, d),
  update: (id: string, cid: string, d: Q) => put<Customer>(`${b(id)}/customers/${cid}`, d),
  remove: (id: string, cid: string) => del(`${b(id)}/customers/${cid}`),
};
export const orderService = {
  list: (id: string, p: Q) => getPaged<Order>(`${b(id)}/orders`, p),
  get: (id: string, oid: string) => get<Order>(`${b(id)}/orders/${oid}`),
  create: (id: string, d: Q) => post<Order>(`${b(id)}/orders`, d),
  update: (id: string, oid: string, d: Q) => put<Order>(`${b(id)}/orders/${oid}`, d),
};
export const reportService = {
  types: (id: string) => get<Record<string, string[]>>(`${b(id)}/reports/types`),
  list: (id: string, p: Q) => getPaged<Report>(`${b(id)}/reports`, p),
  get: (id: string, rid: string) => get<Report>(`${b(id)}/reports/${rid}`),
  generate: (id: string, reportType: string, f: Filters) =>
    post<Report>(`${b(id)}/reports/generate`, { reportType, ...rangeParams(f), filters: { productId: f.productId, categoryId: f.categoryId } }),
  remove: (id: string, rid: string) => del(`${b(id)}/reports/${rid}`),
  /** Downloads through axios so the Authorization header is sent. */
  async download(id: string, rid: string, format: 'csv' | 'pdf', name: string) {
    const { api } = await import('./api');
    const r = await api.get(`${b(id)}/reports/${rid}/export`, { params: { format }, responseType: 'blob' });
    const url = URL.createObjectURL(r.data as Blob);
    const a = document.createElement('a');
    a.href = url; a.download = `${name.replace(/[^\w-]+/g, '_')}.${format}`; a.click();
    URL.revokeObjectURL(url);
  },
};
