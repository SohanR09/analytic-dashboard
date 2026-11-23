import * as businessService from '../services/business.service';
import { asyncHandler } from '../utils/asyncHandler';
import { ok } from '../utils/response';

export const list = asyncHandler(async (req, res) => ok(res, await businessService.listBusinesses(req.user!.id, (req.query as { search?: string }).search)));
export const create = asyncHandler(async (req, res) => ok(res, await businessService.createBusiness(req.user!.id, req.body), 201));
export const get = asyncHandler(async (req, res) => ok(res, await businessService.getBusiness(req.business!, req.membership!.role, req.user!.id)));
export const update = asyncHandler(async (req, res) =>
  ok(res, await businessService.updateBusiness(req.business!, req.membership!.role, req.user!.id, req.body)),
);
export const setDefault = asyncHandler(async (req, res) => ok(res, await businessService.setDefaultBusiness(req.business!, req.membership!.role, req.user!.id)));
export const remove = asyncHandler(async (req, res) => {
  await businessService.deleteBusiness(req.business!);
  ok(res, { message: 'Business and all of its data were deleted' });
});
