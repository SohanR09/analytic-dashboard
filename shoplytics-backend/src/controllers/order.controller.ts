import * as orders from '../services/order.service';
import { asyncHandler } from '../utils/asyncHandler';
import { ok, pageMeta } from '../utils/response';
import type { ListOrdersQuery } from '../validators/order.validator';

export const list = asyncHandler(async (req, res) => {
  const q = req.query as unknown as ListOrdersQuery;
  const { items, total } = await orders.listOrders(req.business!, q);
  ok(res, items, 200, pageMeta(q.page, q.limit, total));
});
export const get = asyncHandler(async (req, res) => ok(res, await orders.getOrder(req.business!.id, req.params.id)));
export const create = asyncHandler(async (req, res) => ok(res, await orders.createOrder(req.business!, req.user!.id, req.body), 201));
export const update = asyncHandler(async (req, res) =>
  ok(res, await orders.updateOrder(req.business!, { id: req.user!.id, role: req.membership!.role }, req.params.id, req.body)),
);
