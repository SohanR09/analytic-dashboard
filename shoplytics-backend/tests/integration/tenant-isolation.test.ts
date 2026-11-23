/**
 * Real-database tenant isolation test (the spec's critical security test).
 * Needs a running MongoDB replica set + Redis:   RUN_DB_TESTS=1 DATABASE_URL=... npm run test:integration
 * Skipped by default.
 */
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const run = process.env.RUN_DB_TESTS === '1';

describe.skipIf(!run)('tenant isolation (real MongoDB)', () => {
  let app: import('express').Express;
  let prisma: typeof import('../../src/config/prisma').prisma;
  const API = '/api/v1';
  const tok: Record<string, string> = {};
  const ids: Record<string, string> = {};

  const reg = async (name: string) => {
    const r = await request(app).post(`${API}/auth/register`).send({ name, email: `${name}-${Date.now()}@iso.dev`, password: 'Password1' });
    return r.body.data.accessToken as string;
  };
  const auth = (t: string) => ({ authorization: `Bearer ${t}` });

  beforeAll(async () => {
    process.env.DATABASE_URL = process.env.DATABASE_URL || 'mongodb://127.0.0.1:27017/shoplytics_test?replicaSet=rs0';
    ({ prisma } = await import('../../src/config/prisma'));
    await (await import('../../src/config/prisma')).connectDB();
    app = (await import('../../src/app')).createApp();
    tok.a = await reg('usera');
    tok.b = await reg('userb');
    ids.bizA = (await request(app).post(`${API}/businesses`).set(auth(tok.a)).send({ name: 'A Co', category: 'Retail' })).body.data.id;
    ids.bizB = (await request(app).post(`${API}/businesses`).set(auth(tok.b)).send({ name: 'B Co', category: 'Retail' })).body.data.id;
    ids.prodA = (await request(app).post(`${API}/businesses/${ids.bizA}/products`).set(auth(tok.a)).send({ name: 'Tee', sku: 'TEE-1', price: 20, costPrice: 8, stockQuantity: 10 })).body.data.id;
  });
  afterAll(async () => {
    await prisma?.$disconnect();
  });

  it("User B cannot read, list or mutate Business A by changing the businessId", async () => {
    for (const path of ['', '/products', '/orders', '/customers', '/dashboard', '/members']) {
      expect((await request(app).get(`${API}/businesses/${ids.bizA}${path}`).set(auth(tok.b))).status, path).toBe(404);
    }
    expect((await request(app).post(`${API}/businesses/${ids.bizA}/products`).set(auth(tok.b)).send({ name: 'x', sku: 'x', price: 1, costPrice: 1 })).status).toBe(404);
  });

  it("a product id from Business A is invisible through Business B's URL", async () => {
    expect((await request(app).get(`${API}/businesses/${ids.bizB}/products/${ids.prodA}`).set(auth(tok.b))).status).toBe(404);
    expect((await request(app).put(`${API}/businesses/${ids.bizB}/products/${ids.prodA}`).set(auth(tok.b)).send({ name: 'hijack' })).status).toBe(404);
    expect((await request(app).delete(`${API}/businesses/${ids.bizB}/products/${ids.prodA}`).set(auth(tok.b))).status).toBe(404);
    expect((await request(app).get(`${API}/businesses/${ids.bizA}/products/${ids.prodA}`).set(auth(tok.a))).body.data.name).toBe('Tee');
  });

  it("an order in Business B cannot reference Business A's product", async () => {
    const r = await request(app).post(`${API}/businesses/${ids.bizB}/orders`).set(auth(tok.b)).send({ items: [{ productId: ids.prodA, quantity: 1 }] });
    expect([400, 404, 422]).toContain(r.status);
  });
});
