import * as inventory from '../services/inventory.service';
import { asyncHandler } from '../utils/asyncHandler';
import { ok, pageMeta } from '../utils/response';
import type { ListInventoryQuery, ListMovementsQuery } from '../validators/inventory.validator';

export const list = asyncHandler(async (req, res) => {
  const { items, meta } = await inventory.listInventory(req.business!.id, req.query as unknown as ListInventoryQuery);
  ok(res, items, 200, meta);
});
export const analytics = asyncHandler(async (req, res) =>
  ok(res, await inventory.getInventoryAnalytics(req.business!, (req.query as unknown as { limit: number }).limit)),
);
export const lowStock = asyncHandler(async (req, res) => {
  const { page, limit } = req.query as unknown as { page: number; limit: number };
  const { items, meta } = await inventory.lowStock(req.business!.id, page, limit);
  ok(res, items, 200, meta);
});
export const movements = asyncHandler(async (req, res) => {
  const q = req.query as unknown as ListMovementsQuery;
  const { items, total } = await inventory.listMovements(req.business!.id, q);
  ok(res, items, 200, pageMeta(q.page, q.limit, total));
});
export const updateStock = asyncHandler(async (req, res) =>
  ok(res, await inventory.updateStock(req.business!.id, req.user!.id, req.params.productId, req.body)),
);
