import { describe, expect, it } from 'vitest';
import { PERMISSION_MATRIX, P, ROLES, can, permissionsOf, type Permission, type Role } from '../../src/constants/permissions';

/** The authoritative, human-readable expectation of who may do what. Changing the matrix must change this table. */
const EXPECTED: Record<Permission, Role[]> = {
  'business:read': ['OWNER', 'ADMIN', 'MANAGER', 'ANALYST'],
  'business:update': ['OWNER', 'ADMIN'],
  'business:delete': ['OWNER'],
  'member:read': ['OWNER', 'ADMIN'],
  'member:manage': ['OWNER', 'ADMIN'],
  'analytics:read': ['OWNER', 'ADMIN', 'MANAGER', 'ANALYST'],
  'product:read': ['OWNER', 'ADMIN', 'MANAGER', 'ANALYST'],
  'product:create': ['OWNER', 'ADMIN', 'MANAGER'],
  'product:update': ['OWNER', 'ADMIN', 'MANAGER'],
  'product:delete': ['OWNER', 'ADMIN'],
  'category:read': ['OWNER', 'ADMIN', 'MANAGER', 'ANALYST'],
  'category:write': ['OWNER', 'ADMIN', 'MANAGER'],
  'category:delete': ['OWNER', 'ADMIN'],
  'inventory:read': ['OWNER', 'ADMIN', 'MANAGER', 'ANALYST'],
  'inventory:update': ['OWNER', 'ADMIN', 'MANAGER'],
  'customer:read': ['OWNER', 'ADMIN', 'MANAGER', 'ANALYST'],
  'customer:create': ['OWNER', 'ADMIN', 'MANAGER'],
  'customer:update': ['OWNER', 'ADMIN', 'MANAGER'],
  'customer:delete': ['OWNER', 'ADMIN'],
  'order:read': ['OWNER', 'ADMIN', 'MANAGER', 'ANALYST'],
  'order:create': ['OWNER', 'ADMIN', 'MANAGER'],
  'order:update': ['OWNER', 'ADMIN', 'MANAGER'],
  'order:refund': ['OWNER', 'ADMIN'],
  'report:read': ['OWNER', 'ADMIN', 'MANAGER', 'ANALYST'],
  'report:generate': ['OWNER', 'ADMIN', 'MANAGER', 'ANALYST'],
  'report:export': ['OWNER', 'ADMIN', 'MANAGER', 'ANALYST'],
  'report:delete': ['OWNER', 'ADMIN'],
};

describe('permission matrix', () => {
  it('matches the documented expectations exactly', () => {
    for (const perm of Object.values(P)) {
      expect([...PERMISSION_MATRIX[perm]].sort(), perm).toEqual([...EXPECTED[perm]].sort());
    }
    expect(Object.keys(PERMISSION_MATRIX).sort()).toEqual(Object.keys(EXPECTED).sort());
  });

  it('OWNER can do everything', () => {
    for (const perm of Object.values(P)) expect(can('OWNER', perm), perm).toBe(true);
  });

  it('roles are strictly nested: OWNER ⊇ ADMIN ⊇ MANAGER ⊇ ANALYST', () => {
    for (let i = 0; i < ROLES.length - 1; i++) {
      const higher = new Set(permissionsOf(ROLES[i]));
      for (const p of permissionsOf(ROLES[i + 1])) expect(higher.has(p), `${ROLES[i]} should have ${p}`).toBe(true);
    }
  });

  it('ANALYST is read-only (plus generating / exporting reports)', () => {
    const allowedNonRead = new Set<Permission>([P.REPORT_GENERATE, P.REPORT_EXPORT]);
    for (const p of permissionsOf('ANALYST')) {
      expect(p.endsWith(':read') || allowedNonRead.has(p), p).toBe(true);
    }
  });

  it('MANAGER cannot delete, refund, manage the team or change the business', () => {
    for (const p of [P.PRODUCT_DELETE, P.CUSTOMER_DELETE, P.CATEGORY_DELETE, P.ORDER_REFUND, P.MEMBER_MANAGE, P.MEMBER_READ, P.BUSINESS_UPDATE, P.BUSINESS_DELETE, P.REPORT_DELETE]) {
      expect(can('MANAGER', p), p).toBe(false);
    }
  });

  it('only the OWNER can delete the business', () => {
    expect(ROLES.filter((r) => can(r, P.BUSINESS_DELETE))).toEqual(['OWNER']);
  });

  it('unknown / missing roles are denied', () => {
    expect(can(undefined, P.BUSINESS_READ)).toBe(false);
    expect(can(null, P.BUSINESS_READ)).toBe(false);
    expect(can('HACKER' as Role, P.BUSINESS_READ)).toBe(false);
  });
});
