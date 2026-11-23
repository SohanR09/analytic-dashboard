import type { Business, BusinessRole, Prisma } from '@prisma/client';
import { permissionsOf } from '../constants/permissions';
import { prisma } from '../config/prisma';
import { ApiError } from '../utils/ApiError';
import type { BusinessSettings, CreateBusinessInput, UpdateBusinessInput } from '../validators/business.validator';
import { invalidateBusiness } from './cache.service';

export const DEFAULT_SETTINGS = {
  inventoryAlerts: { enabled: true, defaultMinimumStockLevel: 10 },
  preferences: { defaultDateRange: 'last_30_days' },
};

export const settingsOf = (b: Pick<Business, 'settings'>) => ({
  inventoryAlerts: { ...DEFAULT_SETTINGS.inventoryAlerts, ...((b.settings as BusinessSettings | null)?.inventoryAlerts ?? {}) },
  preferences: { ...DEFAULT_SETTINGS.preferences, ...((b.settings as BusinessSettings | null)?.preferences ?? {}) },
});

const view = (b: Business, role: BusinessRole, defaultId?: string | null) => {
  const { orderSeq: _orderSeq, ...rest } = b;
  return { ...rest, settings: settingsOf(b), role, isDefault: b.id === defaultId };
};

const defaultBusinessId = async (userId: string) =>
  (await prisma.user.findUnique({ where: { id: userId }, select: { defaultBusinessId: true } }))?.defaultBusinessId;

/** All businesses the user belongs to (with their role in each). */
export async function listBusinesses(userId: string, search?: string) {
  const [memberships, defaultId] = await Promise.all([
    prisma.businessMember.findMany({ where: { userId }, include: { business: true }, orderBy: { createdAt: 'desc' } }),
    defaultBusinessId(userId),
  ]);
  const needle = search?.toLowerCase();
  return memberships
    .filter((m) => !needle || m.business.name.toLowerCase().includes(needle))
    .map((m) => view(m.business, m.role, defaultId));
}

export async function getBusiness(business: Business, role: BusinessRole, userId: string) {
  const [defaultId, memberCount] = await Promise.all([
    defaultBusinessId(userId),
    prisma.businessMember.count({ where: { businessId: business.id } }),
  ]);
  return { ...view(business, role, defaultId), memberCount, permissions: permissionsOf(role) };
}

export async function createBusiness(userId: string, input: CreateBusinessInput) {
  const { settings, logo, website, ...rest } = input;

  const business = await prisma.$transaction(async (tx) => {
    const created = await tx.business.create({
      data: {
        ...rest,
        logo: logo || null,
        website: website || null,
        settings: { ...DEFAULT_SETTINGS, ...(settings ?? {}) } as Prisma.InputJsonValue,
        ownerId: userId,
      },
    });
    await tx.businessMember.create({ data: { businessId: created.id, userId, role: 'OWNER' } });
    // The first business becomes the default automatically.
    await tx.user.updateMany({ where: { id: userId, defaultBusinessId: null }, data: { defaultBusinessId: created.id } });
    return created;
  });

  return view(business, 'OWNER', await defaultBusinessId(userId));
}

export async function updateBusiness(business: Business, role: BusinessRole, userId: string, input: UpdateBusinessInput) {
  const { settings, logo, website, ...rest } = input;
  const data: Prisma.BusinessUpdateInput = { ...rest };
  if (logo !== undefined) data.logo = logo || null;
  if (website !== undefined) data.website = website || null;
  if (settings) {
    const current = settingsOf(business);
    data.settings = {
      inventoryAlerts: { ...current.inventoryAlerts, ...(settings.inventoryAlerts ?? {}) },
      preferences: { ...current.preferences, ...(settings.preferences ?? {}) },
    } as Prisma.InputJsonValue;
  }

  const updated = await prisma.business.update({ where: { id: business.id }, data });
  await invalidateBusiness(business.id); // currency / time zone change how analytics are computed
  return view(updated, role, await defaultBusinessId(userId));
}

export async function setDefaultBusiness(business: Business, role: BusinessRole, userId: string) {
  await prisma.user.update({ where: { id: userId }, data: { defaultBusinessId: business.id } });
  return view(business, role, business.id);
}

/** Permanently removes the business and every record that belongs to it. */
export async function deleteBusiness(business: Business) {
  const businessId = business.id;
  await prisma.$transaction([
    prisma.order.deleteMany({ where: { businessId } }),
    prisma.inventoryMovement.deleteMany({ where: { businessId } }),
    prisma.product.deleteMany({ where: { businessId } }),
    prisma.category.deleteMany({ where: { businessId } }),
    prisma.customer.deleteMany({ where: { businessId } }),
    prisma.report.deleteMany({ where: { businessId } }),
    prisma.businessMember.deleteMany({ where: { businessId } }),
    prisma.user.updateMany({ where: { defaultBusinessId: businessId }, data: { defaultBusinessId: null } }),
    prisma.business.delete({ where: { id: businessId } }),
  ]);
  await invalidateBusiness(businessId);
}

export async function assertOwner(business: Business, userId: string) {
  if (business.ownerId !== userId) throw ApiError.forbidden('Only the business owner can do this');
}
