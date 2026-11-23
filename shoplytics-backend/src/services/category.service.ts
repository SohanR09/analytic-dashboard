import { prisma } from '../config/prisma';
import { ApiError } from '../utils/ApiError';
import { invalidateBusiness } from './cache.service';

export async function listCategories(businessId: string) {
  const rows = await prisma.category.findMany({
    where: { businessId },
    orderBy: { name: 'asc' },
    include: { _count: { select: { products: true } } },
  });
  return rows.map(({ _count, ...c }) => ({ ...c, productCount: _count.products }));
}

export async function createCategory(businessId: string, data: { name: string; description?: string }) {
  const created = await prisma.category.create({ data: { ...data, businessId } });
  await invalidateBusiness(businessId);
  return created;
}

export async function updateCategory(businessId: string, id: string, data: { name?: string; description?: string }) {
  const exists = await prisma.category.findFirst({ where: { id, businessId }, select: { id: true } });
  if (!exists) throw ApiError.notFound('Category not found');
  const updated = await prisma.category.update({ where: { id }, data });
  await invalidateBusiness(businessId);
  return updated;
}

/** Products in the category are kept and become "Uncategorized". Past orders keep their category snapshot. */
export async function deleteCategory(businessId: string, id: string) {
  const exists = await prisma.category.findFirst({ where: { id, businessId }, select: { id: true } });
  if (!exists) throw ApiError.notFound('Category not found');
  await prisma.$transaction([
    prisma.product.updateMany({ where: { businessId, categoryId: id }, data: { categoryId: null } }),
    prisma.category.delete({ where: { id } }),
  ]);
  await invalidateBusiness(businessId);
}
