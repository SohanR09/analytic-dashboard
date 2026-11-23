import { z } from 'zod';
import { objectId, paginationFields, rangeFields } from './common';

export const REPORT_TYPES = [
  // Sales
  'daily_sales',
  'weekly_sales',
  'monthly_sales',
  'yearly_sales',
  'product_sales',
  // Inventory
  'current_inventory',
  'low_stock',
  'out_of_stock',
  'inventory_valuation',
  // Customers
  'customer_growth',
  'new_customers',
  'returning_customers',
  'high_value_customers',
  // Revenue
  'revenue_summary',
  'monthly_revenue',
  'product_revenue',
  'category_revenue',
] as const;
export type ReportType = (typeof REPORT_TYPES)[number];

export const REPORT_CATEGORIES: Record<string, ReportType[]> = {
  sales: ['daily_sales', 'weekly_sales', 'monthly_sales', 'yearly_sales', 'product_sales'],
  inventory: ['current_inventory', 'low_stock', 'out_of_stock', 'inventory_valuation'],
  customers: ['customer_growth', 'new_customers', 'returning_customers', 'high_value_customers'],
  revenue: ['revenue_summary', 'monthly_revenue', 'product_revenue', 'category_revenue'],
};

export const generateReportSchema = z.object({
  reportType: z.enum(REPORT_TYPES),
  ...rangeFields,
  filters: z
    .object({
      productId: objectId.optional(),
      categoryId: objectId.optional(),
    })
    .default({}),
});

export const listReportsQuery = z.object({
  ...paginationFields,
  reportType: z.enum(REPORT_TYPES).optional(),
});

export const reportParam = z.object({ reportId: objectId });

export const exportReportQuery = z.object({ format: z.enum(['csv', 'pdf']).default('csv') });

export type GenerateReportInput = z.infer<typeof generateReportSchema>;
