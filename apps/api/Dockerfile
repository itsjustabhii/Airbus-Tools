FROM node:20-alpine AS base
WORKDIR /app

# Install dependencies
FROM base AS deps
COPY package*.json ./
COPY apps/api/package*.json ./apps/api/
COPY packages/shared/package*.json ./packages/shared/
COPY packages/validation/package*.json ./packages/validation/
COPY packages/config/package*.json ./packages/config/
RUN npm ci --workspace=apps/api --workspace=packages/shared --workspace=packages/validation --workspace=packages/config

# Build shared packages first
FROM deps AS build-packages
COPY tsconfig.base.json ./
COPY packages/ ./packages/
RUN npm run build --workspace=packages/shared
RUN npm run build --workspace=packages/validation
RUN npm run build --workspace=packages/config

# Build API
FROM build-packages AS build-api
COPY apps/api/ ./apps/api/
RUN npm run build --workspace=apps/api

# Production image
FROM node:20-alpine AS production
WORKDIR /app
ENV NODE_ENV=production

COPY package*.json ./
COPY apps/api/package*.json ./apps/api/
COPY packages/shared/package*.json ./packages/shared/
COPY packages/validation/package*.json ./packages/validation/
COPY packages/config/package*.json ./packages/config/
RUN npm ci --workspace=apps/api --workspace=packages/shared --workspace=packages/validation --workspace=packages/config --omit=dev

COPY --from=build-packages /app/packages/shared/dist ./packages/shared/dist
COPY --from=build-packages /app/packages/validation/dist ./packages/validation/dist
COPY --from=build-packages /app/packages/config/dist ./packages/config/dist
COPY --from=build-api /app/apps/api/dist ./apps/api/dist

EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

CMD ["node", "apps/api/dist/server.js"]
