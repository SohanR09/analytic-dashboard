import type { RequestHandler } from 'express';
import { can, type Permission } from '../constants/permissions';
import { prisma } from '../config/prisma';
import { ApiError } from '../utils/ApiError';
import { asyncHandler } from '../utils/asyncHandler';
import { isObjectId } from '../utils/helpers';

/**
 * Resolves `/:businessId` for the authenticated user and loads their ROLE in that business.
 *
 * This is the tenant-isolation choke point: access exists only through a `BusinessMember` row.
 * Not a member (including "business belongs to someone else" and "business does not exist") => 404,
 * so the existence of other tenants' businesses is never revealed.
 */
export const businessContext = asyncHandler(async (req, _res, next) => {
  const { businessId } = req.params;
  if (!isObjectId(businessId)) throw ApiError.badRequest('Invalid business id');

  const membership = await prisma.businessMember.findUnique({
    where: { businessId_userId: { businessId, userId: req.user!.id } },
    include: { business: true },
  });
  if (!membership) throw ApiError.notFound('Business not found');

  req.business = membership.business;
  req.membership = { role: membership.role };
  next();
});

/** AUTHORIZATION: allows the request only if the caller's role in this business holds `permission`. */
export const authorize =
  (permission: Permission): RequestHandler =>
  (req, _res, next) => {
    const role = req.membership?.role;
    if (!role) return next(ApiError.forbidden());
    if (!can(role, permission)) {
      return next(ApiError.forbidden(`Your role (${role}) is not allowed to perform this action (${permission})`));
    }
    next();
  };
