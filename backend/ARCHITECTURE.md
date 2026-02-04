# System Architecture Overview

## Modules

### Authentication & RBAC
- **Auth**: JWT-based authentication.
- **RBAC**: Roles/permissions enforced at the API boundary via `require_permission(...)`.
- **Location scoping**: `user_can_access_location(...)` enforces location access for location-scoped entities.

### Master Data
- **Locations, Departments, Items, Vendors**: Stored in SQL and referenced by transactional documents.

### Procurement (PRRD)
- Chain of record:
  - `Requisition` -> `LPO` -> `GRN` -> `Invoice` -> `Payment`
- Workflow enforcement is implemented in **service layer** functions with explicit state transition checks.

### Inventory (Immutable Ledger)
- `InventoryMovement` is an **append-only ledger** of immutable facts.
- Corrections are modeled as additional movements (e.g., `ADJUSTMENT`), not updates.

### Finance
- Invoice and payment processing are workflow-driven with strict validations.
- Petty cash supports multi-line transactions, and stock-linked lines post to inventory movements.

### Sales & Analytics
- Sales snapshots are **append-only** daily records per location.
- Price monitoring records price observations only on `GRN FINANCE_CONFIRMED`, computes deterministic variance, and persists alerts.

## Data Stores

### SQL (SQLite/MySQL)
- Authoritative store for all transactional and master data.
- Alembic migrations with SQLite-safe patterns (batch operations/guards where needed).

### MongoDB (Audit)
- Append-only audit events collection.
- All critical mutations log before/after and relevant payload context.

## Data Flow (High-level)

1. **Procurement**
   - Requisition creation -> review/approval -> LPO issuance.
2. **Receiving**
   - GRN created (draft) -> store confirm -> finance confirm.
3. **Inventory**
   - On GRN finance confirm, inventory ledger movements are posted.
4. **Finance**
   - Invoice created only after GRN finance confirm; three-way match evaluation; payment lifecycle.
5. **Analytics**
   - Sales: daily snapshot capture.
   - Pricing: price observations recorded at GRN finance confirm; alerts generated deterministically; alerts audited.

## Trust Boundaries
- **API boundary**: permission checks and (where applicable) location access checks.
- **Service layer**: authoritative workflow enforcement and state transitions.
- **DB constraints**: idempotency and invariants (e.g., unique constraints) reinforce correctness.

## Performance Posture
- Indexes exist for common filters: `(location_id, status, created_at)` patterns and source document traceability.
- Query endpoints should remain bounded (pagination) to prevent unbounded reads.
