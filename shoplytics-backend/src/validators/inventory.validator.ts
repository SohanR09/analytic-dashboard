import { z } from 'zod';
import { objectId, paginationFields } from './common';

export const STOCK_STATUSES = ['IN_STOCK', 'LOW_STOCK', 'OUT_OF_STOCK'] as const;
export type StockStatus = (typeof STOCK_STATUSES)[number];

export const listInventoryQuery = z.object({
  ...paginationFields,
  search: z.string().trim().max(100).optional(),
  categoryId: objectId.optional(),
  status: z.enum(STOCK_STATUSES).optional(),
  sortBy: z.enum(['name', 'stockQuantity', 'updatedAt']).default('name'),
  order: z.enum(['asc', 'desc']).default('asc'),
});

export const updateStockSchema = z
  .object({
    /** Set stock to an exact number (stock count). */
    newQuantity: z.number().int().min(0).optional(),
    /** Or add (+) / remove (-) units. */
    adjustment: z.number().int().refine((n) => n !== 0, 'Adjustment cannot be zero').optional(),
    movementType: z.enum(['PURCHASE', 'RETURN', 'ADJUSTMENT']).default('ADJUSTMENT'),
    reason: z.string().trim().max(300).optional(),
    /** Stock threshold used for the low-stock status. */
    minimumStockLevel: z.number().int().min(0).optional(),
  })
  .refine((d) => !(d.newQuantity !== undefined && d.adjustment !== undefined), {
    message: 'Provide either newQuantity or adjustment, not both',
    path: ['adjustment'],
  })
  .refine((d) => d.newQuantity !== undefined || d.adjustment !== undefined || d.minimumStockLevel !== undefined, {
    message: 'Provide newQuantity, adjustment or minimumStockLevel',
    path: ['newQuantity'],
  });

export const listMovementsQuery = z.object({
  ...paginationFields,
  productId: objectId.optional(),
  movementType: z.enum(['INITIAL', 'PURCHASE', 'SALE', 'RETURN', 'CANCELLATION', 'ADJUSTMENT']).optional(),
});

export const inventoryAnalyticsQuery = z.object({ limit: z.coerce.number().int().min(1).max(50).default(10) });

export const lowStockQuery = z.object({ ...paginationFields });

export type ListInventoryQuery = z.infer<typeof listInventoryQuery>;
export type UpdateStockInput = z.infer<typeof updateStockSchema>;
export type ListMovementsQuery = z.infer<typeof listMovementsQuery>;
