import type { Business, BusinessRole } from '@prisma/client';
import { prisma } from '../config/prisma';
import { ApiError } from '../utils/ApiError';
import type { AddMemberInput } from '../validators/member.validator';

/**
 * Team management on top of the permission matrix. Extra rules (a matrix can't express "who may change whom"):
 *  - the OWNER role is never granted or changed through the API;
 *  - only the OWNER may grant, change or remove ADMINs (an ADMIN cannot promote themselves or a peer);
 *  - anyone except the OWNER may leave a business (remove themselves).
 */

const memberView = (m: { userId: string; role: BusinessRole; createdAt: Date; user: { id: string; name: string; email: string; profileImage: string | null } }) => ({
  userId: m.userId,
  name: m.user.name,
  email: m.user.email,
  profileImage: m.user.profileImage,
  role: m.role,
  joinedAt: m.createdAt,
});

const userSelect = { id: true, name: true, email: true, profileImage: true } as const;

export async function listMembers(businessId: string) {
  const members = await prisma.businessMember.findMany({
    where: { businessId },
    include: { user: { select: userSelect } },
    orderBy: { createdAt: 'asc' },
  });
  const order: Record<BusinessRole, number> = { OWNER: 0, ADMIN: 1, MANAGER: 2, ANALYST: 3 };
  return members.map(memberView).sort((a, b) => order[a.role] - order[b.role]);
}

export async function addMember(business: Business, actorRole: BusinessRole, input: AddMemberInput) {
  if (input.role === 'ADMIN' && actorRole !== 'OWNER') throw ApiError.forbidden('Only the owner can add administrators');

  const user = await prisma.user.findUnique({ where: { email: input.email }, select: userSelect });
  if (!user) throw ApiError.notFound('No registered user with that email. Ask them to sign up first.');

  const existing = await prisma.businessMember.findUnique({
    where: { businessId_userId: { businessId: business.id, userId: user.id } },
  });
  if (existing) throw ApiError.conflict('This user is already a member of the business');

  const created = await prisma.businessMember.create({
    data: { businessId: business.id, userId: user.id, role: input.role },
    include: { user: { select: userSelect } },
  });
  return memberView(created);
}

export async function updateMemberRole(business: Business, actorRole: BusinessRole, targetUserId: string, role: BusinessRole) {
  const target = await prisma.businessMember.findUnique({
    where: { businessId_userId: { businessId: business.id, userId: targetUserId } },
  });
  if (!target) throw ApiError.notFound('Member not found');
  if (target.role === 'OWNER') throw ApiError.forbidden('The owner role cannot be changed');
  if ((target.role === 'ADMIN' || role === 'ADMIN') && actorRole !== 'OWNER') {
    throw ApiError.forbidden('Only the owner can promote to, demote or change administrators');
  }

  const updated = await prisma.businessMember.update({
    where: { id: target.id },
    data: { role },
    include: { user: { select: userSelect } },
  });
  return memberView(updated);
}

export async function removeMember(business: Business, actor: { id: string; role: BusinessRole }, targetUserId: string) {
  const target = await prisma.businessMember.findUnique({
    where: { businessId_userId: { businessId: business.id, userId: targetUserId } },
  });
  if (!target) throw ApiError.notFound('Member not found');
  if (target.role === 'OWNER') throw ApiError.forbidden('The owner cannot be removed');
  if (target.role === 'ADMIN' && actor.role !== 'OWNER' && target.userId !== actor.id) {
    throw ApiError.forbidden('Only the owner can remove administrators');
  }

  await prisma.$transaction([
    prisma.businessMember.delete({ where: { id: target.id } }),
    prisma.user.updateMany({ where: { id: targetUserId, defaultBusinessId: business.id }, data: { defaultBusinessId: null } }),
  ]);
}
