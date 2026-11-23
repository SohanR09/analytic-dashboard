import { describe, expect, it } from 'vitest';
import { errorMessage, money, pct, shortDate, titleCase } from '@/utils/format';

describe('format helpers', () => {
  it('formats money in the given currency', () => { expect(money(1234.5, 'USD')).toContain('1,234.50'); });
  it('pct shows a sign and a dash for "no baseline"', () => { expect(pct(12.345)).toBe('+12.3%'); expect(pct(-5)).toBe('-5.0%'); expect(pct(null)).toBe('—'); expect(pct(0)).toBe('0.0%'); });
  it('titleCase turns enums into labels', () => { expect(titleCase('PARTIALLY_REFUNDED')).toBe('Partially Refunded'); });
  it('shortDate handles day / month / unknown buckets', () => { expect(shortDate('2026-11-03')).toMatch(/Nov/); expect(shortDate('2026-11')).toMatch(/Nov/); expect(shortDate('2026-W45')).toBe('2026-W45'); });
  it('errorMessage prefers validation details, then the API message', () => {
    expect(errorMessage({ response: { data: { message: 'Validation failed', details: [{ path: 'email', message: 'Invalid' }] } } })).toBe('email: Invalid');
    expect(errorMessage({ response: { data: { message: 'Nope' } } })).toBe('Nope');
    expect(errorMessage(new Error('boom'))).toBe('boom');
  });
});
