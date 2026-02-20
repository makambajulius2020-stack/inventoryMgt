# Enterprise Management Portals

Structural refactor to a production-grade web management suite for a multi-location inventory and procurement ecosystem.

## 🚀 Architectural Reset Summary
This project has been rebuilt from the ground up to follow strict enterprise standards:
1.  **Strict RBAC**: Roles (CEO, Auditor, GM, etc.) have hard-coded scope and access boundaries.
2.  **Executive-First CEO**: Removed raw operational tables; replaced with aggregated trend analysis.
3.  **Audit Infrastructure**: Dedicated Auditor portal with deep item lifecycle tracing and read-only immutable logs.
4.  **Backend-Ready API**: UI components interface with async services, not the database directly.
5.  **Custom Component System**: Built from scratch using Tailwind CSS, adhering to the #001F3F (Deep Navy) and Teal theme.

## 🛠 Project Structure
*   `src/app/`: Role-specific portals and system workflows.
*   `src/lib/api/`: Service layer and API client.
*   `src/lib/mock-db.ts`: Full ERD-compliant mocked database.
*   `src/components/ui/`: Atomic enterprise components (Buttons, Cards, DataTables).

## 🚦 Internal Roles & Scopes
| Role | Portal | Scope |
| :--- | :--- | :--- |
| **CEO** | `/ceo` | Global Executive Scoped |
| **System Auditor**| `/auditor` | Read-Only EVERYTHING |
| **General Manager**| `/gm` | Branch Operations Scoped |
| **Dept Head** | `/department` | Branch + Department Scoped |
| **Procurement Officer**| `/procurement`| Supply Chain Operations |
| **Store Manager** | `/inventory` | Stock & Logistics Control |
| **Finance Manager**| `/finance` | Financials & Payables |

## 📦 Getting Started
1. `npm install`
2. `npm run dev`

Review `DOCS.md` for backend integration specifications and full API schema details.
