import * as categories from '../services/category.service';
import { asyncHandler } from '../utils/asyncHandler';
import { ok } from '../utils/response';

export const list = asyncHandler(async (req, res) => ok(res, await categories.listCategories(req.business!.id)));
export const create = asyncHandler(async (req, res) => ok(res, await categories.createCategory(req.business!.id, req.body), 201));
export const update = asyncHandler(async (req, res) => ok(res, await categories.updateCategory(req.business!.id, req.params.id, req.body)));
export const remove = asyncHandler(async (req, res) => {
  await categories.deleteCategory(req.business!.id, req.params.id);
  ok(res, { message: 'Category deleted' });
});
