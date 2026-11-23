import type { Business, Prisma } from '@prisma/client';
import { prisma } from '../config/prisma';
import { ApiError } from '../utils/ApiError';
import type { CreateProductInput, ListProductsQuery, ProductDetailQuery, UpdateProductInput } from '../validators/product.validator';
import * as m from './analytics.metrics';
import { buildCtx, loadOrders } from './analytics.service';
import { settingsOf } from './business.service';
import { invalidateBusiness } from './cache.service';

const include = { category: { select: { id: true, name: true } } } as const;

async function assertCategory(businessId: string, categoryId?: string | null) {
  if (!categoryId) return;
  const ok = await prisma.category.findFirst({ where: { id: categoryId, businessId }, select: { id: true } });
  if (!ok) throw ApiError.badRequest('Category not found in this business');
}

export async function listProducts(businessId: string, q: ListProductsQuery) {
  const where: Prisma.ProductWhereInput = {
    businessId,
    ...(q.categoryId ? { categoryId: q.categoryId } : {}),
    ...(q.minPrice !== undefined || q.maxPrice !== undefined ? { price: { gte: q.minPrice, lte: q.maxPrice } } : {}),
    ...(q.search
      ? { OR: [{ name: { contains: q.search, mode: 'insensitive' } }, { sku: { contains: q.search, mode: 'insensitive' } }] }
      : {}),
  };
  const [items, total] = await Promise.all([
    prisma.product.findMany({ where, include, orderBy: { [q.sortBy]: q.order }, skip: (q.page - 1) * q.limit, take: q.limit }),
    prisma.product.count({ where }),
  ]);
  return { items, total };
}

export async function createProduct(business: Business, actorId: string, input: CreateProductInput) {
  await assertCategory(business.id, input.categoryId);
  const { image, stockQuantity, minimumStockLevel, ...rest } = input;
  const min = minimumStockLevel ?? settingsOf(business).inventoryAlerts.defaultMinimumStockLevel;

  const product = await prisma.$transaction(async (tx) => {
    const created = await tx.product.create({
      data: { ...rest, categoryId: rest.categoryId ?? null, businessId: business.id, stockQuantity, minimumStockLevel: min, image: image || null },
      include,
    });
    if (stockQuantity > 0) {
      await tx.inventoryMovement.create({
        data: {
          businessId: business.id,
          productId: created.id,
          movementType: 'INITIAL',
          quantity: stockQuantity,
          previousQuantity: 0,
          newQuantity: stockQuantity,
          reason: 'Opening stock',
          actorId,
        },
      });
    }
    return created;
  });
  await invalidateBusiness(business.id);
  return product;
}

export async function updateProduct(businessId: string, id: string, input: UpdateProductInput) {
  const exists = await prisma.product.findFirst({ where: { id, businessId }, select: { id: true } });
  if (!exists) throw ApiError.notFound('Product not found');
  await assertCategory(businessId, input.categoryId);

  const { image, ...rest } = input;
  const product = await prisma.product.update({
    where: { id },
    data: { ...rest, ...(image !== undefined ? { image: image || null } : {}) },
    include,
  });
  await invalidateBusiness(businessId);
  return product;
}

/** Past orders keep their product snapshot, so history and analytics are unaffected. */
export async function deleteProduct(businessId: string, id: string) {
  const exists = await prisma.product.findFirst({ where: { id, businessId }, select: { id: true } });
  if (!exists) throw ApiError.notFound('Product not found');
  await prisma.$transaction([
    prisma.inventoryMovement.deleteMany({ where: { businessId, productId: id } }),
    prisma.product.delete({ where: { id } }),
  ]);
  await invalidateBusiness(businessId);
}

/** Product + inventory + performance (lifetime and for the selected period) + stock history. */
export async function getProductDetail(business: Business, id: string, q: ProductDetailQuery) {
  const product = await prisma.product.findFirst({ where: { id, businessId: business.id }, include });
  if (!product) throw ApiError.notFound('Product not found');

  const ctx = buildCtx(business, { ...q, preset: q.preset ?? (q.from || q.to ? 'custom' : 'last_90_days') });
  const where: Prisma.OrderWhereInput = { items: { some: { productId: id } } };
  const [all, movements] = await Promise.all([
    loadOrders(business.id, null, { items: true, where }),
    prisma.inventoryMovement.findMany({ where: { businessId: business.id, productId: id }, orderBy: { createdAt: 'desc' }, take: 20 }),
  ]);

  const lineOnly = m.filterLines(all, { productId: id });
  const inPeriod = lineOnly.filter((o) => o.orderDate >= ctx.range.from && o.orderDate <= ctx.range.to);
  const lifetime = m.summarize(lineOnly);
  const period = m.summarize(inPeriod);

  return {
    product,
    stockStatus: product.stockQuantity === 0 ? 'OUT_OF_STOCK' : product.stockQuantity <= product.minimumStockLevel ? 'LOW_STOCK' : 'IN_STOCK',
    performance: {
      lifetime: { unitsSold: lifetime.units, revenue: lifetime.grossRevenue, orders: lifetime.orders },
      period: { range: ctx.range, unitsSold: period.units, revenue: period.grossRevenue, orders: period.orders },
    },
    salesHistory: m.trend(inPeriod, ctx.range, ctx.interval, ctx.tz).map((p) => ({ date: p.date, unitsSold: p.units, revenue: p.grossRevenue, orders: p.orders })),
    stockMovements: movements,
    currency: business.currency,
    timezone: business.timezone,
  };
}
