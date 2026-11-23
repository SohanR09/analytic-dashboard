import { DateTime, type DurationLikeObject } from 'luxon';
import { ApiError } from './ApiError';

/**
 * Date ranges are always interpreted in the BUSINESS's time zone, so "today" or "this month" mean what the
 * owner expects. Date-only values (YYYY-MM-DD) span the whole local day; full ISO datetimes are used as given.
 */

export const PRESETS = [
  'today',
  'yesterday',
  'last_7_days',
  'last_30_days',
  'last_90_days',
  'this_month',
  'last_month',
  'this_year',
  'custom',
] as const;
export type Preset = (typeof PRESETS)[number];

export const INTERVALS = ['day', 'week', 'month', 'year'] as const;
export type Interval = (typeof INTERVALS)[number];

export interface DateRangeInput {
  preset?: Preset;
  from?: string;
  to?: string;
}

export interface DateRange {
  from: Date;
  to: Date;
}

const MAX_BUCKETS = 1000;

function boundary(value: string, tz: string, end: boolean): DateTime {
  const dt = DateTime.fromISO(value, { zone: tz });
  if (!dt.isValid) throw ApiError.badRequest(`Invalid date "${value}"`);
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return end ? dt.endOf('day') : dt.startOf('day');
  return dt;
}

export function resolveRange(input: DateRangeInput, tz: string, now: Date = new Date()): DateRange {
  const n = DateTime.fromJSDate(now, { zone: tz });
  const preset: Preset = input.preset ?? (input.from || input.to ? 'custom' : 'last_30_days');

  let from: DateTime;
  let to: DateTime;
  switch (preset) {
    case 'today':
      from = n.startOf('day');
      to = n.endOf('day');
      break;
    case 'yesterday':
      from = n.minus({ days: 1 }).startOf('day');
      to = n.minus({ days: 1 }).endOf('day');
      break;
    case 'last_7_days':
      from = n.minus({ days: 6 }).startOf('day');
      to = n.endOf('day');
      break;
    case 'last_30_days':
      from = n.minus({ days: 29 }).startOf('day');
      to = n.endOf('day');
      break;
    case 'last_90_days':
      from = n.minus({ days: 89 }).startOf('day');
      to = n.endOf('day');
      break;
    case 'this_month':
      from = n.startOf('month');
      to = n.endOf('day');
      break;
    case 'last_month':
      from = n.minus({ months: 1 }).startOf('month');
      to = n.minus({ months: 1 }).endOf('month');
      break;
    case 'this_year':
      from = n.startOf('year');
      to = n.endOf('day');
      break;
    case 'custom':
    default: {
      to = input.to ? boundary(input.to, tz, true) : n.endOf('day');
      from = input.from ? boundary(input.from, tz, false) : to.minus({ days: 29 }).startOf('day');
      if (from > to) throw ApiError.badRequest('"from" must not be later than "to"');
    }
  }
  return { from: from.toJSDate(), to: to.toJSDate() };
}

/** The period of equal length immediately before `range` (used for growth / "vs previous period"). */
export function previousRange(range: DateRange): DateRange {
  const span = range.to.getTime() - range.from.getTime() + 1;
  return { from: new Date(range.from.getTime() - span), to: new Date(range.from.getTime() - 1) };
}

/** Sensible chart granularity for a range. */
export function autoInterval(range: DateRange): Interval {
  const days = (range.to.getTime() - range.from.getTime()) / 86_400_000;
  if (days <= 62) return 'day';
  if (days <= 270) return 'week';
  if (days <= 1100) return 'month';
  return 'year';
}

const startOfUnit = (d: Date, interval: Interval, tz: string) =>
  DateTime.fromJSDate(d, { zone: tz }).startOf(interval); // luxon weeks start on Monday (ISO)

/** Bucket label = local start date of the bucket (YYYY-MM-DD in the business time zone). */
export const bucketKey = (d: Date, interval: Interval, tz: string): string =>
  startOfUnit(d, interval, tz).toISODate() as string;

/** Every bucket label covering the range, so charts get zero-filled gaps. */
export function buildBuckets(range: DateRange, interval: Interval, tz: string): string[] {
  const keys: string[] = [];
  const end = DateTime.fromJSDate(range.to, { zone: tz });
  const step = { [`${interval}s`]: 1 } as DurationLikeObject;
  for (let cur = startOfUnit(range.from, interval, tz); cur <= end; cur = cur.plus(step)) {
    keys.push(cur.toISODate() as string);
    if (keys.length > MAX_BUCKETS) {
      throw ApiError.badRequest(`Date range is too large for "${interval}" intervals; choose a larger interval or a shorter range`);
    }
  }
  return keys;
}

export const isoDay = (d: Date, tz: string): string => DateTime.fromJSDate(d, { zone: tz }).toISODate() as string;
