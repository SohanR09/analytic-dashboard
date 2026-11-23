# Shoplytics

Shoplytics is an analytics dashboard for e-commerce businesses. One user can belong to several businesses and have a different role in each. Each business can track sales, revenue, inventory, products, customers and orders, and generate reports to export as CSV or PDF.

This repository holds two applications:

| Folder | What it is | Stack |
|---|---|---|
| [`shoplytics-backend/`](shoplytics-backend) | REST API (`/api/v1`) | Node.js, Express, TypeScript, Prisma ORM, MongoDB, Redis |
| [`shoplytics-frontend/`](shoplytics-frontend) | Single-page web app | React 18, TypeScript, Vite, Redux Toolkit, React Router, Tailwind CSS, D3.js |

Each folder has its own README with the full details:

- [Backend README](shoplytics-backend/README.md): setup, Docker, roles and permissions, sessions, rate limiting, API routes, analytics definitions, tests
- [Frontend README](shoplytics-frontend/README.md): setup, pages, code layout, how sessions and permissions work in the UI

The product requirements are in [`shoplytics-backend/docs/REQUIREMENTS.md`](shoplytics-backend/docs/REQUIREMENTS.md). A Postman collection and environment are in [`shoplytics-backend/postman/`](shoplytics-backend/postman).

## Architecture

```
Browser (React SPA, :5173)
        │  HTTPS / JSON, JWT access token
        ▼
Express API (:5000/api/v1)
  routes → middleware (authenticate · rate limit · business context · authorize · validate)
         → controllers → services → Prisma
        │                              │
        ▼                              ▼
     Redis 7                      MongoDB 7 (replica set rs0)
  sessions, refresh tokens,       users, businesses, members,
  rate limits, lockout,           products, customers, orders,
  dashboard cache (60s)           inventory, reports
```

## Requirements

- Node.js 18 or newer
- Docker (the easiest way to run MongoDB and Redis)
- If you don't use Docker: MongoDB 7 started as a replica set (`mongod --replSet rs0`, then `rs.initiate()`) and Redis 7

## Quick start (local development)

Start the backend first.

```bash
# 1. Backend
cd shoplytics-backend
cp .env.example .env                # set JWT_ACCESS_SECRET (at least 32 characters)
docker compose up -d mongo redis    # MongoDB + Redis
npm install                         # also runs `prisma generate`
npm run db:push                     # create collections and indexes
npm run seed                        # demo users, 3 businesses, about 4 months of orders
npm run dev                         # http://localhost:5000/api/v1

# 2. Frontend (in a second terminal)
cd shoplytics-frontend
cp .env.example .env.local          # VITE_API_URL=http://localhost:5000/api/v1
npm install
npm run dev                         # http://localhost:5173
```

The backend allows `http://localhost:5173` by default (`CLIENT_URL`), so you don't need to change any CORS settings.

To run the whole backend (MongoDB, Redis, migration and API) in Docker, see [Run everything in Docker](shoplytics-backend/README.md#run-everything-in-docker) and the production checklist in the backend README.

## Demo accounts

Every seeded user has the password `Password@123`.

| Email | Role in Acme Apparel |
|---|---|
| owner@shoplytics.dev | OWNER (owns all three businesses) |
| admin@shoplytics.dev | ADMIN |
| manager@shoplytics.dev | MANAGER |
| analyst@shoplytics.dev | ANALYST (read-only) |
| outsider@shoplytics.dev | No membership (used to test that businesses stay isolated) |

`npm run seed` prints the full role table when it finishes. You can run it again safely: it only replaces its own demo data.

## Features

- **Multiple businesses:** switch between businesses. Every query is limited to the current business, and a business you don't belong to returns 404.
- **Roles per business:** OWNER, ADMIN, MANAGER and ANALYST. The API checks every permission. The UI hides actions you aren't allowed to take.
- **Dashboard:** 6 stat cards, revenue, sales and category charts, top products, order status and recent orders.
- **Sales and revenue analytics:** filter by category, product or status, and compare growth with the previous period.
- **Inventory:** stock levels, low-stock alerts, stock movement log and stock updates.
- **Catalog:** products and categories, with performance for each product.
- **Customers:** segments (high value, regular, inactive), customer growth and order history.
- **Orders:** create orders, move them through statuses, cancel and refund.
- **Reports:** generate any report type, view it in the app and export it as CSV or PDF.
- **Team and settings:** manage members and roles, edit the business profile and categories.
- **Accounts:** register, log in with "remember me", reset a password, see active sessions and log out everywhere.

## Roles and permissions

| Capability | OWNER | ADMIN | MANAGER | ANALYST |
|---|:-:|:-:|:-:|:-:|
| View dashboards, analytics, products, customers, orders, reports; export | ✔ | ✔ | ✔ | ✔ |
| Create and edit products, categories, customers, orders, stock; generate reports | ✔ | ✔ | ✔ | – |
| Delete records; refund orders | ✔ | ✔ | – | – |
| Edit business settings; manage members | ✔ | ✔ | – | – |
| Add or promote ADMINs; delete the business | ✔ | – | – | – |

The backend defines these rules in one place: `shoplytics-backend/src/constants/permissions.ts`. Role changes apply from the user's next request.

## Security

- **Access tokens** are JWTs that last 15 minutes. The frontend keeps them in memory only. Each request also checks the session in Redis, so logging out or changing a password takes effect immediately.
- **Refresh tokens** change every time they are used. Reusing an old refresh token ends the session. They last 1 day, or 30 days with "remember me".
- **Login lockout:** 5 failed attempts for the same IP address and email block further attempts for a while (HTTP 429).
- **Rate limits** use a sliding window stored in Redis, with separate limits for login, analytics and report endpoints.

## Scripts

| | Backend | Frontend |
|---|---|---|
| Development server | `npm run dev` | `npm run dev` |
| Production build | `npm run build`, then `npm start` | `npm run build`, then `npm run preview` |
| Type check | `npm run typecheck` | `npm run typecheck` |
| Tests | `npm test` (needs `redis-server` on PATH or `REDIS_URL`) | `npm test` |
| Database | `npm run db:push`, `npm run seed` | – |

## Project status and known limitations

- The backend's MongoDB queries and the seed script pass the type checker but have **not yet been run against a real database**. The frontend has been tested against a mock API, not the real backend. As a first check, run `npm run db:push && npm run seed`, then go through the Postman collection and each page of the app.
- Password-reset emails are not sent yet. In development the reset token is written to the backend log until you configure an SMTP provider (`SMTP_*`, `EMAIL_FROM`).
- Analytics are calculated in application code, up to 100,000 orders per query. Larger volumes will need MongoDB aggregation pipelines.
- Money is stored as floating-point numbers rounded to 2 decimals.
- Notifications only cover low stock.

The backend and frontend READMEs list the full limitations.
