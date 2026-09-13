# ── Stage 1: install all (dev + prod) dependencies ──────────────────────────
FROM node:20-alpine AS deps
WORKDIR /app

# Copy workspace manifests — cache invalidated only on dependency changes
COPY package.json package-lock.json ./
COPY apps/web/package.json       ./apps/web/
COPY packages/shared/package.json ./packages/shared/

RUN npm ci \
      --workspace=apps/web \
      --workspace=packages/shared

# ── Stage 2: build ────────────────────────────────────────────────────────────
FROM deps AS build

COPY tsconfig.base.json ./
COPY packages/shared/ ./packages/shared/

# Build shared package first (web only depends on @airbus-tools/shared)
RUN npm run build --workspace=packages/shared

COPY apps/web/ ./apps/web/

# VITE_* variables are baked into the static bundle at build time.
# Pass them via --build-arg in CI; for local dev docker-compose injects them.
ARG VITE_API_BASE_URL=http://localhost:3000/api/v1
ARG VITE_APP_NAME=Airbus-Tools
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL} \
    VITE_APP_NAME=${VITE_APP_NAME}

RUN npm run build --workspace=apps/web

# ── Stage 3: minimal nginx production image ───────────────────────────────────
FROM nginx:1.27-alpine AS production

# Security: drop to non-root nginx user (nginx:alpine ships with user 'nginx')
# nginx master process must start as root to bind port 80, but worker processes
# run as the 'nginx' user defined in nginx.conf (default in official image).
# We override the default config only — the nginx base runs workers as non-root.

# Remove default nginx content
RUN rm -rf /usr/share/nginx/html/*

# Copy built assets
COPY --from=build /app/apps/web/dist /usr/share/nginx/html

# Copy application nginx config
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf

# Ensure nginx can write its temp/cache directories as the nginx user
RUN chown -R nginx:nginx /var/cache/nginx /var/log/nginx /etc/nginx/conf.d && \
    touch /var/run/nginx.pid && chown nginx:nginx /var/run/nginx.pid

EXPOSE 80

# Health check — verify nginx serves at least a 200/301 on /.
# Use 127.0.0.1 explicitly; alpine wget prefers IPv6 for "localhost".
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:80/ || exit 1

# nginx sends SIGQUIT for graceful shutdown, SIGTERM for fast shutdown.
# The official CMD uses SIGTERM; nginx drains connections within the
# worker_shutdown_timeout (default 10 s) before exiting.
CMD ["nginx", "-g", "daemon off;"]
