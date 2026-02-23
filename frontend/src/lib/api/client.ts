import { authService } from "./services/auth.service";
import { ceoService } from "./services/ceo.service";
import { auditorService } from "./services/auditor.service";
import { gmService } from "./services/gm.service";
import { procurementService } from "./services/procurement.service";
import { inventoryService } from "./services/inventory.service";
import { financeService } from "./services/finance.service";
import { departmentService } from "./services/department.service";
import { adminService } from "./services/admin.service";
import { reportingService } from "./services/reporting.service";
import { auditService } from "./services/audit.service";
import { searchService } from "./services/search.service";

/**
 * Enterprise API Client
 * This client abstracts the data source (mock vs real).
 * All UI components should use this client.
 * Services enforce scope filtering and read-only guards internally.
 */
export const api = {
  auth: authService,
  ceo: ceoService,
  auditor: auditorService,
  gm: gmService,
  procurement: procurementService,
  inventory: inventoryService,
  finance: financeService,
  department: departmentService,
  admin: adminService,
  reporting: reportingService,
  audit: auditService,
  search: searchService,
};

export type ApiClient = typeof api;
