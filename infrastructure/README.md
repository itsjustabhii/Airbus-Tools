# Infrastructure

## Local Development

Local services are managed with Docker Compose. See the root `docker-compose.yml`.

```bash
# Start MongoDB and Redis
docker compose up -d

# Stop services
docker compose down

# Remove volumes (clean slate)
docker compose down -v
```

## Services

| Service | Image | Port | Purpose |
|---------|-------|------|---------|
| MongoDB | `mongo:7.0` | 27017 | Primary document store |
| Redis | `redis:7.2-alpine` | 6379 | Cache, queues, session store |

## Production (Phase 7+)

Production deployment blueprints (Kubernetes, Helm, Terraform) will be added in Phase 7.
