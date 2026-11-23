import bcrypt from 'bcrypt';
import type { Prisma } from '@prisma/client';
import { env } from '../config/env';
import { prisma } from '../config/prisma';
import { ApiError } from '../utils/ApiError';
import type { ChangePasswordInput, UpdateProfileInput } from '../validators/user.validator';
import { publicUser } from './auth.service';
import * as sessions from './session.service';

/** The user plus every business they belong to, with their role (the SPA uses this for menus/guards). */
export async function getProfile(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { memberships: { include: { business: { select: { id: true, name: true } } } } },
  });
  if (!user) throw ApiError.notFound('User not found');

  const { memberships, ...rest } = user;
  return {
    ...publicUser(rest as typeof user),
    memberships: memberships.map((m) => ({ businessId: m.businessId, businessName: m.business.name, role: m.role })),
  };
}

export async function updateProfile(userId: string, input: UpdateProfileInput) {
  const data: Prisma.UserUpdateInput = {};
  if (input.name !== undefined) data.name = input.name;
  if (input.profileImage !== undefined) data.profileImage = input.profileImage || null;
  if (input.preferences !== undefined) data.preferences = input.preferences as Prisma.InputJsonValue;

  if (input.email !== undefined) {
    const current = await prisma.user.findUnique({ where: { id: userId } });
    if (!current) throw ApiError.notFound('User not found');
    if (input.email !== current.email) {
      if (!(await bcrypt.compare(input.currentPassword ?? '', current.password))) {
        throw ApiError.badRequest('Current password is incorrect');
      }
      data.email = input.email; // a duplicate surfaces as 409 via the unique index
    }
  }

  const user = await prisma.user.update({ where: { id: userId }, data });
  return publicUser(user);
}

export async function changePassword(userId: string, currentSid: string, input: ChangePasswordInput) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw ApiError.notFound('User not found');
  if (!(await bcrypt.compare(input.currentPassword, user.password))) {
    throw ApiError.badRequest('Current password is incorrect');
  }

  await prisma.user.update({
    where: { id: userId },
    data: { password: await bcrypt.hash(input.newPassword, env.BCRYPT_SALT_ROUNDS) },
  });
  const revoked = await sessions.revokeAllSessions(userId, currentSid); // sign out every OTHER device
  return { message: 'Password changed', otherSessionsRevoked: revoked };
}
