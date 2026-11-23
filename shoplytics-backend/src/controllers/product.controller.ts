import * as products from '../services/product.service';
import { asyncHandler } from '../utils/asyncHandler';
import { ok, pageMeta } from '../utils/response';
import type { ListProductsQuery, ProductDetailQuery } from '../validators/product.validator';

export const list = asyncHandler(async (req, res) => {
  const q = req.query as unknown as ListProductsQuery;
  const { items, total } = await products.listProducts(req.business!.id, q);
  ok(res, items, 200, pageMeta(q.page, q.limit, total));
});
export const get = asyncHandler(async (req, res) => ok(res, await products.getProductDetail(req.business!, req.params.id, req.query as unknown as ProductDetailQuery)));
export const create = asyncHandler(async (req, res) => ok(res, await products.createProduct(req.business!, req.user!.id, req.body), 201));
export const update = asyncHandler(async (req, res) => ok(res, await products.updateProduct(req.business!.id, req.params.id, req.body)));
export const remove = asyncHandler(async (req, res) => {
  await products.deleteProduct(req.business!.id, req.params.id);
  ok(res, { message: 'Product deleted' });
});
