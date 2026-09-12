# Airbus-Tools: System Architecture

## Overview

Airbus-Tools is a B2B marketplace platform built as an npm workspace monorepo. The platform enables aerospace industry buyers and sellers to discover, negotiate, and transact on parts, services, and tooling contracts.

---

## Repository Structure

```
Airbus-Tools/
├── apps/
│   ├── api/          # Node.js + Express HTTP API
│   └── web/          # React + Vite SPA
├── packages/
│   ├── shared/       # Shared TypeScript types, enums, interfaces
│   ├── validation/   # Zod schemas and validation helpers
│   └── config/       # Environment variable schemas and constants
├── infrastructure/   # Infrastructure-as-code and deployment blueprints
└── docs/             # Architecture and standards documentation
```

---

## Layer Boundaries

```
┌─────────────────────────────────────────────────────┐
│                     React SPA (apps/web)             │
│  Pages → Components → Hooks → API Client             │
└───────────────────────┬─────────────────────────────┘
                        │ HTTPS / REST
┌───────────────────────▼─────────────────────────────┐
│                  Express API (apps/api)               │
│  Routes → Middlewares → Controllers → Services        │
│              ↓                   ↓                    │
│         Repositories         BullMQ Workers           │
│              ↓                   ↓                    │
│           MongoDB             Redis / BullMQ          │
└─────────────────────────────────────────────────────┘
```

---

## Apps

### `apps/api` — REST API

- **Framework**: Express 4 + TypeScript
- **Pattern**: Routes → Controller → Service → Repository → Model
- **Error handling**: Centralized `errorHandler` middleware converts `AppError` and `ZodError` to standardized JSON responses
- **Response format**:
  - Success: `{ success: true, data: T, meta?: ApiMeta }`
  - Error: `{ success: false, error: { code, message, details? } }`
- **Logging**: Pino structured logger with request ID propagation
- **Config**: Zod-validated environment variables, fail-fast on startup

### `apps/web` — React SPA

- **Build tool**: Vite 5
- **Routing**: React Router v6
- **Data fetching**: TanStack Query v5
- **Styling**: Tailwind CSS v3
- **Forms**: React Hook Form + Zod

---

## Shared Packages

| Package | Purpose |
|---------|---------|
| `@airbus-tools/shared` | TypeScript interfaces, enums (UserRole, OrderStatus), API response types |
| `@airbus-tools/validation` | Zod schemas for reusable validation primitives |
| `@airbus-tools/config` | Environment variable base schema, `validateEnv` utility |

---

## Local Development Stack

Services are managed via Docker Compose:

| Service | Port | Purpose |
|---------|------|---------|
| MongoDB | 27017 | Primary document store |
| Redis | 6379 | Cache, queues (BullMQ), sessions |

Start all services:
```bash
docker compose up -d
```

---

## Security Principles

- All API endpoints validate input with Zod before processing
- Helmet sets security headers on every response
- CORS is configured with an explicit allowlist
- Environment variables are validated at startup — no silent defaults for secrets
- Request IDs are propagated for distributed tracing

---

## Coding Conventions

- `noImplicitAny`, `strict`, `noUncheckedIndexedAccess` enforced across all packages
- ESLint `@typescript-eslint/recommended` + `import/order` rules
- Prettier for consistent formatting
- All exports from packages go through `src/index.ts`
