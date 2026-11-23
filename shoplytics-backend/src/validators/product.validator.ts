import { z } from 'zod';
import { intervalField, objectId, paginationFields, rangeFields, urlOrEmpty } from './common';

export const createProductSchema = z.object({
  name: z.string().trim().min(1).max(200),
  sku: z.string().trim().min(1).max(64).transform((s) => s.toUpperCase()),
  description: z.string().trim().max(2000).optional(),
  categoryId: objectId.nullable().optional(),
  price: z.number().min(0),
  costPrice: z.number().min(0).default(0),
  /** Opening stock. Later changes go through PUT /inventory/:productId so they are logged as movements. */
  stockQuantity: z.number().int().min(0).default(0),
  minimumStockLevel: z.number().int().min(0).optional(),
  image: urlOrEmpty.optional(),
});

/** Stock is intentionally not editable here (see inventory API). */
export const updateProductSchema = createProductSchema.omit({ stockQuantity: true }).partial();

export const listProductsQuery = z
  .object({
    ...paginationFields,
    search: z.string().trim().max(100).optional(),
    categoryId: objectId.optional(),
    minPrice: z.coerce.number().min(0).optional(),
    maxPrice: z.coerce.number().min(0).optional(),
    sortBy: z.enum(['name', 'price', 'createdAt']).default('createdAt'),
    order: z.enum(['asc', 'desc']).default('desc'),
  })
  .refine((q) => q.minPrice === undefined || q.maxPrice === undefined || q.minPrice <= q.maxPrice, {
    message: 'minPrice must not exceed maxPrice',
    path: ['minPrice'],
  });

export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
export type ListProductsQuery = z.infer<typeof listProductsQuery>;

/** Product detail: period for the sales history / performance block (default last 90 days). */
export const productDetailQuery = z.object({ ...rangeFields, interval: intervalField });
export type ProductDetailQuery = z.infer<typeof productDetailQuery>;
