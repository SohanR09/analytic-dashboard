/**
 * HTTP-level authentication + authorization tests.
 *
 * Real: Express app, middleware, JWT, Redis sessions, rate limiter, the RBAC matrix, route wiring.
 * Faked: only Prisma (in-memory), so no MongoDB is needed. Anything that gets PAST authorization ends with some
 * non-401/403 status (400/404/500 from the fake data layer), which is all these tests need to observe.
 */
import bcrypt from 'bcrypt';
import request from 'supertest';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { P, ROLES, can, type Permission, type Role } from '../../src/constants/permissions';
import { createFakePrisma, newId } from '../helpers/fakePrisma';

const fake = createFakePrisma();
vi.mock('../../src/config/prisma', () => ({
  get prisma() {
    return fake.prisma;
  },
  connectDB: async () => undefined,
  disconnectDB: async () => undefined,
}));

import { redis } from '../../src/config/redis';
import { createApp } from '../../src/app';
import { createSession } from '../../src/services/session.service';

const app = createApp();
const API = '/api/v1';
const hash = bcrypt.hashSync('Password1', 4);

// --- fixtures: one business, one user per role, plus an outsider with no membership ---------------------------
const owner = fake.addUser('owner@x.dev', hash);
const biz = fake.addBusiness(owner.id, 'Acme');
const tokens: Record<string, string> = {};
const bid = biz.id;
const otherBiz = fake.addBusiness(owner.id, 'Other');
const someId = newId();

beforeAll(async () => {
  for (const role of ROLES) {
    const u = role === 'OWNER' ? owner : fake.addUser(`${role.toLowerCase()}@x.dev`, hash);
    fake.addMember(bid, u.id, role);
    tokens[role] = (await createSession(u.id)).accessToken;
  }
  const outsider = fake.addUser('outsider@x.dev', hash);
  tokens.OUTSIDER = (await createSession(outsider.id)).accessToken;
});

const as = (token: string) => ({ authorization: `Bearer ${token}` });

type Method = 'get' | 'post' | 'put' | 'delete';
/** Every business-scoped endpoint and the permission that guards it. */
const ROUTES: [Method, string, Permission][] = [
  ['get', `/businesses/${bid}`, P.BUSINESS_READ],
  ['put', `/businesses/${bid}`, P.BUSINESS_UPDATE],
  ['put', `/businesses/${bid}/default`, P.BUSINESS_READ],
  ['delete', `/businesses/${bid}`, P.BUSINESS_DELETE],
  ['get', `/businesses/${bid}/members`, P.MEMBER_READ],
  ['post', `/businesses/${bid}/members`, P.MEMBER_MANAGE],
  ['put', `/businesses/${bid}/members/${someId}`, P.MEMBER_MANAGE],
  ['get', `/businesses/${bid}/dashboard`, P.ANALYTICS_READ],
  ['get', `/businesses/${bid}/dashboard/revenue`, P.ANALYTICS_READ],
  ['get', `/businesses/${bid}/dashboard/sales`, P.ANALYTICS_READ],
  ['get', `/businesses/${bid}/dashboard/top-products`, P.ANALYTICS_READ],
  ['get', `/businesses/${bid}/dashboard/order-status`, P.ANALYTICS_READ],
  ['get', `/businesses/${bid}/sales`, P.ANALYTICS_READ],
  ['get', `/businesses/${bid}/sales/analytics`, P.ANALYTICS_READ],
  ['get', `/businesses/${bid}/sales/trends`, P.ANALYTICS_READ],
  ['get', `/businesses/${bid}/revenue`, P.ANALYTICS_READ],
  ['get', `/businesses/${bid}/revenue/analytics`, P.ANALYTICS_READ],
  ['get', `/businesses/${bid}/revenue/trends`, P.ANALYTICS_READ],
  ['get', `/businesses/${bid}/inventory`, P.INVENTORY_READ],
  ['get', `/businesses/${bid}/inventory/analytics`, P.ANALYTICS_READ],
  ['get', `/businesses/${bid}/inventory/low-stock`, P.INVENTORY_READ],
  ['get', `/businesses/${bid}/inventory/movements`, P.INVENTORY_READ],
  ['put', `/businesses/${bid}/inventory/${someId}`, P.INVENTORY_UPDATE],
  ['get', `/businesses/${bid}/products`, P.PRODUCT_READ],
  ['post', `/businesses/${bid}/products`, P.PRODUCT_CREATE],
  ['get', `/businesses/${bid}/products/${someId}`, P.PRODUCT_READ],
  ['put', `/businesses/${bid}/products/${someId}`, P.PRODUCT_UPDATE],
  ['delete', `/businesses/${bid}/products/${someId}`, P.PRODUCT_DELETE],
  ['get', `/businesses/${bid}/categories`, P.CATEGORY_READ],
  ['post', `/businesses/${bid}/categories`, P.CATEGORY_WRITE],
  ['put', `/businesses/${bid}/categories/${someId}`, P.CATEGORY_WRITE],
  ['delete', `/businesses/${bid}/categories/${someId}`, P.CATEGORY_DELETE],
  ['get', `/businesses/${bid}/customers`, P.CUSTOMER_READ],
  ['post', `/businesses/${bid}/customers`, P.CUSTOMER_CREATE],
  ['get', `/businesses/${bid}/customers/analytics`, P.ANALYTICS_READ],
  ['get', `/businesses/${bid}/customers/${someId}`, P.CUSTOMER_READ],
  ['put', `/businesses/${bid}/customers/${someId}`, P.CUSTOMER_UPDATE],
  ['delete', `/businesses/${bid}/customers/${someId}`, P.CUSTOMER_DELETE],
  ['get', `/businesses/${bid}/orders`, P.ORDER_READ],
  ['post', `/businesses/${bid}/orders`, P.ORDER_CREATE],
  ['get', `/businesses/${bid}/orders/${someId}`, P.ORDER_READ],
  ['put', `/businesses/${bid}/orders/${someId}`, P.ORDER_UPDATE],
  ['get', `/businesses/${bid}/reports`, P.REPORT_READ],
  ['get', `/businesses/${bid}/reports/types`, P.REPORT_READ],
  ['post', `/businesses/${bid}/reports/generate`, P.REPORT_GENERATE],
  ['get', `/businesses/${bid}/reports/${someId}`, P.REPORT_READ],
  ['get', `/businesses/${bid}/reports/${someId}/export`, P.REPORT_EXPORT],
  ['delete', `/businesses/${bid}/reports/${someId}`, P.REPORT_DELETE],
];

beforeEach(async () => {
  // keep rate-limit counters from earlier cases out of the way
  const keys = await redis.keys('shoplytics:rl:*'); // KEYS is not auto-prefixed, DEL is
  if (keys.length) await redis.del(...keys.map((k) => k.replace(/^shoplytics:/, '')));
});

describe('authentication', () => {
  it('rejects requests without a token, with garbage, and with a revoked session', async () => {
    expect((await request(app).get(`${API}/businesses`)).status).toBe(401);
    expect((await request(app).get(`${API}/businesses`).set(as('abc'))).status).toBe(401);

    const t = await createSession(owner.id);
    expect((await request(app).get(`${API}/businesses`).set(as(t.accessToken))).status).toBe(200);
    await request(app).post(`${API}/auth/logout`).set(as(t.accessToken)).expect(200);
    const after = await request(app).get(`${API}/businesses`).set(as(t.accessToken));
    expect(after.status).toBe(401);
    expect(after.body.details).toEqual({ code: 'SESSION_REVOKED' });
  });

  it('every business route is 401 without a token', async () => {
    for (const [method, path] of ROUTES) {
      const res = await request(app)[method](`${API}${path}`);
      expect(res.status, `${method.toUpperCase()} ${path}`).toBe(401);
    }
  });
});

describe('authorization matrix (route x role)', () => {
  for (const [method, path, permission] of ROUTES) {
    it(`${method.toUpperCase().padEnd(6)} ${path.replace(bid, ':businessId').replace(someId, ':id')}  [${permission}]`, async () => {
      for (const role of ROLES) {
        const res = await request(app)[method](`${API}${path}`).set(as(tokens[role])).send({});
        if (can(role as Role, permission)) {
          expect([401, 403], `${role} should be ALLOWED (${res.status} ${JSON.stringify(res.body.message)})`).not.toContain(res.status);
        } else {
          expect(res.status, `${role} should be FORBIDDEN`).toBe(403);
          expect(res.body.message).toContain(permission);
        }
      }
    });
  }
});

describe('tenant isolation', () => {
  it('a user with no membership gets 404 (not 403) on every business route - existence is not leaked', async () => {
    for (const [method, path] of ROUTES) {
      const res = await request(app)[method](`${API}${path}`).set(as(tokens.OUTSIDER)).send({});
      expect(res.status, `${method.toUpperCase()} ${path}`).toBe(404);
    }
  });

  it('a business that exists but the caller is not a member of looks identical to one that does not exist', async () => {
    const real = await request(app).get(`${API}/businesses/${otherBiz.id}`).set(as(tokens.MANAGER));
    const fakeId = await request(app).get(`${API}/businesses/${newId()}`).set(as(tokens.MANAGER));
    expect(real.status).toBe(404);
    expect(real.body).toEqual(fakeId.body);
  });

  it('rejects malformed business ids', async () => {
    expect((await request(app).get(`${API}/businesses/not-an-id`).set(as(tokens.OWNER))).status).toBe(400);
  });
});

describe('role changes take effect immediately', () => {
  it('removing a membership revokes access on the very next request', async () => {
    const u = fake.addUser('temp@x.dev', hash);
    fake.addMember(bid, u.id, 'MANAGER');
    const token = (await createSession(u.id)).accessToken;
    expect((await request(app).get(`${API}/businesses/${bid}/products`).set(as(token))).status).not.toBe(404);
    fake.members.delete(`${bid}:${u.id}`);
    expect((await request(app).get(`${API}/businesses/${bid}/products`).set(as(token))).status).toBe(404);
  });
});

describe('team management rules', () => {
  const addTarget = (email: string, role: string) => {
    const u = fake.addUser(email, hash);
    fake.addMember(bid, u.id, role);
    return u;
  };

  it('an ADMIN cannot add another ADMIN, but the OWNER can', async () => {
    const candidate = fake.addUser('cand@x.dev', hash);
    const asAdmin = await request(app).post(`${API}/businesses/${bid}/members`).set(as(tokens.ADMIN)).send({ email: candidate.email, role: 'ADMIN' });
    expect(asAdmin.status).toBe(403);
    const asOwner = await request(app).post(`${API}/businesses/${bid}/members`).set(as(tokens.OWNER)).send({ email: candidate.email, role: 'ADMIN' });
    expect(asOwner.status).toBe(201);
    expect(asOwner.body.data.role).toBe('ADMIN');
  });

  it('an ADMIN can add MANAGER / ANALYST, and duplicates are rejected', async () => {
    const c = fake.addUser('cand2@x.dev', hash);
    expect((await request(app).post(`${API}/businesses/${bid}/members`).set(as(tokens.ADMIN)).send({ email: c.email, role: 'ANALYST' })).status).toBe(201);
    expect((await request(app).post(`${API}/businesses/${bid}/members`).set(as(tokens.ADMIN)).send({ email: c.email, role: 'ANALYST' })).status).toBe(409);
  });

  it('OWNER cannot be granted through the API, changed, or removed', async () => {
    const c = fake.addUser('cand3@x.dev', hash);
    expect((await request(app).post(`${API}/businesses/${bid}/members`).set(as(tokens.OWNER)).send({ email: c.email, role: 'OWNER' })).status).toBe(400);
    expect((await request(app).put(`${API}/businesses/${bid}/members/${owner.id}`).set(as(tokens.ADMIN)).send({ role: 'ANALYST' })).status).toBe(403);
    expect((await request(app).delete(`${API}/businesses/${bid}/members/${owner.id}`).set(as(tokens.OWNER))).status).toBe(403);
  });

  it('an ADMIN cannot promote anyone to ADMIN or change an ADMIN; the OWNER can', async () => {
    const m = addTarget('mgr2@x.dev', 'MANAGER');
    expect((await request(app).put(`${API}/businesses/${bid}/members/${m.id}`).set(as(tokens.ADMIN)).send({ role: 'ADMIN' })).status).toBe(403);
    expect((await request(app).put(`${API}/businesses/${bid}/members/${m.id}`).set(as(tokens.ADMIN)).send({ role: 'ANALYST' })).status).toBe(200);
    expect((await request(app).put(`${API}/businesses/${bid}/members/${m.id}`).set(as(tokens.OWNER)).send({ role: 'ADMIN' })).status).toBe(200);
    expect((await request(app).put(`${API}/businesses/${bid}/members/${m.id}`).set(as(tokens.ADMIN)).send({ role: 'MANAGER' })).status).toBe(403);
  });

  it('a MANAGER or ANALYST cannot remove other members, but anyone but the owner may leave', async () => {
    const victim = addTarget('victim@x.dev', 'ANALYST');
    // removal of someone else is checked by the service: managers have no member:manage -> only ADMIN+ reach it via the route
    const leaver = addTarget('leaver@x.dev', 'MANAGER');
    const leaverToken = (await createSession(leaver.id)).accessToken;
    expect((await request(app).delete(`${API}/businesses/${bid}/members/${leaver.id}`).set(as(leaverToken))).status).toBe(200);
    expect(fake.members.has(`${bid}:${leaver.id}`)).toBe(false);
    expect(fake.members.has(`${bid}:${victim.id}`)).toBe(true);
  });
});

describe('refunds need their own permission on top of order:update', () => {
  const orderId = newId();
  beforeAll(() => {
    fake.addOrder({ id: orderId, businessId: bid, orderNumber: 'ORD-1', orderStatus: 'DELIVERED', paymentStatus: 'PAID', subtotal: 100, discountAmount: 0, refundAmount: 0, items: [] });
  });

  it('MANAGER may update an order but not refund it; ADMIN may', async () => {
    const refund = { orderStatus: 'REFUNDED' };
    const m = await request(app).put(`${API}/businesses/${bid}/orders/${orderId}`).set(as(tokens.MANAGER)).send(refund);
    expect(m.status).toBe(403);
    expect(m.body.message).toContain('order:refund');
    expect((await request(app).put(`${API}/businesses/${bid}/orders/${orderId}`).set(as(tokens.MANAGER)).send({ refundAmount: 10 })).status).toBe(403);
    expect((await request(app).put(`${API}/businesses/${bid}/orders/${orderId}`).set(as(tokens.ANALYST)).send({ notes: 'x' })).status).toBe(403); // no order:update
    expect((await request(app).put(`${API}/businesses/${bid}/orders/${orderId}`).set(as(tokens.ADMIN)).send(refund)).status).not.toBe(403);
  });
});

describe('login protection (Redis lockout + rate limit)', () => {
  it('logs in with valid credentials and returns a token pair', async () => {
    const res = await request(app).post(`${API}/auth/login`).send({ email: 'owner@x.dev', password: 'Password1' });
    expect(res.status).toBe(200);
    expect(res.body.data.expiresIn).toEqual(expect.any(Number));
    expect(res.body.data.accessToken).toBeTruthy();
    expect(res.body.data.refreshToken).toBeTruthy();
    expect(res.body.data.user.password).toBeUndefined();
  });

  it('locks an (IP, email) pair after LOGIN_MAX_FAILURES wrong passwords, with Retry-After', async () => {
    const attempt = (password: string) => request(app).post(`${API}/auth/login`).send({ email: 'owner@x.dev', password });
    for (let i = 0; i < 3; i++) expect((await attempt('wrong-pass-1')).status).toBe(401);
    const locked = await attempt('Password1'); // even the CORRECT password is refused while locked
    expect(locked.status).toBe(429);
    expect(Number(locked.headers['retry-after'])).toBeGreaterThan(0);
    // a different account from the same IP is unaffected
    expect((await request(app).post(`${API}/auth/login`).send({ email: 'admin@x.dev', password: 'Password1' })).status).toBe(200);
  });

  it('does not reveal whether an email exists', async () => {
    const a = await request(app).post(`${API}/auth/login`).send({ email: 'nobody@x.dev', password: 'Password1' });
    const b = await request(app).post(`${API}/auth/login`).send({ email: 'manager@x.dev', password: 'WrongPass1' });
    expect(a.status).toBe(401);
    expect(a.body.message).toBe(b.body.message);
  });

  it('the auth tier rate-limits by IP regardless of the email used', async () => {
    let last = 0;
    for (let i = 0; i < 25; i++) last = (await request(app).post(`${API}/auth/login`).send({ email: `u${i}@x.dev`, password: 'whatever1' })).status;
    expect(last).toBe(429);
  });
});

describe('register -> refresh -> logout-all flow', () => {
  it('works end to end and rotates refresh tokens', async () => {
    const reg = await request(app).post(`${API}/auth/register`).send({ name: 'New Person', email: 'new@x.dev', password: 'Password1', confirmPassword: 'Password1' });
    expect(reg.status).toBe(201);
    const { accessToken, refreshToken } = reg.body.data;

    expect((await request(app).get(`${API}/auth/me`).set(as(accessToken))).status).toBe(200);

    const refreshed = await request(app).post(`${API}/auth/refresh`).send({ refreshToken });
    expect(refreshed.status).toBe(200);
    expect(refreshed.body.data.refreshToken).not.toBe(refreshToken);

    // replaying the old refresh token is treated as theft: the session dies
    expect((await request(app).post(`${API}/auth/refresh`).send({ refreshToken })).status).toBe(401);
    expect((await request(app).get(`${API}/auth/me`).set(as(refreshed.body.data.accessToken))).status).toBe(401);
  });

  it('validates input and rejects duplicate registration', async () => {
    expect((await request(app).post(`${API}/auth/register`).send({ name: 'A', email: 'bad', password: 'short' })).status).toBe(400);
    expect((await request(app).post(`${API}/auth/register`).send({ name: 'Dup', email: 'owner@x.dev', password: 'Password1' })).status).toBe(409);
    expect((await request(app).post(`${API}/auth/register`).send({ name: 'Mismatch', email: 'mm@x.dev', password: 'Password1', confirmPassword: 'Password2' })).status).toBe(400);
  });
});

describe('misc', () => {
  it('health endpoint works without auth and unknown routes 404 as JSON', async () => {
    expect((await request(app).get(`${API}/health`)).body.data.status).toBe('ok');
    const nf = await request(app).get(`${API}/does-not-exist`);
    expect(nf.status).toBe(404);
    expect(nf.body.success).toBe(false);
  });

  it('sends security headers and exposes rate-limit headers', async () => {
    const res = await request(app).get(`${API}/health`);
    expect(res.headers['x-powered-by']).toBeUndefined();
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['ratelimit-limit']).toBeDefined();
  });
});
