# Shoplytics Backend (v1.1)

Multi-business e-commerce analytics API. **Node.js · Express · TypeScript · Prisma ORM · MongoDB · Redis**, monolith with MVC + service layer.

```
routes → middleware (authenticate · rate limit · businessContext · authorize · validate) → controllers → services → Prisma
```

Requirements live in [`docs/REQUIREMENTS.md`](docs/REQUIREMENTS.md). Postman files are in [`postman/`](postman).

## Quick start

```bash
cp .env.example .env            # set JWT_ACCESS_SECRET (>= 32 chars)
docker compose up -d mongo redis  # MongoDB 7 (single-node replica set rs0) + Redis 7
npm install                     # also runs `prisma generate`
npm run db:push                 # create collections / indexes
npm run seed                    # demo users, businesses, ~4 months of orders
npm run dev                     # http://localhost:5000/api/v1
```

### Run everything in Docker

```bash
cp .env.example .env              # set DATABASE_URL (external MongoDB, e.g. Atlas), JWT_ACCESS_SECRET, REDIS_PASSWORD, CLIENT_URL
docker compose up -d --build      # redis -> migrate (prisma db push) -> API on port 80
```

MongoDB is not part of this stack: the API and `migrate` use `DATABASE_URL` from `.env`, which must be a replica set (Atlas clusters are). The API is published on host port `API_HOST_PORT` (default `80`; set `API_HOST_PORT=5000` locally, or `127.0.0.1:5000` behind nginx).

Startup order: Redis becomes healthy, the one-off `migrate` container syncs collections and **indexes (including the unique constraints)**, and only if that succeeds does the API start. Re-run it on its own with `docker compose run --rm migrate`.

The API container always runs with `NODE_ENV=production` (set in the compose file, overriding `.env`). Inside the stack it reaches Redis as `redis:6379`; compose sets `REDIS_URL` to match. Everything else comes from `.env`.

The `mongo` service is in the `local-db` profile and only starts when named (`docker compose up -d mongo redis`, as in Quick start).

MongoDB and Redis are published on **127.0.0.1 only** (host-side dev tools and `npm run seed` work; the network cannot reach them). Redis requires `REDIS_PASSWORD`. MongoDB runs without authentication, so keep it off the network; for a managed setup point `DATABASE_URL` at MongoDB Atlas instead.

Production checklist:

* `CLIENT_URL` = your real frontend origin(s) (required in production; also used for reset links).
* `SMTP_*` + `EMAIL_FROM` for password-reset emails (any SMTP provider). Without them resets are not delivered.
* `TRUST_PROXY=1` when the API is behind a reverse proxy / load balancer, `0` when it is exposed directly.
* Redis is required in production: the API refuses to start, and `/api/v1/health/ready` reports 503, without it.
* The image has a `HEALTHCHECK` on `/api/v1/health/ready`.

MongoDB **must run as a replica set** (Prisma transactions, used for orders/stock, require it). The compose file does this for you. Without Docker, start `mongod --replSet rs0` and run `rs.initiate()`.

Scripts: `dev`, `build`, `start`, `typecheck`, `db:push`, `seed`, `test`, `test:unit`, `test:integration`.

## Seeded users (password `Password@123`)

| Email | Role in business 1 (Acme Apparel) | Other businesses |
|---|---|---|
| owner@shoplytics.dev | OWNER | owns all three |
| admin@shoplytics.dev | ADMIN | see seed output |
| manager@shoplytics.dev | MANAGER | see seed output |
| analyst@shoplytics.dev | ANALYST | see seed output |
| outsider@shoplytics.dev | no membership | used to prove tenant isolation (404) |

`npm run seed` prints the exact role table at the end. It is idempotent: it only removes and recreates its own demo data.

## Authorization (RBAC)

Roles are **per business** (a user can be OWNER of one business and ANALYST of another), stored in `BusinessMember`. The single source of truth is `src/constants/permissions.ts`; routes declare `authorize(P.SOMETHING)`.

| Capability | OWNER | ADMIN | MANAGER | ANALYST |
|---|:-:|:-:|:-:|:-:|
| Read business, dashboards, sales, revenue, inventory, products, customers, orders, reports, export | ✔ | ✔ | ✔ | ✔ |
| Create/update products, categories, customers; update stock; create/update orders; generate reports | ✔ | ✔ | ✔ | – |
| Delete products, categories, customers, reports; refund orders | ✔ | ✔ | – | – |
| Update business settings; list/manage members | ✔ | ✔ | – | – |
| Add/promote ADMINs, delete business | ✔ | – | – | – |

* Not a member of the business → **404** (existence is not leaked). Member without the permission → **403**.
* Every query is scoped by `businessId`; cross-tenant ids return 404.
* The OWNER role cannot be assigned, changed or removed through the API. An ADMIN cannot touch other ADMINs.
* Role changes apply on the next request (membership is read per request, never baked into the JWT).

## Authentication & sessions (Redis)

* **Access token**: 15-minute JWT (HS256) carrying `sub` + `sid`. Each request also checks `sess:{sid}` in Redis, so logout / "log out everywhere" / password change revoke access **immediately**.
* **Refresh token**: opaque, rotated on every use (atomic Lua compare-and-rotate). Re-using an old refresh token is treated as theft and kills the session. 1 day, or 30 days with `rememberMe`.
* If Redis is unavailable the API keeps running on an in-memory fallback (sessions, reset tokens, lockout, rate limits; per process, lost on restart) and logs a warning every 30s until Redis is back. Sessions created before the outage are not visible and must log in again.
* Password reset tokens: random, stored hashed in Redis, single-use, 1 hour. (Email delivery is a stub that logs the token in development: plug in a provider in `src/utils/email.ts`.)
* Login lockout: 5 failures (configurable) per IP+email → 429 with `Retry-After`.

## Rate limiting (Redis)

Atomic sliding-window counter (Lua script using Redis `TIME`, so it is correct across multiple API instances). Rejected requests are not counted. When Redis is unavailable the same algorithm runs in memory (per instance); individual Redis errors fail **open**. Standard `RateLimit-*` headers and `Retry-After` are returned.

| Tier | Limit | Key |
|---|---|---|
| global | 300 / min | IP |
| auth (login/register/reset) | 20 / 15 min | IP |
| forgot-password | 5 / hour | IP |
| refresh | 60 / 15 min | IP |
| authenticated API | 600 / min | user |
| analytics | 120 / min | user |
| report generate/export | 10 / min | user |

Set `TRUST_PROXY=1` behind a reverse proxy so the real client IP is used. `RATE_LIMIT_ENABLED=false` disables it.

## API (all under `/api/v1`)

* **Auth**: `POST /auth/register|login|refresh|forgot-password|reset-password|logout|logout-all`, `GET /auth/me|sessions`, `DELETE /auth/sessions/:sid`; `GET|PUT /users/me`, `PUT /users/me/password`
* **Businesses**: `GET|POST /businesses`, `GET|PUT|DELETE /businesses/:businessId`, `PUT /businesses/:businessId/default`
* Everything below is under `/businesses/:businessId`:
  * `members` (GET, POST, PUT /:userId, DELETE /:userId)
  * `categories`, `products`, `customers` (CRUD; products/customers detail include performance; `customers/analytics`)
  * `inventory` (GET, `/analytics`, `/low-stock`, `/movements`, `PUT /:productId`)
  * `orders` (GET, POST, GET/PUT `/:orderId`)
  * `dashboard` (`/`, `/revenue`, `/sales`, `/top-products`, `/order-status`)
  * `sales` and `revenue` (`/`, `/analytics`, `/trends`)
  * `reports` (`/types`, `POST /generate`, GET, `/:reportId`, `/:reportId/export?format=csv|pdf`, DELETE)

Responses: `{ success, message, data, pagination? }`; errors: `{ success:false, message, errors? }`. Date ranges use `preset=today|yesterday|last_7_days|last_30_days|...` or `from`/`to`, interpreted in the business time zone.

## Analytics definitions

* Eligible order: status not CANCELLED and payment not FAILED.
* Gross revenue = Σ item totals; net revenue = gross − discounts − refunds; AOV = net / eligible orders; growth = % vs the previous equal-length period (`null` when the baseline is 0).
* Inventory value = stock × cost price. Returning customer = more than one eligible order.
* Segments: INACTIVE (no purchase in 90 days / never), HIGH_VALUE (top 20% by lifetime spend, only when there are ≥ 5 buyers), otherwise REGULAR. Ranking uses all buyers, so a stale big spender can occupy a top-20% slot.
* Buckets use the business time zone; weeks start Monday. Dashboard queries are cached in Redis for 60s and invalidated whenever orders, products or stock change.

## Testing

```bash
npm test                  # unit + HTTP integration tests (needs `redis-server` on PATH, or REDIS_URL)
RUN_DB_TESTS=1 npm run test:integration   # adds the real-MongoDB tenant-isolation test
```

Unit tests cover the RBAC matrix, date ranges, CSV export, analytics maths, Redis sessions and the rate limiter against a real Redis. The HTTP integration test exercises every business route for every role (403 iff the matrix says so, 404 for non-members, 401 without/with revoked tokens, lockout, refresh rotation). It runs the real Express app with an **in-memory stand-in for Prisma**, so it proves routing/authorization/session behaviour but not Mongo queries.

## Known limitations

* The Prisma/MongoDB query paths and the seed script were type-checked but **not executed** in the build environment (no MongoDB available there). Run `npm run db:push && npm run seed` and the Postman collection against a real database as the first check.
* Analytics are aggregated in application code from streamed orders (cap 100k orders per query); move to Mongo aggregation pipelines if volumes outgrow that.
* Money is stored as floating-point numbers rounded to 2 decimals.
* A client should serialize refresh calls (refresh tokens are single-use).
