import type { CeoDashboardApi, DashboardFilters } from "@/lib/api/types";
import { ALL_BRANCHES_LABEL, getDemoBranchPool } from "@/lib/locations";

function seededNumber(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return h;
}

function pickBranch(filters: DashboardFilters, seed: number, i: number) {
  if (filters.location && filters.location !== ALL_BRANCHES_LABEL) return filters.location;
  const pool = getDemoBranchPool();
  if (!pool.length) return ALL_BRANCHES_LABEL;
  return pool[(seed + i) % pool.length];
}

function fmtMoney(v: number) {
  return v.toLocaleString(undefined, { style: "currency", currency: "UGX", maximumFractionDigits: 0 });
}

export const mockCeoDashboardApi: CeoDashboardApi = {
  async getSummary(filters: DashboardFilters) {
    const s = seededNumber(`${filters.preset}-${filters.location}-${filters.fromDate ?? ""}-${filters.toDate ?? ""}`);
    const totalSales = 2_500_000 + (s % 700_000);
    const procurementSpend = 1_350_000 + (s % 400_000);
    const inventoryValue = 6_200_000 + (s % 800_000);
    const pendingPayments = 420_000 + (s % 120_000);
    const grossMarginPct = Math.max(12, Math.min(48, 34 + ((s % 1000) - 500) / 100));
    const activeAlerts = 3 + (s % 9);

    return {
      filters,
      kpis: {
        totalSales: { label: "Total Sales", value: totalSales, display: fmtMoney(totalSales) },
        totalProcurementSpend: { label: "Total Procurement Spend", value: procurementSpend, display: fmtMoney(procurementSpend) },
        pendingPayments: { label: "Pending Payments", value: pendingPayments, display: fmtMoney(pendingPayments) },
        inventoryValue: { label: "Inventory Value", value: inventoryValue, display: fmtMoney(inventoryValue) },
        grossMarginPct: { label: "Gross Margin (%)", value: grossMarginPct, display: `${grossMarginPct.toFixed(1)}%` },
        activeAlerts: { label: "Active Alerts", value: activeAlerts, display: String(activeAlerts) },
      },
    };
  },

  async getSalesVsProcurement(filters: DashboardFilters) {
    const s = seededNumber(`${filters.preset}-${filters.location}-${filters.fromDate ?? ""}-${filters.toDate ?? ""}`);
    const points = Array.from({ length: 12 }).map((_, i) => {
      const baseSales = 180_000 + (s % 40_000);
      const baseProc = 110_000 + (s % 25_000);
      const wave = Math.sin((i / 12) * Math.PI * 2);
      return {
        period: `P${i + 1}`,
        sales: Math.round(baseSales + wave * 35_000 + (i % 3) * 7000),
        procurementSpend: Math.round(baseProc + wave * 22_000 + (i % 4) * 4000),
      };
    });

    return { filters, points };
  },

  async getProcurementFlow(filters: DashboardFilters) {
    const s = seededNumber(`${filters.preset}-${filters.location}-${filters.fromDate ?? ""}-${filters.toDate ?? ""}`);
    return {
      filters,
      requisitions: {
        pending: 7 + (s % 6),
        approved: 22 + (s % 10),
        rejected: 2 + (s % 3),
      },
      lpos: {
        issued: 12 + (s % 4),
        partial: 4 + (s % 3),
        complete: 18 + (s % 8),
      },
      grnsAwaitingFinance: 5 + (s % 4),
      invoicesWithDiscrepancies: 2 + (s % 5),
    };
  },

  async getPriceAndVendorAlerts(filters: DashboardFilters) {
    const s = seededNumber(`${filters.preset}-${filters.location}-${filters.fromDate ?? ""}-${filters.toDate ?? ""}`);
    return {
      filters,
      rows: [
        {
          item: "Beef Fillet",
          vendor: "Prime Cuts Ltd",
          branch: pickBranch(filters, s, 0),
          pctChange: 32.5,
          severity: "HIGH" as const,
        },
        {
          item: "Cooking Oil 20L",
          vendor: "Sunrise Suppliers",
          branch: pickBranch(filters, s, 1),
          pctChange: 58.1,
          severity: "CRITICAL" as const,
        },
        {
          item: "Tomatoes",
          vendor: "Fresh Farms",
          branch: pickBranch(filters, s, 2),
          pctChange: 18.9,
          severity: "MEDIUM" as const,
        },
      ],
    };
  },

  async getTopVendors(filters: DashboardFilters) {
    const s = seededNumber(`${filters.preset}-${filters.location}-${filters.fromDate ?? ""}-${filters.toDate ?? ""}`);
    return {
      filters,
      rows: [
        {
          vendorName: "Prime Cuts Ltd",
          totalSpend: 520_000 + (s % 120_000),
          outstandingPayments: 130_000 + (s % 40_000),
          avgPriceVariancePct: 6.8,
          fulfillmentRatePct: 92.0,
        },
        {
          vendorName: "Sunrise Suppliers",
          totalSpend: 410_000 + (s % 90_000),
          outstandingPayments: 95_000 + (s % 30_000),
          avgPriceVariancePct: 11.3,
          fulfillmentRatePct: 88.5,
        },
        {
          vendorName: "Fresh Farms",
          totalSpend: 330_000 + (s % 70_000),
          outstandingPayments: 62_000 + (s % 25_000),
          avgPriceVariancePct: 4.1,
          fulfillmentRatePct: 95.2,
        },
      ].map((r) => ({
        ...r,
        totalSpendDisplay: fmtMoney(r.totalSpend),
        outstandingPaymentsDisplay: fmtMoney(r.outstandingPayments),
      })),
    };
  },
};
