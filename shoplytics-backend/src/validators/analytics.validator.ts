import { z } from 'zod';
import { intervalField, objectId, paginationFields, rangeFields } from './common';

const ORDER_STATUSES = ['PENDING', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'REFUNDED'] as const;

/** Query shared by dashboard / sales / revenue analytics. */
export const analyticsQuery = z.object({
  ...rangeFields,
  interval: intervalField,
  limit: z.coerce.number().int().min(1).max(50).default(5),
  sortBy: z.enum(['revenue', 'units']).default('revenue'),
  productId: objectId.optional(),
  categoryId: objectId.optional(),
  orderStatus: z.enum(ORDER_STATUSES).optional(),
  /** Revenue analytics: compare against a custom period instead of the previous one. */
  compareFrom: z.string().optional(),
  compareTo: z.string().optional(),
});

/** Paginated record lists under /sales and /revenue. */
export const recordsQuery = z.object({
  ...paginationFields,
  ...rangeFields,
  productId: objectId.optional(),
  categoryId: objectId.optional(),
  orderStatus: z.enum(ORDER_STATUSES).optional(),
});

export type AnalyticsQuery = z.infer<typeof analyticsQuery>;
export type RecordsQuery = z.infer<typeof recordsQuery>;
