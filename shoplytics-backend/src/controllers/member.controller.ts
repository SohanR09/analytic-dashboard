import * as members from '../services/member.service';
import { asyncHandler } from '../utils/asyncHandler';
import { ok } from '../utils/response';

export const list = asyncHandler(async (req, res) => ok(res, await members.listMembers(req.business!.id)));
export const add = asyncHandler(async (req, res) => ok(res, await members.addMember(req.business!, req.membership!.role, req.body), 201));
export const update = asyncHandler(async (req, res) =>
  ok(res, await members.updateMemberRole(req.business!, req.membership!.role, req.params.userId, req.body.role)),
);
export const remove = asyncHandler(async (req, res) => {
  await members.removeMember(req.business!, { id: req.user!.id, role: req.membership!.role }, req.params.userId);
  ok(res, { message: 'Member removed' });
});
