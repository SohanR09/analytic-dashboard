# ---- build: install all deps, generate Prisma client, compile TypeScript ----
FROM node:22-slim AS build
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci

COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# ---- migrate: one-off job that syncs collections + indexes (unique constraints!) with prisma/schema.prisma ----
# Keeps the dev dependencies (Prisma CLI). Used by the `migrate` service in docker-compose.yml:
#   docker compose run --rm migrate
FROM build AS migrate
USER node
CMD ["npx", "prisma", "db", "push", "--skip-generate"]

# ---- prod-deps: production node_modules only (the generated Prisma client is kept) ----
FROM build AS prod-deps
RUN npm prune --omit=dev

# ---- runtime: production deps + compiled output only (default target) ----
FROM node:22-slim AS runtime
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production

COPY --from=prod-deps /app/package.json ./
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/dist ./dist

USER node
EXPOSE 5000
# Readiness = MongoDB (and Redis, required in production) reachable. The slim image has no curl, so use node's fetch.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:' + (process.env.PORT || 5000) + '/api/v1/health/ready').then(r => process.exit(r.ok ? 0 : 1), () => process.exit(1))"]
CMD ["node", "dist/server.js"]
