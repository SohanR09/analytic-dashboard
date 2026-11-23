import type { Role } from '@/types';

/** Mirrors the backend permission matrix. The server is the real gate; this only hides UI the user cannot use. */
export const P = {
  BUSINESS_UPDATE: 'business:update', BUSINESS_DELETE: 'business:delete', MEMBER_READ: 'member:read', MEMBER_MANAGE: 'member:manage',
  PRODUCT_CREATE: 'product:create', PRODUCT_UPDATE: 'product:update', PRODUCT_DELETE: 'product:delete',
  CATEGORY_WRITE: 'category:write', CATEGORY_DELETE: 'category:delete',
  CUSTOMER_CREATE: 'customer:create', CUSTOMER_UPDATE: 'customer:update', CUSTOMER_DELETE: 'customer:delete',
  INVENTORY_UPDATE: 'inventory:update', ORDER_CREATE: 'order:create', ORDER_UPDATE: 'order:update', ORDER_REFUND: 'order:refund',
  REPORT_GENERATE: 'report:generate', REPORT_DELETE: 'report:delete',
} as const;

export const ROLE_LABEL: Record<Role, string> = { OWNER: 'Owner', ADMIN: 'Admin', MANAGER: 'Manager', ANALYST: 'Analyst' };
export const ROLE_HINT: Record<Role, string> = {
  OWNER: 'Full control, including deleting the business',
  ADMIN: 'Manage data, team and settings',
  MANAGER: 'Create and edit products, stock and orders',
  ANALYST: 'Read-only access to analytics and records',
};
