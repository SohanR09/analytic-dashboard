import { z } from 'zod';
import { objectId, paginationFields, rangeFields } from './common';

const ORDER_STATUSES = ['PENDING', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'REFUNDED'] as const;
const PAYMENT_STATUSES = ['PENDING', 'PAID', 'FAILED', 'PARTIALLY_REFUNDED', 'REFUNDED'] as const;

const shippingAddress = z.object({
  name: z.string().trim().max(150).optional(),
  line1: z.string().trim().min(1).max(200),
  line2: z.string().trim().max(200).optional(),
  city: z.string().trim().min(1).max(100),
  state: z.string().trim().max(100).optional(),
  postalCode: z.string().trim().max(20).optional(),
  country: z.string().trim().min(1).max(100),
});

export const createOrderSchema = z.object({
  customerId: objectId.optional(),
  items: z
    .array(
      z.object({
        productId: objectId,
        quantity: z.number().int().min(1).max(100_000),
        /** Defaults to the product's current price. */
        unitPrice: z.number().min(0).optional(),
      }),
    )
    .min(1, 'An order needs at least one item')
    .max(100),
  discountAmount: z.number().min(0).default(0),
  taxAmount: z.number().min(0).default(0),
  shippingAmount: z.number().min(0).default(0),
  orderStatus: z.enum(['PENDING', 'PROCESSING', 'SHIPPED', 'DELIVERED']).default('PENDING'),
  paymentStatus: z.enum(['PENDING', 'PAID']).default('PENDING'),
  paymentMethod: z.string().trim().max(50).optional(),
  shippingAddress: shippingAddress.optional(),
  notes: z.string().trim().max(1000).optional(),
  /** Lets you back-date / import historical orders. Defaults to now. */
  orderDate: z.coerce.date().optional(),
});

export const updateOrderSchema = z
  .object({
    orderStatus: z.enum(ORDER_STATUSES).optional(),
    paymentStatus: z.enum(PAYMENT_STATUSES).optional(),
    paymentMethod: z.string().trim().max(50).optional(),
    notes: z.string().trim().max(1000).optional(),
    /** New TOTAL refunded merchandise value (partial refunds). Requires the order:refund permission. */
    refundAmount: z.number().min(0).optional(),
    note: z.string().trim().max(300).optional(),
  })
  .refine((d) => Object.keys(d).some((k) => k !== 'note'), { message: 'Provide at least one field to update' });

export const listOrdersQuery = z.object({
  ...paginationFields,
  ...rangeFields,
  status: z.enum(ORDER_STATUSES).optional(),
  paymentStatus: z.enum(PAYMENT_STATUSES).optional(),
  customerId: objectId.optional(),
  search: z.string().trim().max(80).optional(),
  sortBy: z.enum(['orderDate', 'totalAmount']).default('orderDate'),
  order: z.enum(['asc', 'desc']).default('desc'),
});

export type CreateOrderInput = z.infer<typeof createOrderSchema>;
export type UpdateOrderInput = z.infer<typeof updateOrderSchema>;
export type ListOrdersQuery = z.infer<typeof listOrdersQuery>;
