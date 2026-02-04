# API Usage Guide

## Authentication
- Obtain JWT access token via `/auth/login`.
- Provide token as `Authorization: Bearer <token>`.

## Authorization (RBAC)
- Endpoints enforce permissions via `require_permission(PERM_NAME)`.
- Location-scoped reads/writes typically enforce `user_can_access_location(...)`.

## Common Patterns

### Pagination
- Query/list endpoints should accept:
  - `limit` (1..1000)
  - `offset` (>=0)

### Idempotency
- Some workflows enforce idempotency via unique constraints (e.g., sales snapshot unique key, price observation unique key).

## Module Endpoints (high level)

### Procurement
- `POST /procurement/requisitions`
- `POST /procurement/requisitions/{id}/review`
- `POST /procurement/requisitions/{id}/approve`
- `POST /procurement/lpos`
- `POST /procurement/grns`
- `POST /procurement/grns/{id}/confirm`
- `POST /procurement/grns/{id}/finance-confirm`
- `POST /procurement/invoices`
- `POST /procurement/invoices/{id}/evaluate-match`
- `POST /procurement/invoices/{id}/approve-for-payment`
- `POST /procurement/payments`

### Inventory
- `GET /inventory/on-hand`
- `GET /inventory/available`
- `GET /inventory/by-location`
- `GET /inventory/movements/by-source` (supports `limit`, `offset`)

### Finance
- `POST /finance/petty-cash`
- `POST /finance/petty-cash/{id}/confirm`

### Sales
- `POST /sales/daily`
- `GET /sales/query` (supports `limit`, `offset`)

### Pricing
- `GET /pricing/history` (supports `limit`, `offset`)
- `GET /pricing/alerts` (supports `limit`, `offset`)
- `GET /pricing/outliers/vendor`

## Permissions
- Permissions are stored in SQL (`permissions` table) and linked via roles.
- The code uses stable identifiers in `app/rbac/permissions.py`.
