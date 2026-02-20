# Enterprise Specification: Web Management Portals

## 1. Architectural Overview
The system is built as a highly modular frontend-only management suite, designed to interface with a **Golang Modular Monolith** backend. The architecture prioritizes strict service-level scoping, Role-Based Access Control (RBAC), and relational data integrity.

### Frontend Stack:
*   **Framework**: Next.js (App Router)
*   **Language**: TypeScript (Strict mode)
*   **Styling**: Tailwind CSS (Custom component system)
*   **State Management**: React Context + Local Persistence
*   **Data Layer**: Mocked API services (Fully async, backend-ready)

## 2. Service Domains
The system is divided into clear functional domains, each handled by its own service layer:

*   **Auth Domain**: Handles session management and JWT handling.
*   **Executive (CEO) Domain**: Strategic KPIs, global trends, and risk monitoring.
*   **Audit Domain**: Full visibility into system logs and entity lifecycles.
*   **Operational Domain (GM/Dept)**: Location-scoped management and budgets.
*   **Supply Chain Domain (Procurement/Inventory)**: Lifecycle of stock from requisition to GRN.
*   **Financial Domain**: AP aging, payment reconciliation, and expense tracking.

## 3. API Endpoints (Target Backend)
The frontend expects the following REST structure from the Golang backend:

### Auth
*   `POST /api/v1/auth/login` → `LoginResponseDTO`
*   `POST /api/v1/auth/refresh` → `TokenDTO`

### CEO (Strategic)
*   `GET /api/v1/ceo/summary` - Consolidated KPIs
*   `GET /api/v1/ceo/trends` - Revenue vs Procurement
*   `GET /api/v1/ceo/risks` - System-wide anomaly alerts

### Auditor (Deep Visibility)
*   `GET /api/v1/audit/logs` - Full immutable event stream
*   `GET /api/v1/audit/inspect/{entity}/{id}` - Lifecycle trace (e.g., REQ → LPO → GRN → INV)
*   `GET /api/v1/audit/integrity` - Checksum verification for transactions

### Procurement & Inventory
*   `POST /api/v1/procurement/requisitions` - Create request
*   `GET /api/v1/procurement/vendors` - Performance-ranked list
*   `POST /api/v1/inventory/transfers` - Inter-branch stock movement

## 4. Auth & RBAC Model
The system uses a **JWT-based** authentication model.
Each token contains a payload with:
*   `sub`: User UUID
*   `role`: Primary access role
*   `scope`: JSON object defining `{allLocations: bool, locationId: string, departmentId: string}`

### RBAC Enforcement:
1.  **Route Protection**: Next.js Middleware/Layout checks path prefix against role mapping.
2.  **UI Scoping**: Services automatically filter data based on the user's `scope` object.
3.  **Read-Only Auditor**: Auditor role uses a specific UI layout that disables all `POST/PUT/DELETE` actions.

## 5. Data Schema & Integrity
All entities maintain strict relational integrity in `mock-db.ts`:
*   **Traceability**: Every document (LPO, GRN, etc.) points back to its parent.
*   **Scoping**: Every operational record includes a `locationId` map.
*   **Auditing**: Every mutation triggers an entry in the `AuditLog` table.

## 6. Error Response Format
The frontend expects errors in the following format:
```json
{
  "status": "error",
  "code": "INSUFFICIENT_STOCK",
  "message": "Required quantity is not available in Central Warehouse",
  "meta": { "available": 45, "requested": 100 }
}
```
