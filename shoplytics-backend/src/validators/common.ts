import { z } from 'zod';
import { INTERVALS, PRESETS } from '../utils/dates';

const OBJECT_ID = /^[0-9a-fA-F]{24}$/;
const DATE_INPUT = /^\d{4}-\d{2}-\d{2}([T ][\d:.]+(Z|[+-]\d{2}:?\d{2})?)?$/;

export const objectId = z.string().regex(OBJECT_ID, 'Invalid id');

export const idParam = z.object({ id: objectId });

export const paginationFields = {
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
};

export const isValidTimezone = (tz: string): boolean => {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
};

export const timezoneSchema = z.string().trim().refine(isValidTimezone, 'Invalid IANA time zone');

export const urlOrEmpty = z.union([z.literal(''), z.string().trim().url().max(500)]);

export const booleanQuery = z.enum(['true', 'false']).transform((v) => v === 'true');

/** `YYYY-MM-DD` (whole local day in the business time zone) or an ISO datetime. */
const dateInput = z.string().trim().regex(DATE_INPUT, 'Use YYYY-MM-DD or an ISO 8601 datetime');

/** Global date filter used by every analytics endpoint. */
export const rangeFields = {
  preset: z.enum(PRESETS).optional(),
  from: dateInput.optional(),
  to: dateInput.optional(),
};

export const intervalField = z.enum(['auto', ...INTERVALS]).default('auto');
