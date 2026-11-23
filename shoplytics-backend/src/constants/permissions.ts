/**
 * Role-based access control (RBAC)
 * --------------------------------
 * Authentication answers "who are you?" (JWT + Redis session).
 * Authorization answers "what may you do in THIS business?" and is based on the role stored in
 * `BusinessMember`. A user can hold a different role in every business they belong to.
 *
 *   OWNER    full control, incl. deleting the business and managing admins
 *   ADMIN    everything except deleting the business / managing other admins
 *   MANAGER  day-to-day operations: products, stock, customers, orders (no deletes, no refunds, no team)
 *   ANALYST  read-only access to data, analytics and reports (can generate + export reports)
 *
 * The matrix below is the single source of truth; routes reference permissions, never roles.
 */

export const ROLES = ['OWNER', 'ADMIN', 'MANAGER', 'ANALYST'] as const;
export type Role = (typeof ROLES)[number];

export const P = {
  BUSINESS_READ: 'business:read',
  BUSINESS_UPDATE: 'business:update',
  BUSINESS_DELETE: 'business:delete',

  MEMBER_READ: 'member:read',
  MEMBER_MANAGE: 'member:manage',

  ANALYTICS_READ: 'analytics:read',

  PRODUCT_READ: 'product:read',
  PRODUCT_CREATE: 'product:create',
  PRODUCT_UPDATE: 'product:update',
  PRODUCT_DELETE: 'product:delete',

  CATEGORY_READ: 'category:read',
  CATEGORY_WRITE: 'category:write',
  CATEGORY_DELETE: 'category:delete',

  INVENTORY_READ: 'inventory:read',
  INVENTORY_UPDATE: 'inventory:update',

  CUSTOMER_READ: 'customer:read',
  CUSTOMER_CREATE: 'customer:create',
  CUSTOMER_UPDATE: 'customer:update',
  CUSTOMER_DELETE: 'customer:delete',

  ORDER_READ: 'order:read',
  ORDER_CREATE: 'order:create',
  ORDER_UPDATE: 'order:update',
  ORDER_REFUND: 'order:refund',

  REPORT_READ: 'report:read',
  REPORT_GENERATE: 'report:generate',
  REPORT_EXPORT: 'report:export',
  REPORT_DELETE: 'report:delete',
} as const;

export type Permission = (typeof P)[keyof typeof P];

const ALL: Role[] = ['OWNER', 'ADMIN', 'MANAGER', 'ANALYST'];
const OPERATORS: Role[] = ['OWNER', 'ADMIN', 'MANAGER'];
const ADMINS: Role[] = ['OWNER', 'ADMIN'];
const OWNER_ONLY: Role[] = ['OWNER'];

export const PERMISSION_MATRIX: Record<Permission, readonly Role[]> = {
  [P.BUSINESS_READ]: ALL,
  [P.BUSINESS_UPDATE]: ADMINS,
  [P.BUSINESS_DELETE]: OWNER_ONLY,

  [P.MEMBER_READ]: ADMINS,
  [P.MEMBER_MANAGE]: ADMINS,

  [P.ANALYTICS_READ]: ALL,

  [P.PRODUCT_READ]: ALL,
  [P.PRODUCT_CREATE]: OPERATORS,
  [P.PRODUCT_UPDATE]: OPERATORS,
  [P.PRODUCT_DELETE]: ADMINS,

  [P.CATEGORY_READ]: ALL,
  [P.CATEGORY_WRITE]: OPERATORS,
  [P.CATEGORY_DELETE]: ADMINS,

  [P.INVENTORY_READ]: ALL,
  [P.INVENTORY_UPDATE]: OPERATORS,

  [P.CUSTOMER_READ]: ALL,
  [P.CUSTOMER_CREATE]: OPERATORS,
  [P.CUSTOMER_UPDATE]: OPERATORS,
  [P.CUSTOMER_DELETE]: ADMINS,

  [P.ORDER_READ]: ALL,
  [P.ORDER_CREATE]: OPERATORS,
  [P.ORDER_UPDATE]: OPERATORS,
  [P.ORDER_REFUND]: ADMINS,

  [P.REPORT_READ]: ALL,
  [P.REPORT_GENERATE]: ALL,
  [P.REPORT_EXPORT]: ALL,
  [P.REPORT_DELETE]: ADMINS,
};

export function can(role: Role | undefined | null, permission: Permission): boolean {
  return !!role && PERMISSION_MATRIX[permission].includes(role);
}

export function permissionsOf(role: Role): Permission[] {
  return (Object.keys(PERMISSION_MATRIX) as Permission[]).filter((p) => can(role, p));
}

/** Roles that may be handed out through the members API (OWNER is the business creator only). */
export const ASSIGNABLE_ROLES = ['ADMIN', 'MANAGER', 'ANALYST'] as const;
