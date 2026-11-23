/**
 * A tiny in-memory stand-in for the Prisma client, covering only what the HTTP-level tests touch.
 * Models that are not explicitly implemented resolve to `null` / `[]` / `0`, so a request that gets PAST
 * authentication + authorization simply finishes with some non-401/403 status - which is exactly what the
 * authorization tests need to observe.
 */
import { randomBytes } from 'crypto';

export const newId = () => randomBytes(12).toString('hex');

export interface FakeUser { id: string; name: string; email: string; password: string; profileImage: string | null; defaultBusinessId: string | null; preferences: null; createdAt: Date; updatedAt: Date }
export interface FakeBusiness { id: string; name: string; ownerId: string; currency: string; timezone: string; settings: null; orderSeq: number; [k: string]: unknown }

export function createFakePrisma() {
  const users = new Map<string, FakeUser>();
  const businesses = new Map<string, FakeBusiness>();
  const members = new Map<string, { id: string; businessId: string; userId: string; role: string; createdAt: Date }>();
  const memberKey = (b: string, u: string) => `${b}:${u}`;
  const orders = new Map<string, Record<string, unknown>>();

  const noop = new Proxy(
    {},
    {
      get: (_t, prop) => {
        if (prop === 'count') return async () => 0;
        if (prop === 'findMany' || prop === 'aggregate') return async () => [];
        if (prop === 'updateMany' || prop === 'deleteMany' || prop === 'createMany') return async () => ({ count: 0 });
        return async () => null;
      },
    },
  );

  const fake: Record<string, unknown> = {
    user: {
      findUnique: async ({ where, include }: { where: { id?: string; email?: string }; include?: { memberships?: unknown } }) => {
        const u = [...users.values()].find((x) => (where.id ? x.id === where.id : x.email === where.email));
        if (!u) return null;
        if (!include?.memberships) return u;
        const memberships = [...members.values()].filter((m) => m.userId === u.id).map((m) => ({ ...m, business: businesses.get(m.businessId) }));
        return { ...u, memberships };
      },
      create: async ({ data }: { data: Partial<FakeUser> }) => {
        const u: FakeUser = { id: newId(), profileImage: null, defaultBusinessId: null, preferences: null, createdAt: new Date(), updatedAt: new Date(), ...(data as FakeUser) };
        users.set(u.id, u);
        return u;
      },
      update: async ({ where, data }: { where: { id: string }; data: Partial<FakeUser> }) => Object.assign(users.get(where.id)!, data),
      updateMany: async () => ({ count: 0 }),
    },
    business: {
      findUnique: async ({ where }: { where: { id: string } }) => businesses.get(where.id) ?? null,
      update: async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => Object.assign(businesses.get(where.id)!, data),
    },
    businessMember: {
      findMany: async ({ where, include }: { where: { userId?: string; businessId?: string }; include?: { business?: boolean; user?: unknown } }) =>
        [...members.values()]
          .filter((m) => (where.userId ? m.userId === where.userId : true) && (where.businessId ? m.businessId === where.businessId : true))
          .map((m) => {
            const u = users.get(m.userId)!;
            return { ...m, ...(include?.business ? { business: businesses.get(m.businessId) } : {}), ...(include?.user ? { user: { id: u.id, name: u.name, email: u.email, profileImage: null } } : {}) };
          }),
      count: async ({ where }: { where: { businessId: string } }) => [...members.values()].filter((m) => m.businessId === where.businessId).length,
      deleteMany: async () => ({ count: 0 }),
      findUnique: async ({ where, include }: { where: { businessId_userId: { businessId: string; userId: string } }; include?: { business?: boolean; user?: unknown } }) => {
        const { businessId, userId } = where.businessId_userId;
        const m = members.get(memberKey(businessId, userId));
        if (!m) return null;
        return include?.business ? { ...m, business: businesses.get(businessId) } : m;
      },
      create: async ({ data }: { data: { businessId: string; userId: string; role: string } }) => {
        const m = { id: newId(), createdAt: new Date(), ...data };
        members.set(memberKey(data.businessId, data.userId), m);
        const u = users.get(data.userId)!;
        return { ...m, user: { id: u.id, name: u.name, email: u.email, profileImage: null } };
      },
      update: async ({ where, data }: { where: { id: string }; data: { role: string } }) => {
        const m = [...members.values()].find((x) => x.id === where.id)!;
        m.role = data.role;
        const u = users.get(m.userId)!;
        return { ...m, user: { id: u.id, name: u.name, email: u.email, profileImage: null } };
      },
      delete: async ({ where }: { where: { id: string } }) => {
        const m = [...members.values()].find((x) => x.id === where.id)!;
        members.delete(memberKey(m.businessId, m.userId));
        return m;
      },
    },
    order: new Proxy(
      { findFirst: async ({ where }: { where: { id: string } }) => orders.get(where.id) ?? null } as Record<string, unknown>,
      { get: (t, p: string) => (p in t ? t[p] : (noop as Record<string, unknown>)[p]) },
    ),
    $transaction: async (arg: unknown) => (typeof arg === 'function' ? (arg as (tx: unknown) => unknown)(fake) : Promise.all(arg as Promise<unknown>[])),
  };

  const prisma = new Proxy(fake, { get: (t, p: string) => (p in t ? t[p] : noop) });

  return {
    prisma,
    addUser(email: string, passwordHash: string, name = email.split('@')[0]): FakeUser {
      const u: FakeUser = { id: newId(), name, email, password: passwordHash, profileImage: null, defaultBusinessId: null, preferences: null, createdAt: new Date(), updatedAt: new Date() };
      users.set(u.id, u);
      return u;
    },
    addBusiness(ownerId: string, name = 'Biz'): FakeBusiness {
      const b: FakeBusiness = { id: newId(), name, ownerId, currency: 'USD', timezone: 'UTC', settings: null, orderSeq: 0 };
      businesses.set(b.id, b);
      return b;
    },
    addMember(businessId: string, userId: string, role: string) {
      members.set(memberKey(businessId, userId), { id: newId(), businessId, userId, role, createdAt: new Date() });
    },
    addOrder(order: Record<string, unknown>) {
      orders.set(order.id as string, order);
    },
    users,
    members,
  };
}
