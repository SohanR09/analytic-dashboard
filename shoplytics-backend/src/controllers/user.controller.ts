import * as userService from '../services/user.service';
import { asyncHandler } from '../utils/asyncHandler';
import { ok } from '../utils/response';

export const getMe = asyncHandler(async (req, res) => ok(res, await userService.getProfile(req.user!.id)));
export const updateMe = asyncHandler(async (req, res) => ok(res, await userService.updateProfile(req.user!.id, req.body)));
export const changePassword = asyncHandler(async (req, res) =>
  ok(res, await userService.changePassword(req.user!.id, req.user!.sid, req.body)),
);
