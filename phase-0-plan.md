# Airbus-Tools: Phase 0 Architecture & Repository Bootstrap Plan

## Top-Level Overview
Establish the foundational monorepo structure, TypeScript compilation pipeline, code formatting/linting rules, test harnesses, Docker containerization, local development stack (MongoDB, Redis), and base architecture scaffolding for the "Airbus-Tools" B2B marketplace platform without implementing business features.

The monorepo uses native `npm` workspaces.

---

## Architecture Blueprint

```
Airbus-Tools/
├── package.json                      # Root workspace configuration and scripts
├── package-lock.json
├── tsconfig.base.json                # Shared strict TypeScript base config
├── .eslintrc.cjs / eslint.config.js  # Base ESLint configuration
├── .prettierrc                       # Shared Prettier formatting rules
├── .gitignore                        # Git ignore patterns
├── .editorconfig
├── docker-compose.yml                # Local services: MongoDB, Redis
├── .env.example                      # Root/shared environment variable template
│
├── apps/
│   ├── web/                          # Frontend SPA
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── vite.config.ts
│   │   ├── tailwind.config.js
│   │   ├── postcss.config.js
│   │   ├── index.html
│   │   ├── Dockerfile
│   │   ├── .env.example
│   │   └── src/
│   │       ├── main.tsx
│   │       ├── App.tsx
│   │       └── index.css
│   │
│   └── api/                          # Backend HTTP API & Worker entry
│       ├── package.json
│       ├── tsconfig.json
│       ├── Dockerfile
│       ├── Dockerfile.worker
│       ├── .env.example
│       └── src/
│           ├── app.ts                # Express app setup (middleware, routes, error handler)
│           ├── server.ts             # HTTP + Socket.io server entry point
│           ├── worker.ts             # BullMQ background worker bootstrap
│           ├── config/               # Environment variable validation & config module
│           ├── core/                 # Centralized errors, response helpers, logger, requestId
│           ├── middlewares/          # Global error handler, request logger, helmet, cors
│           └── routes/               # Health and readiness check routes
│
├── packages/
│   ├── shared/                       # Shared TypeScript types, enums, interfaces, constants
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── src/
│   │       ├── index.ts
│   │       ├── types/
│   │       └── constants/
│   │
│   ├── validation/                   # Shared Zod schemas (request/response validation)
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── src/
│   │       └── index.ts
│   │
│   └── config/                       # Common configuration utilities
│       ├── package.json
│       ├── tsconfig.json
│       └── src/
│           └── index.ts
│
├── infrastructure/
│   └── README.md                     # Infrastructure architecture and deployment blueprints
│
├── docs/
│   ├── architecture.md               # System architecture and data flow documentation
│   ├── phase-breakdown.md            # Multi-phase project delivery roadmap
│   └── api-standards.md              # Centralized error, response, and routing standards
│
└── .github/
    └── workflows/
        └── ci.yml                    # GitHub Actions CI for lint, typecheck, unit test
```

---

## Sub-Tasks

### Sub-Task 1: Monorepo Root & Tooling Setup
- **Intent**: Initialize the root workspace structure with npm workspaces, strict TypeScript base configuration, ESLint, Prettier, `.gitignore`, and unified root scripts.
- **Expected Outcomes**:
  - `package.json` with workspace configuration pointing to `apps/*` and `packages/*`.
  - `tsconfig.base.json` with `strict: true`, modern module resolution, and clean path mappings.
  - Consistent linting and formatting across the monorepo via npm run commands.
- **Todo List**:
  1. Create root `package.json` with workspace definitions and standard scripts (`build`, `lint`, `typecheck`, `test`, `dev`).
  2. Create `tsconfig.base.json` configured for strict TypeScript.
  3. Create `.prettierrc`, `.prettierignore`, `.eslintrc.cjs`, `.editorconfig`, and root `.gitignore`.
- **Status**: `[ ] pending`

---

### Sub-Task 2: Packages Scaffolding (`packages/shared`, `packages/validation`, `packages/config`)
- **Intent**: Provide shared modules for TypeScript interfaces/enums (User roles, Order status, etc.), Zod schemas, and runtime configurations shared across apps.
- **Expected Outcomes**:
  - `packages/shared` compiles and exports core types (User, Product, Order, Chat message types/enums).
  - `packages/validation` compiles and exports base validation utilities with Zod.
  - `packages/config` compiles and exports shared constants/environment schemas.
- **Todo List**:
  1. Initialize `packages/shared` with `package.json`, `tsconfig.json`, and initial enum definitions (e.g., `UserRole`, `OrderStatus`).
  2. Initialize `packages/validation` with `package.json`, `tsconfig.json`, and base Zod validator helpers.
  3. Initialize `packages/config` with `package.json`, `tsconfig.json`, and base environment schema.
- **Status**: `[ ] pending`

---

### Sub-Task 3: Backend API Architecture Scaffolding (`apps/api`)
- **Intent**: Bootstrap the Node.js/Express/TypeScript backend adhering to clean layered architecture (Routes -> Controllers -> Services -> Repositories -> Models), standard response formats, centralized error handling, structured logging, request IDs, and health check endpoints.
- **Expected Outcomes**:
  - `apps/api` compiles and starts with `/health` and `/ready` endpoints.
  - Centralized error handler returning RFC-compliant or standardized JSON errors `{ success: false, error: { code, message, details } }`.
  - Standard response wrapper utility `{ success: true, data, meta }`.
  - Structured logger (Pino or Winston) with request ID middleware (UUIDv4).
  - Worker entrypoint stub for BullMQ.
  - Unit test setup (Vitest/Jest + Supertest) verifying the health endpoint.
  - Dockerfiles (`Dockerfile` for API and `Dockerfile.worker` for BullMQ workers).
- **Todo List**:
  1. Create `apps/api/package.json` with dependencies (`express`, `helmet`, `cors`, `zod`, `pino`, `uuid`, etc.).
  2. Configure `apps/api/tsconfig.json` extending `tsconfig.base.json`.
  3. Implement configuration loader using Zod (`src/config/env.ts`).
  4. Implement structured logger and request ID middleware (`src/core/logger.ts`, `src/middlewares/requestId.ts`).
  5. Implement standardized error classes and centralized error handling middleware (`src/core/errors/`, `src/middlewares/errorHandler.ts`).
  6. Implement standardized API response helpers (`src/core/response.ts`).
  7. Implement `/health` and `/ready` route & controller.
  8. Create `src/app.ts`, `src/server.ts`, and `src/worker.ts`.
  9. Add `apps/api/.env.example`.
  10. Create `apps/api/Dockerfile` and `apps/api/Dockerfile.worker`.
  11. Add unit/integration test for health checks using Vitest/Supertest.
- **Status**: `[ ] pending`

---

### Sub-Task 4: Frontend Web App Bootstrap (`apps/web`)
- **Intent**: Bootstrap the client SPA using React, Vite, TypeScript, Tailwind CSS, TanStack Query, and React Router.
- **Expected Outcomes**:
  - Vite dev server runs cleanly.
  - Tailwind CSS configured and functional.
  - React Router configuration in place with basic public layout / 404 handler.
  - TanStack Query client provider configured.
  - `apps/web/Dockerfile` and `apps/web/.env.example` created.
  - Unit test harness configured with Vitest + React Testing Library.
- **Todo List**:
  1. Create `apps/web/package.json` with React 18+, Vite, Tailwind CSS, TanStack Query, React Router, React Hook Form, Zod.
  2. Configure `vite.config.ts`, `tailwind.config.js`, `postcss.config.js`, `tsconfig.json`.
  3. Create `index.html`, `src/main.tsx`, `src/App.tsx`, and standard styling `src/index.css`.
  4. Setup base routes and query client provider.
  5. Add `apps/web/Dockerfile` and `apps/web/.env.example`.
  6. Add sample smoke test with Vitest.
- **Status**: `[ ] pending`

---

### Sub-Task 5: Local Infrastructure & CI Workflow Setup
- **Intent**: Provide local container orchestration for developer environment (MongoDB, Redis) and automated CI pipeline.
- **Expected Outcomes**:
  - `docker-compose.yml` configures MongoDB with healthcheck and Redis with persistence.
  - `.github/workflows/ci.yml` runs typechecking, linting, and automated tests across the workspace on push/pull request.
  - Architectural documentation in `docs/` describing layer boundaries, security standards, and upcoming phases.
- **Todo List**:
  1. Create `docker-compose.yml` with MongoDB 7.0 and Redis 7.2.
  2. Create `.github/workflows/ci.yml`.
  3. Write `docs/architecture.md`, `docs/phase-breakdown.md`, and `docs/api-standards.md`.
- **Status**: `[ ] pending`
