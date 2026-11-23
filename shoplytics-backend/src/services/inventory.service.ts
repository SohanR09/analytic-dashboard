import type { Business, Prisma } from '@prisma/client';
import { prisma } from '../config/prisma';
import { ApiError } from '../utils/ApiError';
import { round } from '../utils/helpers';
import { paginate } from '../utils/response';
import type { ListInventoryQuery, ListMovementsQuery, StockStatus, UpdateStockInput } from '../validators/inventory.validator';
import * as cache from './cache.service';
import { retryOnConflict } from '../utils/retry';

export const stockStatus = (stock: number, min: number): StockStatus =>
  stock <= 0 ? 'OUT_OF_STOCK' : stock <= min ? 'LOW_STOCK' : 'IN_STOCK';

const productInclude = { category: { select: { id: true, name: true } } } as const;

type ProductWithCategory = Prisma.ProductGetPayload<{ include: typeof productInclude }>;

const row = (p: ProductWithCategory) => ({
  id: p.id,
  image: p.image,
  name: p.name,
  sku: p.sku,
  categoryId: p.categoryId,
  category: p.category?.name ?? 'Uncategorized',
  stockQuantity: p.stockQuantity,
  minimumStockLevel: p.minimumStockLevel,
  costPrice: p.costPrice,
  price: p.price,
  stockValue: round(p.stockQuantity * p.costPrice),
  status: stockStatus(p.stockQuantity, p.minimumStockLevel),
  updatedAt: p.updatedAt,
});

/**
 * Prisma cannot compare two columns (stock <= minimum) on MongoDB, so stock status is derived in the
 * application. A catalog is small relative to orders, so loading it per request is cheap.
 */
async function loadInventory(businessId: string, where: Prisma.ProductWhereInput = {}) {
  const products = await prisma.product.findMany({ where: { businessId, ...where }, include: productInclude });
  return products.map(row);
}

export async function listInventory(businessId: string, q: ListInventoryQuery) {
  const rows = await loadInventory(businessId, {
    ...(q.categoryId ? { categoryId: q.categoryId } : {}),
    ...(q.search
      ? { OR: [{ name: { contains: q.search, mode: 'insensitive' } }, { sku: { contains: q.search, mode: 'insensitive' } }] }
      : {}),
  });
  const filtered = q.status ? rows.filter((r) => r.status === q.status) : rows;
  const dir = q.order === 'asc' ? 1 : -1;
  filtered.sort((a, b) => {
    if (q.sortBy === 'name') return a.name.localeCompare(b.name) * dir;
    if (q.sortBy === 'stockQuantity') return (a.stockQuantity - b.stockQuantity) * dir;
    return (a.updatedAt.getTime() - b.updatedAt.getTime()) * dir;
  });
  return paginate(filtered, q.page, q.limit);
}

export async function lowStock(businessId: string, page: number, limit: number) {
  const rows = (await loadInventory(businessId)).filter((r) => r.status === 'LOW_STOCK');
  rows.sort((a, b) => a.stockQuantity - b.stockQuantity);
  return paginate(rows, page, limit);
}

export async function getInventoryAnalytics(business: Business, limit: number) {
  return cache.wrap(business.id, 'inventory-analytics', { limit }, async () => {
    const rows = await loadInventory(business.id);

    const status = { IN_STOCK: 0, LOW_STOCK: 0, OUT_OF_STOCK: 0 };
    const byCategory = new Map<string, { category: string; products: number; units: number; value: number }>();
    const buckets = [
      { label: 'Out of stock', min: 0, max: 0, products: 0 },
      { label: '1-10', min: 1, max: 10, products: 0 },
      { label: '11-50', min: 11, max: 50, products: 0 },
      { label: '51-100', min: 51, max: 100, products: 0 },
      { label: '100+', min: 101, max: Infinity, products: 0 },
    ];
    let units = 0;
    let value = 0;

    for (const r of rows) {
      status[r.status]++;
      units += r.stockQuantity;
      value += r.stockValue;
      const c = byCategory.get(r.category) ?? { category: r.category, products: 0, units: 0, value: 0 };
      c.products++;
      c.units += r.stockQuantity;
      c.value += r.stockValue;
      byCategory.set(r.category, c);
      buckets.find((b) => r.stockQuantity >= b.min && r.stockQuantity <= b.max)!.products++;
    }

    return {
      currency: business.currency,
      summary: {
        totalProducts: rows.length,
        totalStockUnits: units,
        lowStockProducts: status.LOW_STOCK,
        outOfStockProducts: status.OUT_OF_STOCK,
        inventoryValue: round(value), // sum(current stock x cost price)
      },
      stockDistribution: buckets.map(({ label, products }) => ({ label, products })),
      statusBreakdown: (Object.keys(status) as StockStatus[]).map((s) => ({ status: s, products: status[s] })),
      stockLevelComparison: [...rows]
        .sort((a, b) => b.stockQuantity - a.stockQuantity)
        .slice(0, limit)
        .map((r) => ({ id: r.id, name: r.name, stockQuantity: r.stockQuantity, minimumStockLevel: r.minimumStockLevel })),
      valueByCategory: [...byCategory.values()].map((c) => ({ ...c, value: round(c.value) })).sort((a, b) => b.value - a.value),
    };
  });
}

export async function listMovements(businessId: string, q: ListMovementsQuery) {
  const where: Prisma.InventoryMovementWhereInput = {
    businessId,
    ...(q.productId ? { productId: q.productId } : {}),
    ...(q.movementType ? { movementType: q.movementType } : {}),
  };
  const [items, total] = await Promise.all([
    prisma.inventoryMovement.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (q.page - 1) * q.limit,
      take: q.limit,
      include: { product: { select: { id: true, name: true, sku: true } } },
    }),
    prisma.inventoryMovement.count({ where }),
  ]);
  return { items, total };
}

/** Set an exact stock count, add / remove units, and/or change the low-stock threshold. */
export async function updateStock(businessId: string, actorId: string, productId: string, input: UpdateStockInput) {
  const result = await retryOnConflict(() =>
    prisma.$transaction(async (tx) => {
      const product = await tx.product.findFirst({ where: { id: productId, businessId } });
      if (!product) throw ApiError.notFound('Product not found');

      const previous = product.stockQuantity;
      const next = input.newQuantity ?? (input.adjustment !== undefined ? previous + input.adjustment : previous);
      if (next < 0) throw ApiError.conflict(`Insufficient stock: only ${previous} unit(s) available`);

      // Optimistic guard: only apply if nobody changed the stock since we read it.
      const res = await tx.product.updateMany({
        where: { id: productId, businessId, stockQuantity: previous },
        data: { stockQuantity: next, ...(input.minimumStockLevel !== undefined ? { minimumStockLevel: input.minimumStockLevel } : {}) },
      });
      if (res.count !== 1) throw ApiError.conflict('Stock was changed by another request, please retry');

      if (next !== previous) {
        await tx.inventoryMovement.create({
          data: {
            businessId,
            productId,
            movementType: input.newQuantity !== undefined ? 'ADJUSTMENT' : input.movementType,
            quantity: next - previous,
            previousQuantity: previous,
            newQuantity: next,
            reason: input.reason,
            actorId,
          },
        });
      }
      return tx.product.findUniqueOrThrow({ where: { id: productId }, include: productInclude });
    }),
  );
  await cache.invalidateBusiness(businessId);
  return row(result);
}
