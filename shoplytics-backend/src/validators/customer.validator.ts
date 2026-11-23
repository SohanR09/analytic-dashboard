import { z } from 'zod';
import { intervalField, paginationFields, rangeFields } from './common';

const optionalEmail = z.union([z.literal(''), z.string().trim().toLowerCase().email('Invalid email address')]);

export const createCustomerSchema = z.object({
  name: z.string().trim().min(1).max(150),
  email: optionalEmail.optional(),
  phone: z.string().trim().max(40).optional(),
  city: z.string().trim().max(100).optional(),
  country: z.string().trim().max(100).optional(),
  notes: z.string().trim().max(1000).optional(),
});

export const updateCustomerSchema = createCustomerSchema.partial();

export const listCustomersQuery = z.object({
  ...paginationFields,
  search: z.string().trim().max(100).optional(),
  type: z.enum(['HIGH_VALUE', 'REGULAR', 'INACTIVE']).optional(),
  sortBy: z.enum(['createdAt', 'name', 'totalSpent', 'totalOrders']).default('createdAt'),
  order: z.enum(['asc', 'desc']).default('desc'),
});

export const customerAnalyticsQuery = z.object({ ...rangeFields, interval: intervalField, limit: z.coerce.number().int().min(1).max(50).default(10) });

export type CreateCustomerInput = z.infer<typeof createCustomerSchema>;
export type UpdateCustomerInput = z.infer<typeof updateCustomerSchema>;
export type ListCustomersQuery = z.infer<typeof listCustomersQuery>;
export type CustomerAnalyticsQuery = z.infer<typeof customerAnalyticsQuery>;
