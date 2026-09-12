# Airbus-Tools

> B2B Marketplace Platform — Monorepo Bootstrap (Phase 0)

## Repository Structure

```
Airbus-Tools/
├── apps/
│   ├── api/          # Node.js + Express REST API (TypeScript)
│   └── web/          # React + Vite SPA (TypeScript + Tailwind CSS)
├── packages/
│   ├── shared/       # Shared TypeScript types, enums, interfaces
│   ├── validation/   # Shared Zod schemas and validation helpers
│   └── config/       # Shared environment variable schemas and constants
├── docs/
│   ├── architecture.md
│   ├── api-standards.md
│   └── phase-breakdown.md
├── infrastructure/   # Deployment blueprints (Phase 7+)
├── docker-compose.yml
├── tsconfig.base.json
└── .eslintrc.cjs
```

## Prerequisites

- **Node.js** ≥ 20
- **npm** ≥ 10
- **Docker** (for local MongoDB + Redis)

## Getting Started

```bash
# Install all workspace dependencies
npm install

# Start local services (MongoDB + Redis)
docker compose up -d

# Copy environment files
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env

# Start the API dev server
npm run dev --workspace=apps/api

# Start the web dev server
npm run dev --workspace=apps/web
```

The web app runs on [http://localhost:5173](http://localhost:5173).  
The API runs on [http://localhost:3000](http://localhost:3000).

## Available Scripts

Run from the monorepo root:

| Command | Description |
|---------|-------------|
| `npm run build` | Build all packages and apps |
| `npm run typecheck` | TypeScript typecheck across all workspaces |
| `npm run lint` | ESLint across the entire repo |
| `npm run lint:fix` | ESLint with auto-fix |
| `npm run format` | Prettier format all files |
| `npm run format:check` | Prettier format check |
| `npm test` | Run all tests |
| `npm run clean` | Remove all `dist/` and `node_modules/` |

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Monorepo | npm workspaces |
| Language | TypeScript 5 (strict mode) |
| Frontend | React 18, Vite 5, Tailwind CSS 3, TanStack Query 5, React Router 6 |
| Backend | Node.js 20, Express 4, Pino logger |
| Validation | Zod 3 |
| Testing | Vitest 2, Supertest, React Testing Library |
| Linting | ESLint 8 + @typescript-eslint |
| Formatting | Prettier 3 |
| Local infra | Docker Compose (MongoDB 7, Redis 7.2) |

## API Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /health` | Liveness probe |
| `GET /ready` | Readiness probe |

See [docs/api-standards.md](docs/api-standards.md) for full API conventions.

## Documentation

- [Architecture](docs/architecture.md) — system design and layer boundaries
- [API Standards](docs/api-standards.md) — response envelopes, error codes, conventions
- [Phase Breakdown](docs/phase-breakdown.md) — multi-phase delivery roadmap

## Development Phases

| Phase | Status | Description |
|-------|--------|-------------|
| 0 | ✅ **Done** | Repository bootstrap, monorepo, tooling |
| 1 | ⏳ Pending | Identity & Access Management |
| 2 | ⏳ Pending | Product Catalogue |
| 3 | ⏳ Pending | Order & Transaction Flow |
| 4 | ⏳ Pending | Messaging & Notifications |
| 5 | ⏳ Pending | Payments & Settlement |
| 6 | ⏳ Pending | Admin & Moderation |
| 7 | ⏳ Pending | Observability & Production Hardening |
