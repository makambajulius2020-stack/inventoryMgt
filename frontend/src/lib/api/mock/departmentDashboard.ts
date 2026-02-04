import type {
  DashboardFilters,
  DepartmentDashboardApi,
} from "@/lib/api/types";
import { ALL_BRANCHES_LABEL, getDemoBranchPool } from "@/lib/locations";

function seededNumber(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return h;
}

function fmtUGX(v: number) {
  return v.toLocaleString(undefined, { style: "currency", currency: "UGX", maximumFractionDigits: 0 });
}

function seedFor(filters: DashboardFilters, department?: string) {
  return seededNumber(`${filters.preset}-${filters.location}-${filters.fromDate ?? ""}-${filters.toDate ?? ""}-${department ?? ""}`);
}

function pickBranch(filters: DashboardFilters, fallback: string) {
  if (filters.location && filters.location !== ALL_BRANCHES_LABEL) return filters.location;
  return fallback;
}

const BRANCHES = getDemoBranchPool();
const DEPARTMENTS = ["Kitchen", "Bar", "Housekeeping", "Front Office", "Maintenance"] as const;

export const mockDepartmentDashboardApi: DepartmentDashboardApi = {
  async getSpendSummary(filters: DashboardFilters, params?: { department?: string }) {
    const dept = params?.department;
    const s = seedFor(filters, dept);

    const rowsBase = Array.from({ length: 12 }).map((_, i) => {
      const department = dept ?? DEPARTMENTS[(s + i) % DEPARTMENTS.length];
      const branch = pickBranch(filters, BRANCHES[(s + i * 2) % BRANCHES.length]);

      const requisitionsCount = 6 + ((s + i * 3) % 18);
      const approvedSpend = 380_000 + ((s + i * 41_000) % 1_600_000);
      const actualSpend = Math.max(0, approvedSpend - (s % 220_000) + ((i % 3) - 1) * 55_000);
      const variancePct = approvedSpend === 0 ? 0 : ((actualSpend - approvedSpend) / approvedSpend) * 100;

      return {
        department,
        branch,
        requisitionsCount,
        approvedSpend,
        approvedSpendDisplay: fmtUGX(approvedSpend),
        actualSpend,
        actualSpendDisplay: fmtUGX(actualSpend),
        variancePct,
      };
    });

    const rows = dept ? rowsBase.map((r) => ({ ...r, department: dept })) : rowsBase;

    return { filters, departmentFilter: dept, rows };
  },

  async getActivityFeed(filters: DashboardFilters, params?: { department?: string }) {
    const dept = params?.department;
    const s = seedFor(filters, dept);

    const actions = ["Requisition Created", "Requisition Approved", "Requisition Rejected", "Stock Issued"] as const;

    const count = 18 + (s % 18);
    const rows = Array.from({ length: count }).map((_, i) => {
      const department = dept ?? DEPARTMENTS[(s + i * 2) % DEPARTMENTS.length];
      const branch = pickBranch(filters, BRANCHES[(s + i * 3) % BRANCHES.length]);
      const action = actions[(s + i) % actions.length];

      const amount = 70_000 + ((s + i * 19_000) % 820_000);
      const day = 1 + ((s + i * 5) % 28);
      const status =
        action === "Requisition Approved" ? "APPROVED" : action === "Requisition Rejected" ? "REJECTED" : "PENDING";

      return {
        department,
        branch,
        action,
        amount,
        amountDisplay: fmtUGX(amount),
        date: `2026-02-${String(day).padStart(2, "0")}`,
        status,
      };
    });

    return { filters, departmentFilter: dept, rows };
  },
};
