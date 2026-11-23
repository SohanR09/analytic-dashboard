# Shoplytics Frontend

React + TypeScript single-page app for the Shoplytics API (see the backend repo, `docs/REQUIREMENTS.md`).

**Stack (per spec §3.1):** React 18, TypeScript, Vite, Redux Toolkit, React Router, Tailwind CSS, D3.js (charts), Anime.js (count-up animation), Axios, React Hook Form + Zod.

## Run it

```bash
cp .env.example .env.local     # VITE_API_URL=http://localhost:5000/api/v1
npm install
npm run dev                    # http://localhost:5173
```

Start the backend first (`docker compose up -d && npm run seed && npm run dev` there). The backend's `CLIENT_URL` already defaults to `http://localhost:5173`, so CORS works out of the box. Log in with a seeded user, e.g. `owner@shoplytics.dev` / `Password@123`.

Scripts: `dev`, `build` (type-check + production build), `preview`, `typecheck`, `test`.

## What's in it

| Route | Page |
|---|---|
| `/` | Landing page (hero, features, benefits, preview, CTA) |
| `/login`, `/register`, `/forgot-password`, `/reset-password` | Auth (remember me, validation, reset flow) |
| `/businesses` | Business cards: search, add, edit, delete, set default |
| `/businesses/:id/dashboard` | Overview: 6 stat cards, revenue / sales / category charts, top products, order status, recent orders |
| `.../sales`, `.../revenue` | Analytics with category / product / status filters and growth vs previous period |
| `.../inventory` | Stock KPIs and charts, stock table, movement log, stock update dialog |
| `.../products`, `.../products/:id` | Catalog CRUD, product performance |
| `.../customers`, `.../customers/:id` | Segments, growth, scatter plot, customer profile and history |
| `.../orders`, `.../orders/:id` | Filters, create order, status progression, cancel, refund, timeline |
| `.../reports` | Generate any report type, view in-app, export CSV / PDF |
| `.../team`, `.../settings` | Members and roles; business profile, categories, danger zone |
| `/profile` | Profile, password, active sessions, log out everywhere |

Charts (D3): line, area, bar, stacked bar, horizontal bar, donut, pie, scatter, each with hover tooltips, legends, axis labels, responsive resizing, loading and empty states.

## How it fits together

```
src/
  services/    api.ts (Axios, token refresh)  auth / business / analytics / resources services
  store/       Redux slices: auth, business (active business), dashboard, filters (global date + filters)
  components/  common (ui kit, StatCard, filters)  layout (shell, switcher, notifications)  charts (D3)
  pages/       one folder per module
  routes/      route table + guards
  hooks/       useFetch, useBusiness, useAnimatedNumber, useDebounce
```

* **Sessions:** the access token lives in memory only; the refresh token is stored in `localStorage` with "Remember me", otherwise `sessionStorage`. On a 401 the client refreshes once (concurrent requests share a single in-flight refresh, because the backend's refresh tokens are single-use) and retries. If the session was revoked or refresh fails, the app clears state and returns to login.
* **Authorization:** the business endpoint returns the caller's role and permission list. Menus, buttons and routes are hidden when a permission is missing (e.g. Analysts see no create/edit/delete, only Owners/Admins see Team and refunds). This is only a convenience: the API enforces every permission and the UI shows its error messages.
* **Multi-business:** switching business reloads data under the new id; a non-member id shows "doesn't exist or you don't have access" (the API answers 404).
* **Date filter:** the top bar filter (presets or a custom range) is global Redux state used by dashboard, sales, revenue, customers and reports.
* **Notifications:** the bell lists products at or below their minimum stock.
* **Theme:** colours are CSS variables in `src/index.css` (spec §5.5) mapped into Tailwind, so the palette is changed in one place.

## Verification status

Type-check, production build and unit tests (formatters, filter slice, validation schemas) pass. The UI was also exercised in a real browser (Chromium) against a **mock API** with the backend's response shapes: login, validation errors, route guards, every page, key modals, an Analyst-role run (write actions hidden) and a 390px mobile layout. It has **not** been run against the real backend and MongoDB (not available in the build environment), so check each page once against your seeded data, and report any mismatch in a response shape.

## Known limitations

* Notifications are derived from low-stock data only (the backend has no notification feed).
* "Forgot password" depends on the backend's email provider, which is still a stub that logs the token.
* Charts render as SVG without virtualisation; very long ranges at daily granularity (hundreds of points) are readable but dense.
