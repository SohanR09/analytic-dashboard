import { Prisma, type Business, type BusinessRole, type OrderStatus } from '@prisma/client';
import { can, P } from '../constants/permissions';
import { prisma } from '../config/prisma';
import { ApiError } from '../utils/ApiError';
import { resolveRange } from '../utils/dates';
import { round } from '../utils/helpers';
import { retryOnConflict } from '../utils/retry';
import type { CreateOrderInput, ListOrdersQuery, UpdateOrderInput } from '../validators/order.validator';
import { invalidateBusiness } from './cache.service';

const customerSelect = { id: true, name: true, email: true } as const;
const include = { customer: { select: customerSelect } } as const;

const FLOW: OrderStatus[] = ['PENDING', 'PROCESSING', 'SHIPPED', 'DELIVERED'];

/** Prisma "record to update not found" - here it means the stock condition did not match. */
const isNotFound = (err: unknown) => err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025';

/** Atomically decrements stock only if enough is available; returns the NEW quantity (throws P2025 otherwise). */
const reserveStock = (tx: Prisma.TransactionClient, businessId: string, line: { productId: string; quantity: number }) =>
  tx.product.update({
    where: { id: line.productId, businessId, stockQuantity: { gte: line.quantity } },
    data: { stockQuantity: { decrement: line.quantity } },
    select: { stockQuantity: true },
  });

export async function listOrders(business: Business, q: ListOrdersQuery) {
  const and: Prisma.OrderWhereInput[] = [{ businessId: business.id }];
  if (q.status) and.push({ orderStatus: q.status });
  if (q.paymentStatus) and.push({ paymentStatus: q.paymentStatus });
  if (q.customerId) and.push({ customerId: q.customerId });
  if (q.preset || q.from || q.to) {
    const r = resolveRange(q, business.timezone);
    and.push({ orderDate: { gte: r.from, lte: r.to } });
  }
  if (q.search) {
    // match the order number or the customer's name
    const customers = await prisma.customer.findMany({
      where: { businessId: business.id, name: { contains: q.search, mode: 'insensitive' } },
      select: { id: true },
      take: 200,
    });
    and.push({
      OR: [
        { orderNumber: { contains: q.search, mode: 'insensitive' } },
        ...(customers.length ? [{ customerId: { in: customers.map((c) => c.id) } }] : []),
      ],
    });
  }
  const where: Prisma.OrderWhereInput = { AND: and };

  const [items, total] = await Promise.all([
    prisma.order.findMany({ where, include, orderBy: { [q.sortBy]: q.order }, skip: (q.page - 1) * q.limit, take: q.limit }),
    prisma.order.count({ where }),
  ]);
  return { items: items.map(summaryView), total };
}

const summaryView = (o: Prisma.OrderGetPayload<{ include: typeof include }>) => {
  const { items, timeline: _t, shippingAddress: _s, ...rest } = o;
  return { ...rest, itemCount: items.reduce((s, i) => s + i.quantity, 0), items };
};

export async function getOrder(businessId: string, id: string) {
  const order = await prisma.order.findFirst({ where: { id, businessId }, include });
  if (!order) throw ApiError.notFound('Order not found');
  return order;
}

/**
 * Creates an order inside a MongoDB transaction:
 *  - validates the customer and products belong to THIS business,
 *  - snapshots product name / SKU / category / price / cost onto each line (history survives product edits),
 *  - reserves stock atomically (`stock >= qty`) and logs a SALE inventory movement per line,
 *  - computes every total on the server.
 * If any step fails the whole transaction rolls back, so stock and orders never diverge.
 */
export async function createOrder(business: Business, actorId: string, input: CreateOrderInput) {
  const businessId = business.id;

  if (input.customerId) {
    const c = await prisma.customer.findFirst({ where: { id: input.customerId, businessId }, select: { id: true } });
    if (!c) throw ApiError.badRequest('Customer not found in this business');
  }

  const ids = [...new Set(input.items.map((i) => i.productId))];
  const products = await prisma.product.findMany({
    where: { id: { in: ids }, businessId },
    include: { category: { select: { id: true, name: true } } },
  });
  if (products.length !== ids.length) throw ApiError.badRequest('One or more products were not found in this business');
  const byId = new Map(products.map((p) => [p.id, p]));

  const lines = input.items.map((l) => {
    const p = byId.get(l.productId)!;
    const unitPrice = l.unitPrice ?? p.price;
    return {
      productId: p.id,
      name: p.name,
      sku: p.sku,
      categoryId: p.categoryId,
      categoryName: p.category?.name ?? 'Uncategorized',
      quantity: l.quantity,
      unitPrice,
      unitCost: p.costPrice,
      totalPrice: round(l.quantity * unitPrice),
    };
  });

  const subtotal = round(lines.reduce((s, l) => s + l.totalPrice, 0));
  if (input.discountAmount > subtotal) throw ApiError.badRequest('Discount cannot exceed the order subtotal');
  const totalAmount = round(subtotal - input.discountAmount + input.taxAmount + input.shippingAmount);

  // Atomic increment: unique, gap-tolerant order numbers per business.
  const { orderSeq } = await prisma.business.update({ where: { id: businessId }, data: { orderSeq: { increment: 1 } }, select: { orderSeq: true } });
  const orderNumber = `ORD-${String(orderSeq).padStart(6, '0')}`;
  const orderDate = input.orderDate ?? new Date();

  const order = await retryOnConflict(() =>
    prisma.$transaction(
      async (tx) => {
        // One round trip per line: the conditional update reserves stock AND returns the new quantity.
        // Movements are written together afterwards (one createMany instead of N creates).
        const movements: Prisma.InventoryMovementCreateManyInput[] = [];
        for (const line of lines) {
          const { stockQuantity } = await reserveStock(tx, businessId, line).catch((err) => {
            if (isNotFound(err)) throw ApiError.conflict(`Insufficient stock for "${line.name}"`);
            throw err;
          });
          movements.push({
            businessId,
            productId: line.productId,
            movementType: 'SALE',
            quantity: -line.quantity,
            previousQuantity: stockQuantity + line.quantity,
            newQuantity: stockQuantity,
            reason: `Order ${orderNumber}`,
            actorId,
          });
        }
        await tx.inventoryMovement.createMany({ data: movements });

        return tx.order.create({
          data: {
            businessId,
            customerId: input.customerId ?? null,
            orderNumber,
            items: lines,
            subtotal,
            discountAmount: input.discountAmount,
            taxAmount: input.taxAmount,
            shippingAmount: input.shippingAmount,
            totalAmount,
            orderStatus: input.orderStatus,
            paymentStatus: input.paymentStatus,
            paymentMethod: input.paymentMethod,
            shippingAddress: input.shippingAddress,
            notes: input.notes,
            orderDate,
            timeline: [{ status: input.orderStatus, note: 'Order created', actorId, at: new Date() }],
          },
          include,
        });
      },
      { maxWait: 5000, timeout: 20_000 },
    ),
  );

  await invalidateBusiness(businessId);
  return order;
}

function assertTransition(from: OrderStatus, to: OrderStatus) {
  if (from === to) return;
  if (from === 'CANCELLED' || from === 'REFUNDED') throw ApiError.badRequest(`A ${from.toLowerCase()} order can no longer change status`);
  if (to === 'CANCELLED') {
    if (from === 'DELIVERED') throw ApiError.badRequest('A delivered order cannot be cancelled; refund it instead');
    return;
  }
  if (to === 'REFUNDED') {
    if (from !== 'SHIPPED' && from !== 'DELIVERED') throw ApiError.badRequest('Only shipped or delivered orders can be refunded');
    return;
  }
  if (FLOW.indexOf(to) < FLOW.indexOf(from)) throw ApiError.badRequest(`Cannot move an order back from ${from} to ${to}`);
}

/**
 * Updates status / payment / notes / refunds.
 *  - Forward-only progress PENDING -> PROCESSING -> SHIPPED -> DELIVERED; CANCELLED / REFUNDED are terminal.
 *  - CANCEL returns reserved stock to inventory (and logs CANCELLATION movements). Refunds do not restock.
 *  - Anything that touches refunds additionally requires the `order:refund` permission.
 */
export async function updateOrder(business: Business, actor: { id: string; role: BusinessRole }, id: string, input: UpdateOrderInput) {
  const businessId = business.id;
  const order = await prisma.order.findFirst({ where: { id, businessId } });
  if (!order) throw ApiError.notFound('Order not found');

  const touchesRefund = input.orderStatus === 'REFUNDED' || input.refundAmount !== undefined || input.paymentStatus === 'REFUNDED' || input.paymentStatus === 'PARTIALLY_REFUNDED';
  if (touchesRefund && !can(actor.role, P.ORDER_REFUND)) {
    throw ApiError.forbidden(`Your role (${actor.role}) is not allowed to issue refunds (${P.ORDER_REFUND})`);
  }

  const data: Prisma.OrderUpdateManyMutationInput = {};
  if (input.paymentMethod !== undefined) data.paymentMethod = input.paymentMethod;
  if (input.notes !== undefined) data.notes = input.notes;

  const newStatus = input.orderStatus ?? order.orderStatus;
  const statusChanging = newStatus !== order.orderStatus;
  if (statusChanging) {
    assertTransition(order.orderStatus, newStatus);
    data.orderStatus = newStatus;
  }

  const maxRefund = round(order.subtotal - order.discountAmount);
  let refund = order.refundAmount;
  if (newStatus === 'REFUNDED' && input.refundAmount === undefined && statusChanging) refund = maxRefund; // full refund
  if (input.refundAmount !== undefined) refund = round(input.refundAmount);
  if (refund !== order.refundAmount) {
    if (!['SHIPPED', 'DELIVERED', 'REFUNDED'].includes(newStatus)) throw ApiError.badRequest('Only shipped or delivered orders can be refunded');
    if (refund < order.refundAmount) throw ApiError.badRequest('Refund amount cannot be reduced');
    if (refund > maxRefund) throw ApiError.badRequest(`Refund cannot exceed the merchandise value after discount (${maxRefund})`);
    data.refundAmount = refund;
    data.paymentStatus = refund >= maxRefund ? 'REFUNDED' : 'PARTIALLY_REFUNDED';
  }
  if (input.paymentStatus !== undefined && data.paymentStatus === undefined) data.paymentStatus = input.paymentStatus;
  if (statusChanging && newStatus === 'CANCELLED' && order.paymentStatus === 'PAID' && data.paymentStatus === undefined) data.paymentStatus = 'REFUNDED';

  await retryOnConflict(() =>
    prisma.$transaction(async (tx) => {
      // Matching on the current status makes concurrent changes safe (e.g. a double cancel restocks once).
      const res = await tx.order.updateMany({
        where: { id, businessId, orderStatus: order.orderStatus, refundAmount: order.refundAmount },
        data,
      });
      if (res.count !== 1) throw ApiError.conflict('Order was modified by another request, please retry');

      if (statusChanging) {
        await tx.order.update({
          where: { id },
          data: { timeline: { push: { status: newStatus, note: input.note, actorId: actor.id, at: new Date() } } },
        });
      }

      if (statusChanging && newStatus === 'CANCELLED') {
        // One lookup for which products still exist (deleted ones have nothing to restock),
        // one update per remaining line, then a single createMany for the movements.
        const existing = await tx.product.findMany({
          where: { businessId, id: { in: [...new Set(order.items.map((i) => i.productId))] } },
          select: { id: true },
        });
        const alive = new Set(existing.map((p) => p.id));

        const movements: Prisma.InventoryMovementCreateManyInput[] = [];
        for (const item of order.items) {
          if (!alive.has(item.productId)) continue;
          const { stockQuantity } = await tx.product.update({
            where: { id: item.productId, businessId },
            data: { stockQuantity: { increment: item.quantity } },
            select: { stockQuantity: true },
          });
          movements.push({
            businessId,
            productId: item.productId,
            movementType: 'CANCELLATION',
            quantity: item.quantity,
            previousQuantity: stockQuantity - item.quantity,
            newQuantity: stockQuantity,
            reason: `Order ${order.orderNumber} cancelled`,
            referenceId: order.id,
            actorId: actor.id,
          });
        }
        if (movements.length) await tx.inventoryMovement.createMany({ data: movements });
      }
    }),
  );

  await invalidateBusiness(businessId);
  return getOrder(businessId, id);
}
