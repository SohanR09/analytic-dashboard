/**
 * Seeds demo users with DIFFERENT ROLES, three businesses, and ~4 months of data.
 *
 *   npm run seed
 *
 * Idempotent: it removes the previous demo users / businesses (only those) and recreates them.
 * All demo accounts use the password:  Password@123
 *
 *   email                      Acme Apparel    VoltHub    Paper Trail Books
 *   owner@shoplytics.dev       OWNER           OWNER      OWNER
 *   admin@shoplytics.dev       ADMIN           MANAGER    -
 *   manager@shoplytics.dev     MANAGER         ANALYST    -
 *   analyst@shoplytics.dev     ANALYST         -          ADMIN
 *   outsider@shoplytics.dev    -               -          -       (no membership: proves tenant isolation, 404)
 */
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import type { BusinessRole, OrderStatus, PaymentStatus, Prisma } from '@prisma/client';
import { connectDB, disconnectDB, prisma } from '../config/prisma';
import { disconnectRedis } from '../config/redis';
import { DEFAULT_SETTINGS, deleteBusiness } from '../services/business.service';
import { round } from '../utils/helpers';

const PASSWORD = 'Password@123';
const DAY_MS = 86_400_000;

// ---- helpers ---------------------------------------------------------------------------------------------

/** A valid 24-hex MongoDB ObjectId string (ids are generated here so related rows can be bulk-inserted). */
const newId = () => Math.floor(Date.now() / 1000).toString(16).padStart(8, '0') + crypto.randomBytes(8).toString('hex');

/** Small deterministic PRNG so demo data is reproducible. */
function makeRng(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

async function chunked<T>(rows: T[], size: number, fn: (chunk: T[]) => Promise<unknown>) {
  for (let i = 0; i < rows.length; i += size) await fn(rows.slice(i, i + size));
}

// ---- demo data -------------------------------------------------------------------------------------------

const USERS = [
  { key: 'owner', name: 'Olivia Owner', email: 'owner@shoplytics.dev' },
  { key: 'admin', name: 'Adam Admin', email: 'admin@shoplytics.dev' },
  { key: 'manager', name: 'Maya Manager', email: 'manager@shoplytics.dev' },
  { key: 'analyst', name: 'Aarav Analyst', email: 'analyst@shoplytics.dev' },
  { key: 'outsider', name: 'Oscar Outsider', email: 'outsider@shoplytics.dev' },
] as const;
type UserKey = (typeof USERS)[number]['key'];

type CatalogRow = [name: string, category: string, price: number, cost: number];

const FASHION: CatalogRow[] = [
  ['Classic White Tee', 'Tops', 19.99, 7], ['Oversized Hoodie', 'Tops', 54, 22], ['Linen Shirt', 'Tops', 44.5, 16],
  ['Slim Fit Jeans', 'Bottoms', 59.9, 21], ['Cargo Shorts', 'Bottoms', 34, 12], ['Pleated Skirt', 'Bottoms', 39, 14],
  ['Leather Belt', 'Accessories', 24, 8], ['Canvas Tote', 'Accessories', 17.5, 5], ['Wool Beanie', 'Accessories', 15, 4.5],
  ['White Sneakers', 'Footwear', 79, 31], ['Chelsea Boots', 'Footwear', 129, 52], ['Running Shoes', 'Footwear', 94, 38],
];
const ELECTRONICS: CatalogRow[] = [
  ['Wireless Earbuds', 'Audio', 4999, 2000], ['Over-Ear Headphones', 'Audio', 11999, 5400], ['Bluetooth Speaker', 'Audio', 6499, 2700],
  ['USB-C Fast Charger', 'Chargers', 1999, 600], ['Power Bank 20000mAh', 'Chargers', 2999, 1200], ['Wireless Charging Pad', 'Chargers', 1799, 600],
  ['Mechanical Keyboard', 'Computing', 7999, 3400], ['Ergonomic Mouse', 'Computing', 3499, 1300], ['27" 4K Monitor', 'Computing', 28999, 21000],
  ['Smart Watch', 'Wearables', 14999, 7600], ['Fitness Band', 'Wearables', 3999, 1600], ['Action Camera', 'Cameras', 17999, 10500],
];
const BOOKS: CatalogRow[] = [
  ['Paperback Novel', 'Fiction', 12, 4], ['Hardcover Atlas', 'Reference', 45, 20], ['Cookbook', 'Lifestyle', 28, 11], ['Sketchbook', 'Stationery', 9, 3],
];

const FIRST = ['Aarav', 'Maya', 'Liam', 'Sofia', 'Noah', 'Isha', 'Ethan', 'Zara', 'Kabir', 'Emma', 'Rohan', 'Olivia', 'Arjun', 'Mia', 'Lucas', 'Anaya', 'Daniel', 'Priya', 'Leo', 'Nina'];
const LAST = ['Sharma', 'Patel', 'Smith', 'Garcia', 'Khan', 'Brown', 'Singh', 'Lee', 'Mehta', 'Johnson', 'Rao', 'Miller', 'Nair', 'Davis', 'Joshi', 'Wilson'];
const CITIES: [string, string][] = [['Mumbai', 'India'], ['Nagpur', 'India'], ['Pune', 'India'], ['Delhi', 'India'], ['London', 'UK'], ['Austin', 'USA'], ['Toronto', 'Canada']];
const PAYMENTS = ['card', 'upi', 'paypal', 'cod', 'bank_transfer'];

interface BusinessSeed {
  name: string;
  description: string;
  category: string;
  currency: string;
  timezone: string;
  catalog: CatalogRow[];
  orders: number;
  customers: number;
  seed: number;
  members: Partial<Record<UserKey, BusinessRole>>;
}

const BUSINESSES: BusinessSeed[] = [
  {
    name: 'Acme Apparel', description: 'Everyday fashion basics and footwear.', category: 'Fashion', currency: 'USD', timezone: 'America/New_York',
    catalog: FASHION, orders: 320, customers: 45, seed: 11, members: { owner: 'OWNER', admin: 'ADMIN', manager: 'MANAGER', analyst: 'ANALYST' },
  },
  {
    name: 'VoltHub', description: 'Consumer electronics and accessories.', category: 'Electronics', currency: 'INR', timezone: 'Asia/Kolkata',
    catalog: ELECTRONICS, orders: 240, customers: 40, seed: 29, members: { owner: 'OWNER', admin: 'MANAGER', manager: 'ANALYST' },
  },
  {
    name: 'Paper Trail Books', description: 'Independent bookshop and stationery.', category: 'Books', currency: 'USD', timezone: 'UTC',
    catalog: BOOKS, orders: 40, customers: 10, seed: 5, members: { owner: 'OWNER', analyst: 'ADMIN' },
  },
];

// ---- seeding ---------------------------------------------------------------------------------------------

async function wipePreviousDemo() {
  const users = await prisma.user.findMany({ where: { email: { in: USERS.map((u) => u.email) } }, select: { id: true } });
  if (!users.length) return;
  const ids = users.map((u) => u.id);
  const businesses = await prisma.business.findMany({ where: { ownerId: { in: ids } } });
  for (const b of businesses) await deleteBusiness(b);
  await prisma.businessMember.deleteMany({ where: { userId: { in: ids } } });
  await prisma.report.deleteMany({ where: { userId: { in: ids } } });
  await prisma.user.deleteMany({ where: { id: { in: ids } } });
}

async function seedBusiness(cfg: BusinessSeed, userIds: Record<UserKey, string>) {
  const rand = makeRng(cfg.seed);
  const pick = <T>(arr: T[]) => arr[Math.floor(rand() * arr.length)];
  const now = Date.now();
  const ownerKey = (Object.keys(cfg.members) as UserKey[]).find((k) => cfg.members[k] === 'OWNER')!;
  const businessId = newId();

  await prisma.business.create({
    data: {
      id: businessId, name: cfg.name, description: cfg.description, category: cfg.category, currency: cfg.currency, timezone: cfg.timezone,
      settings: DEFAULT_SETTINGS as Prisma.InputJsonValue, orderSeq: cfg.orders, ownerId: userIds[ownerKey],
    },
  });
  await prisma.businessMember.createMany({
    data: (Object.entries(cfg.members) as [UserKey, BusinessRole][]).map(([k, role]) => ({ businessId, userId: userIds[k], role })),
  });

  // categories + products (the last two products are deliberately low / out of stock)
  const categoryIds = new Map<string, string>();
  for (const [, cat] of cfg.catalog) if (!categoryIds.has(cat)) categoryIds.set(cat, newId());
  await prisma.category.createMany({ data: [...categoryIds].map(([name, id]) => ({ id, businessId, name, description: `${name} products` })) });

  const products = cfg.catalog.map(([name, category, price, cost], i) => ({
    id: newId(), businessId, name, sku: `${cfg.name.replace(/[^A-Za-z]/g, '').slice(0, 3).toUpperCase()}-${String(i + 1).padStart(3, '0')}`,
    categoryId: categoryIds.get(category)!, categoryName: category, price, costPrice: cost,
    stockQuantity: i >= cfg.catalog.length - 2 ? (i % 2 === 0 ? 0 : 4) : 20 + Math.floor(rand() * 80), minimumStockLevel: 10,
  }));
  await prisma.product.createMany({
    data: products.map(({ categoryName: _c, ...p }) => ({ ...p, description: `${p.name} (demo product)` })),
  });
  await prisma.inventoryMovement.createMany({
    data: products.map((p) => ({
      businessId, productId: p.id, movementType: 'INITIAL' as const, quantity: p.stockQuantity, previousQuantity: 0, newQuantity: p.stockQuantity,
      reason: 'Opening stock', createdAt: new Date(now - 120 * DAY_MS),
    })),
  });
  // a few visible restocks so the movement history is not empty
  await prisma.inventoryMovement.createMany({
    data: products.slice(0, 4).map((p, i) => ({
      businessId, productId: p.id, movementType: 'PURCHASE' as const, quantity: 25, previousQuantity: Math.max(0, p.stockQuantity - 25),
      newQuantity: p.stockQuantity, reason: 'Supplier delivery', createdAt: new Date(now - (10 + i * 7) * DAY_MS),
    })),
  });

  // customers
  const customers = Array.from({ length: cfg.customers }, (_, i) => {
    const [city, country] = pick(CITIES);
    const first = pick(FIRST);
    const last = pick(LAST);
    return {
      id: newId(), businessId, name: `${first} ${last}`, email: `${first}.${last}.${i}@example.com`.toLowerCase(), phone: `+1555${String(1000000 + i)}`,
      city, country, createdAt: new Date(now - Math.floor(rand() * 150) * DAY_MS),
    };
  });
  await prisma.customer.createMany({ data: customers });

  // orders over the last 120 days, skewed to recent days so charts show growth
  const orders: Prisma.OrderCreateManyInput[] = Array.from({ length: cfg.orders }, (_, n) => {
    const daysAgo = Math.floor(120 * rand() ** 1.4);
    const orderDate = new Date(now - daysAgo * DAY_MS - Math.floor(rand() * DAY_MS));
    const chosen = new Set<number>();
    const lineCount = 1 + Math.floor(rand() * 3);
    while (chosen.size < Math.min(lineCount, products.length)) chosen.add(Math.floor(rand() * products.length));

    const items = [...chosen].map((idx) => {
      const p = products[idx];
      const quantity = 1 + Math.floor(rand() * 3);
      return {
        productId: p.id, name: p.name, sku: p.sku, categoryId: p.categoryId, categoryName: p.categoryName,
        quantity, unitPrice: p.price, unitCost: p.costPrice, totalPrice: round(quantity * p.price),
      };
    });
    const subtotal = round(items.reduce((s, i) => s + i.totalPrice, 0));
    const discountAmount = rand() < 0.15 ? round(subtotal * (0.05 + rand() * 0.05)) : 0;
    const taxAmount = round((subtotal - discountAmount) * 0.08);
    const shippingAmount = subtotal - discountAmount > 75 ? 0 : 5.99;
    const maxRefund = round(subtotal - discountAmount);

    let orderStatus: OrderStatus;
    if (daysAgo < 2) orderStatus = rand() < 0.5 ? 'PENDING' : 'PROCESSING';
    else if (daysAgo < 5) orderStatus = rand() < 0.5 ? 'PROCESSING' : 'SHIPPED';
    else {
      const r = rand();
      orderStatus = r < 0.86 ? 'DELIVERED' : r < 0.93 ? 'CANCELLED' : 'REFUNDED';
    }

    let paymentStatus: PaymentStatus = orderStatus === 'PENDING' || orderStatus === 'CANCELLED' ? 'PENDING' : 'PAID';
    let refundAmount = 0;
    if (orderStatus === 'REFUNDED') {
      refundAmount = maxRefund;
      paymentStatus = 'REFUNDED';
    } else if (orderStatus === 'DELIVERED' && rand() < 0.04) {
      refundAmount = round(maxRefund * 0.3);
      paymentStatus = 'PARTIALLY_REFUNDED';
    } else if (orderStatus === 'PENDING' && rand() < 0.15) {
      paymentStatus = 'FAILED';
    }

    const flow: OrderStatus[] = ['PENDING', 'PROCESSING', 'SHIPPED', 'DELIVERED'];
    const reached = orderStatus === 'CANCELLED' ? ['PENDING', 'CANCELLED'] : orderStatus === 'REFUNDED' ? [...flow, 'REFUNDED'] : flow.slice(0, flow.indexOf(orderStatus) + 1);
    const timeline = (reached as OrderStatus[]).map((status, i) => ({ status, at: new Date(orderDate.getTime() + i * DAY_MS) }));

    return {
      businessId, customerId: rand() < 0.85 ? pick(customers).id : null, orderNumber: `ORD-${String(n + 1).padStart(6, '0')}`, items,
      subtotal, discountAmount, taxAmount, shippingAmount, refundAmount, totalAmount: round(subtotal - discountAmount + taxAmount + shippingAmount),
      paymentStatus, paymentMethod: pick(PAYMENTS), orderStatus, timeline, orderDate,
      shippingAddress: { line1: '1 Demo Street', city: pick(CITIES)[0], country: 'Demo Land' },
    };
  });
  await chunked(orders, 250, (chunk) => prisma.order.createMany({ data: chunk }));

  console.log(`  ✓ ${cfg.name.padEnd(18)} ${products.length} products, ${customers.length} customers, ${orders.length} orders`);
  return businessId;
}

async function main() {
  await connectDB();
  await wipePreviousDemo();
  console.log('Seeding demo data...');

  const password = await bcrypt.hash(PASSWORD, 10);
  const userIds = {} as Record<UserKey, string>;
  for (const u of USERS) {
    userIds[u.key] = (await prisma.user.create({ data: { name: u.name, email: u.email, password } })).id;
  }

  const defaults: Partial<Record<UserKey, string>> = {};
  for (const cfg of BUSINESSES) {
    const id = await seedBusiness(cfg, userIds);
    for (const k of Object.keys(cfg.members) as UserKey[]) defaults[k] ??= id;
  }
  for (const [k, businessId] of Object.entries(defaults)) {
    await prisma.user.update({ where: { id: userIds[k as UserKey] }, data: { defaultBusinessId: businessId } });
  }

  console.log(`\nDemo accounts (password: ${PASSWORD})`);
  console.table(
    USERS.map((u) => ({
      email: u.email,
      ...Object.fromEntries(BUSINESSES.map((b) => [b.name, b.members[u.key] ?? '-'])),
    })),
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await Promise.allSettled([disconnectDB(), disconnectRedis()]);
  });
