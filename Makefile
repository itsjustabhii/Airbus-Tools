# Makefile — Docker convenience targets for Airbus-Tools
#
# Usage:
#   make build          — build all three application images
#   make build-api      — build only the API image
#   make build-worker   — build only the worker image
#   make build-web      — build only the web image
#   make up             — start all services (detached)
#   make down           — stop and remove containers
#   make logs           — tail logs for all services
#   make ps             — show service status
#   make clean          — remove containers, volumes, and images

.PHONY: build build-api build-worker build-web up down logs ps clean \
        up-infra up-api up-worker

# ── Build targets ─────────────────────────────────────────────────────────────

build: build-api build-worker build-web

build-api:
	docker build \
	  --file apps/api/Dockerfile \
	  --target production \
	  --tag airbus-tools/api:latest \
	  .

build-worker:
	docker build \
	  --file apps/api/Dockerfile.worker \
	  --target production \
	  --tag airbus-tools/worker:latest \
	  .

build-web:
	docker build \
	  --file apps/web/Dockerfile \
	  --target production \
	  --tag airbus-tools/web:latest \
	  --build-arg VITE_API_BASE_URL=$${VITE_API_BASE_URL:-http://localhost:3000/api/v1} \
	  --build-arg VITE_APP_NAME=$${VITE_APP_NAME:-Airbus-Tools} \
	  .

# ── Compose targets ───────────────────────────────────────────────────────────

## Start all services
up:
	docker compose up --build --detach

## Start only infrastructure (MongoDB + Redis)
up-infra:
	docker compose up --detach mongodb redis

## Start API independently (+ infrastructure)
up-api:
	docker compose up --build --detach mongodb redis api

## Start worker independently (+ infrastructure)
up-worker:
	docker compose up --build --detach mongodb redis worker

down:
	docker compose down

logs:
	docker compose logs --follow

ps:
	docker compose ps

## Remove everything including volumes and images
clean:
	docker compose down --volumes --remove-orphans
	docker image rm -f airbus-tools/api:latest airbus-tools/worker:latest airbus-tools/web:latest 2>/dev/null || true
