import type {
  AgingBucket,
  DashboardFilters,
  FinanceDashboardApi,
  FinanceKpisDTO,
  InvoiceAgingDTO,
  InvoiceAgingRowDTO,
  PaymentMethod,
  PaymentsLogRowDTO,
  PaymentsLogDTO,
  PettyCashDirection,
  PettyCashLedgerDTO,
  PettyCashLedgerRowDTO,
  PettyCashSummaryDTO,
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

const BRANCHES = getDemoBranchPool();
const VENDORS = ["Prime Cuts Ltd", "Fresh Farms", "BlueWave Supplies", "KCL Traders", "RiverSide Foods"] as const;

function agingBucketFor(days: number): AgingBucket {
  if (days <= 30) return "0-30";
  if (days <= 60) return "31-60";
  return "60+";
}

function monthFor(filters: DashboardFilters) {
  const from = filters.fromDate;
  if (from && from.length >= 7) return from.slice(0, 7);
  return "2026-02";
}

function daysBetweenIso(a: string, b: string) {
  const da = new Date(a + "T00:00:00Z");
  const db = new Date(b + "T00:00:00Z");
  const ms = da.getTime() - db.getTime();
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}

function endOfMonthIso(yyyyMm: string) {
  return `${yyyyMm}-28`;
}

export const mockFinanceDashboardApi: FinanceDashboardApi = {
  async getKpis(filters: DashboardFilters): Promise<FinanceKpisDTO> {
    const s = seedFor(filters);

    const totalPayables = 3_600_000 + (s % 1_200_000);
    const overdueInvoices = 7 + (s % 9);
    const paymentsMade = 2_100_000 + (s % 900_000);
    const pettyCashSpend = 310_000 + (s % 240_000);
    const outstandingGrnValue = 880_000 + (s % 520_000);

    return {
      filters,
      kpis: {
        totalPayables: { label: "Total Payables", value: totalPayables, display: fmtUGX(totalPayables) },
        overdueInvoices: { label: "Overdue Invoices", value: overdueInvoices, display: String(overdueInvoices) },
        paymentsMade: { label: "Payments Made (Period)", value: paymentsMade, display: fmtUGX(paymentsMade) },
        pettyCashSpend: { label: "Petty Cash Spend", value: pettyCashSpend, display: fmtUGX(pettyCashSpend) },
        outstandingGrnValue: { label: "Outstanding GRN Value", value: outstandingGrnValue, display: fmtUGX(outstandingGrnValue) },
      },
    };
  },

  async getInvoiceAging(filters: DashboardFilters): Promise<InvoiceAgingDTO> {
    const s = seedFor(filters);
    const count = 18 + (s % 20);

    const month = monthFor(filters);
    const asOf = endOfMonthIso(month);

    const invoiceRowsBase: InvoiceAgingRowDTO[] = Array.from({ length: count }).map((_, i) => {
      const vendor = VENDORS[(s + i) % VENDORS.length];
      const branch = pickBranch(filters, BRANCHES[(s + i * 2) % BRANCHES.length]);

      const amount = 220_000 + ((s + i * 31_000) % 1_100_000);
      const paid = ((s + i * 17_000) % amount) * 0.6;
      const paidRounded = Math.round(paid);
      const balance = Math.max(0, amount - paidRounded);

      const agingDays = 5 + ((s + i * 9) % 95);
      const dueDay = Math.max(1, 28 - agingDays);
      const dueDate = `${month}-${String(dueDay).padStart(2, "0")}`;
      const invoiceDay = Math.max(1, dueDay - (7 + ((s + i) % 10)));
      const invoiceDate = `${month}-${String(invoiceDay).padStart(2, "0")}`;
      const computedAgingDays = Math.max(0, daysBetweenIso(asOf, dueDate));
      const agingBucket = agingBucketFor(computedAgingDays);

      const invoiceId = `inv_${String((s + i * 7) % 9000).padStart(4, "0")}`;
      const invoiceNumber = `INV-${String((s + i * 7) % 9000).padStart(4, "0")}`;
      const grnId = `GRN-${String((s + i * 13) % 9000).padStart(4, "0")}`;
      const lpoId = `LPO-${String((s + i * 19) % 9000).padStart(4, "0")}`;

      const status = "OUTSTANDING";

      return {
        invoiceId,
        invoiceNumber,
        vendor,
        branch,
        invoiceDate,
        dueDate,
        grnId,
        lpoId,
        amount,
        amountDisplay: fmtUGX(amount),
        paid: paidRounded,
        paidDisplay: fmtUGX(paidRounded),
        balance,
        balanceDisplay: fmtUGX(balance),
        agingDays: computedAgingDays,
        agingBucket,
        status,
      };
    });

    const paidInvoiceIds = new Set(
      Array.from({ length: Math.floor(count / 3) }).map((_, i) => `inv_${String((s + i * 11) % 9000).padStart(4, "0")}`)
    );

    const rows: InvoiceAgingRowDTO[] = invoiceRowsBase.map((r) => {
      if (!paidInvoiceIds.has(r.invoiceId)) {
        return { ...r, status: "OUTSTANDING" as const };
      }

      return {
        ...r,
        status: "PAID" as const,
        paid: r.amount,
        paidDisplay: r.amountDisplay,
        balance: 0,
        balanceDisplay: fmtUGX(0),
      };
    });

    return { filters, rows };
  },

  async getPaymentsLog(filters: DashboardFilters): Promise<PaymentsLogDTO> {
    const s = seedFor(filters);
    const count = 14 + (s % 18);
    const methods: PaymentMethod[] = ["BANK", "CASH", "MOBILE_MONEY"];

    const month = monthFor(filters);

    const rows: PaymentsLogRowDTO[] = Array.from({ length: count }).map((_, i) => {
      const vendor = VENDORS[(s + i * 3) % VENDORS.length];
      const branch = pickBranch(filters, BRANCHES[(s + i * 2) % BRANCHES.length]);
      const amount = 90_000 + ((s + i * 29_000) % 650_000);
      const day = 1 + ((s + i * 5) % 28);

      const linkedInvoiceId = `inv_${String((s + i * 11) % 9000).padStart(4, "0")}`;
      const linkedInvoiceNumber = `INV-${String((s + i * 11) % 9000).padStart(4, "0")}`;
      const grnId = `GRN-${String((s + i * 17) % 9000).padStart(4, "0")}`;
      const lpoId = `LPO-${String((s + i * 23) % 9000).padStart(4, "0")}`;

      return {
        paymentId: `pay_${String((s + i * 31) % 9000).padStart(4, "0")}`,
        paymentDate: `${month}-${String(day).padStart(2, "0")}`,
        vendor,
        amount,
        amountDisplay: fmtUGX(amount),
        method: methods[(s + i) % methods.length],
        linkedInvoiceId,
        linkedInvoiceNumber,
        grnId,
        lpoId,
        branch,
      };
    });

    return { filters, rows };
  },

  async getPettyCashSummary(filters: DashboardFilters): Promise<PettyCashSummaryDTO> {
    const s = seedFor(filters);
    const month = monthFor(filters);

    const pool = filters.location && filters.location !== ALL_BRANCHES_LABEL ? [filters.location] : BRANCHES;

    const rows = pool.map((branch, i) => {
      const openingBalance = 180_000 + ((s + i * 27_000) % 420_000);
      const totalIn = 60_000 + ((s + i * 11_000) % 160_000);
      const totalOut = 95_000 + ((s + i * 17_000) % 260_000);
      const closingBalance = openingBalance + totalIn - totalOut;

      return {
        branch,
        month,
        openingBalance,
        openingBalanceDisplay: fmtUGX(openingBalance),
        totalIn,
        totalInDisplay: fmtUGX(totalIn),
        totalOut,
        totalOutDisplay: fmtUGX(totalOut),
        closingBalance,
        closingBalanceDisplay: fmtUGX(closingBalance),
      };
    });

    return { filters, month, rows };
  },

  async getPettyCashLedger(filters: DashboardFilters, params: { branch: string; month: string }): Promise<PettyCashLedgerDTO> {
    const s = seedFor(filters);
    const month = params.month;

    const openingBalance = 180_000 + (s % 420_000);
    const count = 18 + (s % 22);

    const expenseTypes = ["Fuel", "Supplies", "Repairs", "Staff Welfare", "Transport"] as const;
    const expenseAccounts = ["Operations", "Kitchen", "Bar", "Maintenance", "Admin"] as const;

    const rows: PettyCashLedgerRowDTO[] = Array.from({ length: count }).map((_, i) => {
      const day = 1 + ((s + i * 3) % 28);
      const direction: PettyCashDirection = (s + i) % 4 === 0 ? "IN" : "OUT";
      const amount = 10_000 + ((s + i * 7_000) % 85_000);
      const expenseType = expenseTypes[(s + i) % expenseTypes.length];
      const expenseAccount = expenseAccounts[(s + i * 2) % expenseAccounts.length];

      return {
        id: `pc_${String((s + i * 5) % 9000).padStart(4, "0")}`,
        date: `${month}-${String(day).padStart(2, "0")}`,
        branch: params.branch,
        pvNumber: `PV-${String((s + i * 13) % 9000).padStart(4, "0")}`,
        expenseType,
        expenseAccount,
        direction,
        amount,
        amountDisplay: fmtUGX(amount),
        linkedDocument: (s + i) % 3 === 0 ? `DOC-${String((s + i * 19) % 9000).padStart(4, "0")}` : undefined,
      };
    });

    const totalIn = rows.filter((r) => r.direction === "IN").reduce((acc, r) => acc + r.amount, 0);
    const totalOut = rows.filter((r) => r.direction === "OUT").reduce((acc, r) => acc + r.amount, 0);
    const closingBalance = openingBalance + totalIn - totalOut;

    return {
      filters,
      month,
      branch: params.branch,
      openingBalance,
      openingBalanceDisplay: fmtUGX(openingBalance),
      totalIn,
      totalInDisplay: fmtUGX(totalIn),
      totalOut,
      totalOutDisplay: fmtUGX(totalOut),
      closingBalance,
      closingBalanceDisplay: fmtUGX(closingBalance),
      rows,
    };
  },
};
