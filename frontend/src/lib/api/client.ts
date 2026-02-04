import type { AuthApi } from "@/lib/api/types";
import { mockAuthApi } from "@/lib/api/mock/auth";
import type {
  AdminUsersApi,
  CeoDashboardApi,
  DepartmentDashboardApi,
  FinanceDashboardApi,
  InventoryDashboardApi,
  ProcurementDashboardApi,
} from "@/lib/api/types";
import { mockCeoDashboardApi } from "@/lib/api/mock/dashboard";
import { mockAdminUsersApi } from "@/lib/api/mock/adminUsers";
import { mockDepartmentDashboardApi } from "@/lib/api/mock/departmentDashboard";
import { mockFinanceDashboardApi } from "@/lib/api/mock/financeDashboard";
import { mockInventoryDashboardApi } from "@/lib/api/mock/inventoryDashboard";
import { mockProcurementDashboardApi } from "@/lib/api/mock/procurementDashboard";
import { realAuthApi } from "@/lib/api/real/auth";

export type ApiClient = {
  auth: AuthApi;
  ceoDashboard: CeoDashboardApi;
  procurementDashboard: ProcurementDashboardApi;
  inventoryDashboard: InventoryDashboardApi;
  financeDashboard: FinanceDashboardApi;
  departmentDashboard: DepartmentDashboardApi;
  adminUsers: AdminUsersApi;
};

type ApiMode = "mock" | "real";

function getApiMode(): ApiMode {
  const v = process.env.NEXT_PUBLIC_API_MODE;
  if (v === "real") return "real";
  return "mock";
}

export function getApiClient(): ApiClient {
  const mode = getApiMode();

  if (mode === "real") {
    return {
      auth: realAuthApi,
      ceoDashboard: {
        async getSummary() {
          throw new Error("Real CEO dashboard API not implemented yet");
        },
        async getSalesVsProcurement() {
          throw new Error("Real CEO dashboard API not implemented yet");
        },
        async getProcurementFlow() {
          throw new Error("Real CEO dashboard API not implemented yet");
        },
        async getPriceAndVendorAlerts() {
          throw new Error("Real CEO dashboard API not implemented yet");
        },
        async getTopVendors() {
          throw new Error("Real CEO dashboard API not implemented yet");
        },
      },
      procurementDashboard: {
        async getKpis() {
          throw new Error("Real procurement dashboard API not implemented yet");
        },
        async getRequisitionFlow() {
          throw new Error("Real procurement dashboard API not implemented yet");
        },
        async getLpoStatusSummary() {
          throw new Error("Real procurement dashboard API not implemented yet");
        },
        async getLpos() {
          throw new Error("Real procurement dashboard API not implemented yet");
        },
        async getGrnsAwaitingFinance() {
          throw new Error("Real procurement dashboard API not implemented yet");
        },
        async getInvoicesWithDiscrepancies() {
          throw new Error("Real procurement dashboard API not implemented yet");
        },
        async getVendorBalances() {
          throw new Error("Real procurement dashboard API not implemented yet");
        },
        async getAdjustmentsAudit() {
          throw new Error("Real procurement dashboard API not implemented yet");
        },
      },
      inventoryDashboard: {
        async getKpis() {
          throw new Error("Real inventory dashboard API not implemented yet");
        },
        async getStock() {
          throw new Error("Real inventory dashboard API not implemented yet");
        },
        async getMovements() {
          throw new Error("Real inventory dashboard API not implemented yet");
        },
        async getMonthEndSnapshots() {
          throw new Error("Real inventory dashboard API not implemented yet");
        },
        async getMovementLedger() {
          throw new Error("Real inventory dashboard API not implemented yet");
        },
      },
      financeDashboard: {
        async getKpis() {
          throw new Error("Real finance dashboard API not implemented yet");
        },
        async getInvoiceAging() {
          throw new Error("Real finance dashboard API not implemented yet");
        },
        async getPaymentsLog() {
          throw new Error("Real finance dashboard API not implemented yet");
        },
        async getPettyCashSummary() {
          throw new Error("Real finance dashboard API not implemented yet");
        },
        async getPettyCashLedger() {
          throw new Error("Real finance dashboard API not implemented yet");
        },
      },
      departmentDashboard: {
        async getSpendSummary() {
          throw new Error("Real department dashboard API not implemented yet");
        },
        async getActivityFeed() {
          throw new Error("Real department dashboard API not implemented yet");
        },
      },
      adminUsers: {
        async list() {
          throw new Error("Real admin users API not implemented yet");
        },
        async create() {
          throw new Error("Real admin users API not implemented yet");
        },
        async updateStatus() {
          throw new Error("Real admin users API not implemented yet");
        },
        async resetPassword() {
          throw new Error("Real admin users API not implemented yet");
        },
        async getAudit() {
          throw new Error("Real admin users API not implemented yet");
        },
      },
    };
  }

  return {
    auth: mockAuthApi,
    ceoDashboard: mockCeoDashboardApi,
    procurementDashboard: mockProcurementDashboardApi,
    inventoryDashboard: mockInventoryDashboardApi,
    financeDashboard: mockFinanceDashboardApi,
    departmentDashboard: mockDepartmentDashboardApi,
    adminUsers: mockAdminUsersApi,
  };
}
