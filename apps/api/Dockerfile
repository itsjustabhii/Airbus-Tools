# ── Stage 1: install all (dev + prod) dependencies ──────────────────────────
FROM node:20-alpine AS deps
WORKDIR /app

# Copy workspace manifests only — cache invalidated only on lock-file changes
COPY package.json package-lock.json ./
COPY apps/api/package.json           ./apps/api/
COPY packages/shared/package.json    ./packages/shared/
COPY packages/validation/package.json ./packages/validation/
COPY packages/config/package.json    ./packages/config/

RUN npm ci \
      --workspace=apps/api \
      --workspace=packages/shared \
      --workspace=packages/validation \
      --workspace=packages/config

# ── Stage 2: build shared packages then the API ──────────────────────────────
FROM deps AS build

COPY tsconfig.base.json ./
COPY packages/ ./packages/
COPY apps/api/  ./apps/api/

# Build shared packages as CommonJS so the API (CJS runtime) can require() them.
# tsc --module CommonJS overrides the base tsconfig.base.json ESNext setting.
RUN npx tsc --project packages/shared/tsconfig.json --module CommonJS --moduleResolution node && \
    npx tsc --project packages/validation/tsconfig.json --module CommonJS --moduleResolution node && \
    npx tsc --project packages/config/tsconfig.json --module CommonJS --moduleResolution node && \
    npm run build --workspace=apps/api

# ── Stage 3: production-only dependencies (no devDependencies) ────────────────
FROM node:20-alpine AS prod-deps
WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/api/package.json           ./apps/api/
COPY packages/shared/package.json    ./packages/shared/
COPY packages/validation/package.json ./packages/validation/
COPY packages/config/package.json    ./packages/config/

# npm workspaces hoists everything to the root node_modules — no per-package dirs
RUN npm ci \
      --workspace=apps/api \
      --workspace=packages/shared \
      --workspace=packages/validation \
      --workspace=packages/config \
      --omit=dev

# ── Stage 4: lean production image ───────────────────────────────────────────
FROM node:20-alpine AS production

# Security: run as non-root
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

WORKDIR /app

# Production node_modules (hoisted to root by npm workspaces)
COPY --from=prod-deps --chown=appuser:appgroup /app/node_modules ./node_modules

# Package manifests (required for workspace symlink resolution at runtime)
COPY --chown=appuser:appgroup package.json package-lock.json ./
COPY --chown=appuser:appgroup apps/api/package.json           ./apps/api/
COPY --chown=appuser:appgroup packages/shared/package.json    ./packages/shared/
COPY --chown=appuser:appgroup packages/validation/package.json ./packages/validation/
COPY --chown=appuser:appgroup packages/config/package.json    ./packages/config/

# Compiled output only — no TypeScript source, no test files
COPY --from=build --chown=appuser:appgroup /app/apps/api/dist              ./apps/api/dist
COPY --from=build --chown=appuser:appgroup /app/packages/shared/dist       ./packages/shared/dist
COPY --from=build --chown=appuser:appgroup /app/packages/validation/dist   ./packages/validation/dist
COPY --from=build --chown=appuser:appgroup /app/packages/config/dist       ./packages/config/dist

# Environment-driven configuration defaults (overridable at runtime)
ENV NODE_ENV=production \
    PORT=3000 \
    HOST=0.0.0.0

USER appuser

EXPOSE 3000

# Health check — hits the /health endpoint exposed by healthRouter.
# Use 127.0.0.1 explicitly; alpine wget prefers IPv6 (::1) for "localhost"
# which fails when the server listens only on 0.0.0.0 (IPv4).
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:3000/health || exit 1

# Graceful shutdown is handled in src/server.ts via SIGTERM/SIGINT handlers.
# Docker sends SIGTERM on `docker stop`; node propagates it correctly.
CMD ["node", "apps/api/dist/server.js"]
