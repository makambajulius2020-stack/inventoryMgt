import type {
  DashboardFilters,
  LpoStatus,
  ProcurementDashboardApi,
  ProcurementVendorBalancesDTO,
  ProcurementAdjustmentsAuditDTO,
  ProcurementKpisDTO,
  ProcurementLpoStatusSummaryDTO,
  ProcurementLposDTO,
  ProcurementRequisitionFlowDTO,
  ProcurementWatchlistGrnsDTO,
  ProcurementWatchlistInvoicesDTO,
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

function seedFor(filters: DashboardFilters) {
  return seededNumber(`${filters.preset}-${filters.location}-${filters.fromDate ?? ""}-${filters.toDate ?? ""}`);
}

function pickBranch(filters: DashboardFilters, fallback: string) {
  if (filters.location && filters.location !== ALL_BRANCHES_LABEL) return filters.location;
  return fallback;
}

const REQ_STATUSES = ["Pending", "Approved", "Rejected"] as const;
const REQ_DEPTS = ["Kitchen", "Bar", "Housekeeping", "Front Office", "Maintenance"] as const;
const BRANCHES = getDemoBranchPool();

const LPO_STATUSES: LpoStatus[] = ["Issued", "Partial", "Completed", "Cancelled"];
const VENDORS = ["Prime Cuts Ltd", "Fresh Farms", "BlueWave Supplies", "KCL Traders", "RiverSide Foods"] as const;

function uid(prefix: string, n: number) {
  return `${prefix}-${String(n % 9000).padStart(4, "0")}`;
}

export const mockProcurementDashboardApi: ProcurementDashboardApi = {
  async getKpis(filters: DashboardFilters): Promise<ProcurementKpisDTO> {
    const s = seedFor(filters);

    const totalRequisitions = 38 + (s % 30);
    const pendingApprovals = 6 + (s % 10);
    const activeLpos = 14 + (s % 9);
    const grnsAwaitingFinance = 3 + (s % 6);
    const invoicesWithDiscrepancies = 2 + (s % 5);

    return {
      filters,
      kpis: {
        totalRequisitions: { label: "Total Requisitions", value: totalRequisitions, display: String(totalRequisitions) },
        pendingApprovals: { label: "Pending Approvals", value: pendingApprovals, display: String(pendingApprovals) },
        activeLpos: { label: "Active LPOs", value: activeLpos, display: String(activeLpos) },
        grnsAwaitingFinance: { label: "GRNs Awaiting Finance", value: grnsAwaitingFinance, display: String(grnsAwaitingFinance) },
        invoicesWithDiscrepancies: {
          label: "Invoices with Discrepancies",
          value: invoicesWithDiscrepancies,
          display: String(invoicesWithDiscrepancies),
        },
      },
    };
  },

  async getRequisitionFlow(filters: DashboardFilters): Promise<ProcurementRequisitionFlowDTO> {
    const s = seedFor(filters);
    const count = 18 + (s % 18);

    const rows = Array.from({ length: count }).map((_, i) => {
      const branch = pickBranch(filters, BRANCHES[(s + i) % BRANCHES.length]);
      const department = REQ_DEPTS[(s + i * 3) % REQ_DEPTS.length];
      const categoryId = `CAT-${String(department).toUpperCase().replaceAll(" ", "_")}`;
      const status = REQ_STATUSES[(s + i * 5) % REQ_STATUSES.length];
      const requestedAmount = 140_000 + ((s + i * 17_000) % 520_000);
      const day = 1 + ((s + i * 7) % 28);

      return {
        requisitionId: `REQ-${String((s + i) % 9000).padStart(4, "0")}`,
        categoryId,
        department,
        branch,
        status,
        requestedAmount,
        requestedAmountDisplay: fmtUGX(requestedAmount),
        date: `2026-02-${String(day).padStart(2, "0")}`,
      };
    });

    return { filters, rows };
  },

  async getLpoStatusSummary(filters: DashboardFilters): Promise<ProcurementLpoStatusSummaryDTO> {
    const s = seedFor(filters);

    const issued = 10 + (s % 6);
    const partial = 4 + (s % 4);
    const completed = 8 + (s % 6);
    const cancelled = 1 + (s % 3);

    return {
      filters,
      summary: { Issued: issued, Partial: partial, Completed: completed, Cancelled: cancelled },
    };
  },

  async getLpos(filters: DashboardFilters, params?: { status?: LpoStatus }): Promise<ProcurementLposDTO> {
    const s = seedFor(filters);
    const statusFilter = params?.status;

    const baseCount = 20 + (s % 14);
    const all = Array.from({ length: baseCount }).map((_, i) => {
      const branch = pickBranch(filters, BRANCHES[(s + i * 2) % BRANCHES.length]);
      const status = LPO_STATUSES[(s + i * 3) % LPO_STATUSES.length];
      const amount = 280_000 + ((s + i * 29_000) % 1_200_000);
      const day = 1 + ((s + i * 11) % 28);

      return {
        lpoId: `LPO-${String((s + i * 7) % 9000).padStart(4, "0")}`,
        vendor: ["Prime Cuts Ltd", "Fresh Farms", "BlueWave Supplies", "KCL Traders"][((s + i) % 4) as 0 | 1 | 2 | 3],
        branch,
        status,
        amount,
        amountDisplay: fmtUGX(amount),
        date: `2026-02-${String(day).padStart(2, "0")}`,
      };
    });

    const rows = statusFilter ? all.filter((r) => r.status === statusFilter) : all;

    return { filters, statusFilter, rows };
  },

  async getGrnsAwaitingFinance(filters: DashboardFilters): Promise<ProcurementWatchlistGrnsDTO> {
    const s = seedFor(filters);
    const count = 3 + (s % 6);

    const rows = Array.from({ length: count }).map((_, i) => {
      const branch = pickBranch(filters, BRANCHES[(s + i * 4) % BRANCHES.length]);
      const value = 190_000 + ((s + i * 33_000) % 700_000);
      const day = 1 + ((s + i * 9) % 28);

      const grnId = uid("GRN", s + i * 13);
      const lpoId = uid("LPO", s + i * 7);

      return {
        grnId,
        lpoId,
        vendor: VENDORS[((s + i) % VENDORS.length) as 0 | 1 | 2 | 3 | 4],
        branch,
        value,
        valueDisplay: fmtUGX(value),
        date: `2026-02-${String(day).padStart(2, "0")}`,
      };
    });

    return { filters, rows };
  },

  async getInvoicesWithDiscrepancies(filters: DashboardFilters): Promise<ProcurementWatchlistInvoicesDTO> {
    const s = seedFor(filters);
    const count = 2 + (s % 5);

    const rows = Array.from({ length: count }).map((_, i) => {
      const branch = pickBranch(filters, BRANCHES[(s + i * 5) % BRANCHES.length]);
      const amount = 260_000 + ((s + i * 41_000) % 900_000);
      const day = 1 + ((s + i * 6) % 28);

      const grnId = uid("GRN", s + i * 19);
      const lpoId = uid("LPO", s + i * 23);

      return {
        invoiceNumber: `INV-${String((s + i * 19) % 9000).padStart(4, "0")}`,
        grnId,
        lpoId,
        vendor: VENDORS[((s + i * 2) % VENDORS.length) as 0 | 1 | 2 | 3 | 4],
        branch,
        amount,
        amountDisplay: fmtUGX(amount),
        issue: ["Qty mismatch", "Price mismatch", "Missing GRN"][((s + i) % 3) as 0 | 1 | 2],
        date: `2026-02-${String(day).padStart(2, "0")}`,
      };
    });

    return { filters, rows };
  },

  async getVendorBalances(filters: DashboardFilters): Promise<ProcurementVendorBalancesDTO> {
    const s = seedFor(filters);
    const branchScope = filters.location && filters.location !== ALL_BRANCHES_LABEL ? filters.location : "All";

    const rows = VENDORS.map((vendor, i) => {
      const totalReceived = 1_200_000 + ((s + i * 97_000) % 2_600_000);
      const totalPaid = 650_000 + ((s + i * 71_000) % 1_900_000);
      const systemOutstanding = Math.max(0, totalReceived - totalPaid);

      const migratedOpeningBalance = (i % 2 === 0) ? 320_000 + ((s + i * 19_000) % 520_000) : 0;
      const hasManualAdjustments = (s + i) % 3 === 0;

      const outstanding = systemOutstanding + migratedOpeningBalance;

      return {
        vendor,
        branchScope,
        totalReceived,
        totalReceivedDisplay: fmtUGX(totalReceived),
        totalPaid,
        totalPaidDisplay: fmtUGX(totalPaid),
        outstanding,
        outstandingDisplay: fmtUGX(outstanding),
        migratedOpeningBalance,
        migratedOpeningBalanceDisplay: fmtUGX(migratedOpeningBalance),
        hasManualAdjustments,
      };
    });

    return { filters, rows };
  },

  async getAdjustmentsAudit(filters: DashboardFilters, params?: { vendor?: string }): Promise<ProcurementAdjustmentsAuditDTO> {
    const s = seedFor(filters);
    const vendorFilter = params?.vendor;

    const base = Array.from({ length: 8 }).map((_, i) => {
      const vendor = VENDORS[(s + i) % VENDORS.length];
      const branch = pickBranch(filters, BRANCHES[(s + i * 2) % BRANCHES.length]);
      const amount = ((i % 2 === 0) ? 1 : -1) * (45_000 + ((s + i * 9_000) % 180_000));
      const day = 1 + ((s + i * 3) % 28);

      return {
        id: uid("ADJ", s + i * 11),
        at: `2026-02-${String(day).padStart(2, "0")}T10:00:00Z`,
        vendor,
        branch,
        amount,
        amountDisplay: fmtUGX(amount),
        reason: amount >= 0 ? "Migrated opening balance correction" : "Manual adjustment (recon) - audited",
        actorName: "CEO User",
      };
    });

    const rows = vendorFilter ? base.filter((r) => r.vendor === vendorFilter) : base;
    return { filters, vendorFilter, rows };
  },
};
