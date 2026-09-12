# API Standards

## Response Envelope

All API responses follow a consistent envelope format.

### Success Response

```json
{
  "success": true,
  "data": { ... },
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 100,
    "totalPages": 5
  }
}
```

### Error Response

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed",
    "details": [
      { "path": "email", "message": "Invalid email address" }
    ]
  }
}
```

---

## Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `VALIDATION_ERROR` | 422 | Input failed Zod schema validation |
| `NOT_FOUND` | 404 | Requested resource does not exist |
| `UNAUTHORIZED` | 401 | Missing or invalid authentication |
| `FORBIDDEN` | 403 | Authenticated but not authorized |
| `CONFLICT` | 409 | Resource state conflict (e.g. duplicate) |
| `RATE_LIMIT_EXCEEDED` | 429 | Too many requests |
| `INTERNAL_ERROR` | 500 | Unexpected server error |
| `SERVICE_UNAVAILABLE` | 503 | Dependency unavailable |

---

## Route Naming

- Base prefix: `/api/v1`
- Resources use plural nouns: `/api/v1/users`, `/api/v1/orders`
- Nested: `/api/v1/orders/:orderId/items`
- Actions use POST with a verb suffix: `/api/v1/orders/:orderId/cancel`

---

## Request ID

Every request is assigned a `X-Request-ID` header. If the client sends one it is echoed back; otherwise a UUIDv4 is generated server-side. Use this ID in all log entries and error responses to correlate distributed traces.

---

## Pagination

List endpoints accept `?page=1&limit=20` query parameters. The response `meta` object includes `page`, `limit`, `total`, and `totalPages`.

---

## Validation

All request bodies and query parameters are validated with Zod schemas before reaching the controller. Validation failures return `422 VALIDATION_ERROR` with per-field details.
