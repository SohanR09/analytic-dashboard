import { describe, expect, it } from 'vitest';
import reducer, { resetFilters, setCustomRange, setFilter, setPreset } from '@/store/slices/filterSlice';
import { P } from '@/utils/permissions';
import { loginSchema, registerSchema } from '@/pages/Auth/schemas';

describe('filter slice', () => {
  it('switching away from custom clears the range', () => {
    let s = reducer(undefined, setCustomRange({ from: '2026-01-01', to: '2026-01-31' }));
    expect(s).toMatchObject({ preset: 'custom', from: '2026-01-01', to: '2026-01-31' });
    s = reducer(s, setPreset('last_7_days'));
    expect(s).toMatchObject({ preset: 'last_7_days', from: undefined, to: undefined });
  });
  it('sets and resets product/category/status filters', () => {
    let s = reducer(undefined, setFilter({ productId: 'p1', orderStatus: 'PAID' }));
    expect(s.productId).toBe('p1');
    s = reducer(s, resetFilters());
    expect(s).toEqual({ preset: 'last_30_days' });
  });
});

describe('validation', () => {
  it('login requires a valid email and a password', () => {
    expect(loginSchema.safeParse({ email: 'x', password: '', rememberMe: false }).success).toBe(false);
    expect(loginSchema.safeParse({ email: 'a@b.co', password: 'x', rememberMe: false }).success).toBe(true);
  });
  it('register enforces password rules, matching confirmation and terms', () => {
    const base = { name: 'Ann Lee', email: 'ann@x.co', password: 'Password1', confirmPassword: 'Password1', terms: true as const };
    expect(registerSchema.safeParse(base).success).toBe(true);
    expect(registerSchema.safeParse({ ...base, password: 'short1', confirmPassword: 'short1' }).success).toBe(false);
    expect(registerSchema.safeParse({ ...base, password: 'onlyletters', confirmPassword: 'onlyletters' }).success).toBe(false);
    expect(registerSchema.safeParse({ ...base, confirmPassword: 'Different1' }).success).toBe(false);
    expect(registerSchema.safeParse({ ...base, terms: false }).success).toBe(false);
  });
  it('permission constants match backend names', () => { expect(P.ORDER_REFUND).toBe('order:refund'); expect(P.MEMBER_MANAGE).toBe('member:manage'); });
});
