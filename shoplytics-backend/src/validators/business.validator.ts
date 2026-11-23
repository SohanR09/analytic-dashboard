import { z } from 'zod';
import { PRESETS } from '../utils/dates';
import { timezoneSchema, urlOrEmpty } from './common';

const currency = z
  .string()
  .trim()
  .regex(/^[A-Za-z]{3}$/, 'Currency must be a 3-letter ISO code (e.g. USD)')
  .transform((s) => s.toUpperCase());

export const settingsSchema = z
  .object({
    inventoryAlerts: z
      .object({
        enabled: z.boolean().default(true),
        defaultMinimumStockLevel: z.number().int().min(0).default(10),
      })
      .partial(),
    preferences: z
      .object({
        defaultDateRange: z.enum(PRESETS).default('last_30_days'),
      })
      .partial(),
  })
  .partial();

export const createBusinessSchema = z.object({
  name: z.string().trim().min(2, 'Business name is too short').max(100),
  description: z.string().trim().max(1000).optional(),
  category: z.string().trim().min(2).max(100),
  currency: currency.default('USD'),
  timezone: timezoneSchema.default('UTC'),
  logo: urlOrEmpty.optional(),
  website: urlOrEmpty.optional(),
  settings: settingsSchema.optional(),
});

export const updateBusinessSchema = createBusinessSchema.partial();

export const listBusinessesQuery = z.object({
  search: z.string().trim().max(100).optional(),
});

export type CreateBusinessInput = z.infer<typeof createBusinessSchema>;
export type UpdateBusinessInput = z.infer<typeof updateBusinessSchema>;
export type BusinessSettings = z.infer<typeof settingsSchema>;
