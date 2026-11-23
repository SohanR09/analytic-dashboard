import { describe, expect, it } from 'vitest';
import { autoInterval, bucketKey, buildBuckets, previousRange, resolveRange } from '../../src/utils/dates';

// Saturday 2026-11-21 08:00 UTC  =  13:30 in Asia/Kolkata  =  03:00 in America/New_York
const NOW = new Date('2026-11-21T08:00:00Z');

describe('resolveRange (business time zone)', () => {
  it('today is the local calendar day', () => {
    const r = resolveRange({ preset: 'today' }, 'Asia/Kolkata', NOW);
    expect(r.from.toISOString()).toBe('2026-11-20T18:30:00.000Z'); // 00:00 IST
    expect(r.to.toISOString()).toBe('2026-11-21T18:29:59.999Z'); // 23:59:59.999 IST
  });

  it('the same instant can be a different local day in another zone', () => {
    const r = resolveRange({ preset: 'today' }, 'America/New_York', NOW);
    expect(r.from.toISOString()).toBe('2026-11-21T05:00:00.000Z'); // 00:00 EST (UTC-5)
  });

  it('last_7_days includes today and spans exactly 7 local days', () => {
    const r = resolveRange({ preset: 'last_7_days' }, 'UTC', NOW);
    expect(r.from.toISOString()).toBe('2026-11-15T00:00:00.000Z');
    expect(r.to.toISOString()).toBe('2026-11-21T23:59:59.999Z');
  });

  it('this_month / last_month / this_year / yesterday', () => {
    expect(resolveRange({ preset: 'this_month' }, 'UTC', NOW).from.toISOString()).toBe('2026-11-01T00:00:00.000Z');
    const last = resolveRange({ preset: 'last_month' }, 'UTC', NOW);
    expect(last.from.toISOString()).toBe('2026-10-01T00:00:00.000Z');
    expect(last.to.toISOString()).toBe('2026-10-31T23:59:59.999Z');
    expect(resolveRange({ preset: 'this_year' }, 'UTC', NOW).from.toISOString()).toBe('2026-01-01T00:00:00.000Z');
    const y = resolveRange({ preset: 'yesterday' }, 'UTC', NOW);
    expect(y.from.toISOString()).toBe('2026-11-20T00:00:00.000Z');
    expect(y.to.toISOString()).toBe('2026-11-20T23:59:59.999Z');
  });

  it('defaults to the last 30 days', () => {
    const r = resolveRange({}, 'UTC', NOW);
    expect(r.from.toISOString()).toBe('2026-10-23T00:00:00.000Z');
  });

  it('custom date-only bounds cover whole local days, inclusive', () => {
    const r = resolveRange({ from: '2026-11-01', to: '2026-11-03' }, 'Asia/Kolkata', NOW);
    expect(r.from.toISOString()).toBe('2026-10-31T18:30:00.000Z');
    expect(r.to.toISOString()).toBe('2026-11-03T18:29:59.999Z');
  });

  it('rejects invalid and inverted ranges', () => {
    expect(() => resolveRange({ from: '2026-13-45' }, 'UTC', NOW)).toThrow(/Invalid date/);
    expect(() => resolveRange({ from: '2026-11-10', to: '2026-11-01' }, 'UTC', NOW)).toThrow(/must not be later/);
  });
});

describe('previousRange', () => {
  it('is the immediately preceding period of equal length', () => {
    const r = resolveRange({ from: '2026-11-08', to: '2026-11-14' }, 'UTC', NOW); // 7 days
    const p = previousRange(r);
    expect(p.to.getTime()).toBe(r.from.getTime() - 1);
    expect(p.to.getTime() - p.from.getTime()).toBe(r.to.getTime() - r.from.getTime());
    expect(p.from.toISOString()).toBe('2026-11-01T00:00:00.000Z');
  });
});

describe('buckets', () => {
  it('weeks start on Monday', () => {
    expect(bucketKey(new Date('2026-11-21T12:00:00Z'), 'week', 'UTC')).toBe('2026-11-16'); // Sat -> Mon
    expect(bucketKey(new Date('2026-11-16T00:00:00Z'), 'week', 'UTC')).toBe('2026-11-16');
  });

  it('bucket boundaries follow the business time zone', () => {
    const d = new Date('2026-11-01T20:00:00Z'); // 01:30 on Nov 2 in Kolkata
    expect(bucketKey(d, 'day', 'UTC')).toBe('2026-11-01');
    expect(bucketKey(d, 'day', 'Asia/Kolkata')).toBe('2026-11-02');
  });

  it('builds a continuous, zero-fillable list of buckets', () => {
    const r = resolveRange({ from: '2026-11-01', to: '2026-11-05' }, 'UTC', NOW);
    expect(buildBuckets(r, 'day', 'UTC')).toEqual(['2026-11-01', '2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05']);
    const months = resolveRange({ from: '2026-09-15', to: '2026-11-10' }, 'UTC', NOW);
    expect(buildBuckets(months, 'month', 'UTC')).toEqual(['2026-09-01', '2026-10-01', '2026-11-01']);
  });

  it('refuses absurdly fine-grained ranges', () => {
    const r = resolveRange({ from: '2015-01-01', to: '2026-11-01' }, 'UTC', NOW);
    expect(() => buildBuckets(r, 'day', 'UTC')).toThrow(/too large/);
  });

  it('picks a sensible automatic interval', () => {
    expect(autoInterval(resolveRange({ preset: 'last_30_days' }, 'UTC', NOW))).toBe('day');
    expect(autoInterval(resolveRange({ preset: 'last_90_days' }, 'UTC', NOW))).toBe('week');
    expect(autoInterval(resolveRange({ from: '2025-01-01', to: '2026-06-01' }, 'UTC', NOW))).toBe('month');
    expect(autoInterval(resolveRange({ from: '2018-01-01', to: '2026-06-01' }, 'UTC', NOW))).toBe('year');
  });
});
