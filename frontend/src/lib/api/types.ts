import type { LoginResponseDTO } from "@/lib/auth/types";
import type { RoleName } from "@/lib/auth/types";

export type DateRangePreset = "today" | "week" | "month" | "quarter" | "q2" | "q3" | "q4" | "year" | "custom";

export type DashboardFilters = {
  preset: DateRangePreset;
  fromDate?: string;
  toDate?: string;
  location: string; // "ALL" or branch name
};

export type AuthApi = {
  login(params: { email: string; password: string }): Promise<LoginResponseDTO>;
};

export type KpiDTO = {
  label: string;
  value: number;
  display: string;
};

export type CeoSummaryDTO = {
  filters: DashboardFilters;
  kpis: {
    totalSales: KpiDTO;
    totalProcurementSpend: KpiDTO;
    pendingPayments: KpiDTO;
    inventoryValue: KpiDTO;
    grossMarginPct: KpiDTO;
    activeAlerts: KpiDTO;
  };
};

export type SalesVsProcurementPointDTO = {
  period: string;
  sales: number;
  procurementSpend: number;
};

export type SalesVsProcurementDTO = {
  filters: DashboardFilters;
  points: SalesVsProcurementPointDTO[];
};

export type ProcurementFlowDTO = {
  filters: DashboardFilters;
  requisitions: {
    pending: number;
    approved: number;
    rejected: number;
  };
  lpos: {
    issued: number;
    partial: number;
    complete: number;
  };
  grnsAwaitingFinance: number;
  invoicesWithDiscrepancies: number;
};

export type AlertSeverity = "MEDIUM" | "HIGH" | "CRITICAL";

export type PriceVendorAlertRowDTO = {
  item: string;
  vendor: string;
  branch: string;
  pctChange: number;
  severity: AlertSeverity;
};

export type PriceVendorAlertsDTO = {
  filters: DashboardFilters;
  rows: PriceVendorAlertRowDTO[];
};

export type TopVendorRowDTO = {
  vendorName: string;
  totalSpend: number;
  totalSpendDisplay: string;
  outstandingPayments: number;
  outstandingPaymentsDisplay: string;
  avgPriceVariancePct: number;
  fulfillmentRatePct: number;
};

export type TopVendorsDTO = {
  filters: DashboardFilters;
  rows: TopVendorRowDTO[];
};

export type CeoDashboardApi = {
  getSummary(filters: DashboardFilters): Promise<CeoSummaryDTO>;
  getSalesVsProcurement(filters: DashboardFilters): Promise<SalesVsProcurementDTO>;
  getProcurementFlow(filters: DashboardFilters): Promise<ProcurementFlowDTO>;
  getPriceAndVendorAlerts(filters: DashboardFilters): Promise<PriceVendorAlertsDTO>;
  getTopVendors(filters: DashboardFilters): Promise<TopVendorsDTO>;
};

export type ProcurementKpisDTO = {
  filters: DashboardFilters;
  kpis: {
    totalRequisitions: KpiDTO;
    pendingApprovals: KpiDTO;
    activeLpos: KpiDTO;
    grnsAwaitingFinance: KpiDTO;
    invoicesWithDiscrepancies: KpiDTO;
  };
};

export type ProcurementRequisitionStatus = "Pending" | "Approved" | "Rejected";

export type ProcurementRequisitionRowDTO = {
  requisitionId: string;
  categoryId: string;
  branch: string;
  status: ProcurementRequisitionStatus;
  requestedAmount: number;
  requestedAmountDisplay: string;
  date: string; // ISO date
};

export type ProcurementRequisitionFlowDTO = {
  filters: DashboardFilters;
  rows: ProcurementRequisitionRowDTO[];
};

export type LpoStatus = "Issued" | "Partial" | "Completed" | "Cancelled";

export type ProcurementLpoStatusSummaryDTO = {
  filters: DashboardFilters;
  summary: Record<LpoStatus, number>;
};

export type ProcurementLpoRowDTO = {
  lpoId: string;
  vendor: string;
  branch: string;
  status: LpoStatus;
  amount: number;
  amountDisplay: string;
  date: string; // ISO date
};

export type ProcurementLposDTO = {
  filters: DashboardFilters;
  statusFilter?: LpoStatus;
  rows: ProcurementLpoRowDTO[];
};

export type ProcurementWatchlistGrnRowDTO = {
  grnId: string;
  lpoId: string; // must link to LPO
  vendor: string;
  branch: string;
  value: number;
  valueDisplay: string;
  date: string; // ISO date
};

export type ProcurementWatchlistGrnsDTO = {
  filters: DashboardFilters;
  rows: ProcurementWatchlistGrnRowDTO[];
};

export type ProcurementWatchlistInvoiceRowDTO = {
  invoiceNumber: string;
  grnId: string; // must link to GRN
  lpoId: string; // derived via GRN->LPO
  vendor: string;
  branch: string;
  amount: number;
  amountDisplay: string;
  issue: string;
  date: string; // ISO date
};

export type ProcurementWatchlistInvoicesDTO = {
  filters: DashboardFilters;
  rows: ProcurementWatchlistInvoiceRowDTO[];
};

export type ProcurementDashboardApi = {
  getKpis(filters: DashboardFilters): Promise<ProcurementKpisDTO>;
  getRequisitionFlow(filters: DashboardFilters): Promise<ProcurementRequisitionFlowDTO>;
  getLpoStatusSummary(filters: DashboardFilters): Promise<ProcurementLpoStatusSummaryDTO>;
  getLpos(filters: DashboardFilters, params?: { status?: LpoStatus }): Promise<ProcurementLposDTO>;
  getGrnsAwaitingFinance(filters: DashboardFilters): Promise<ProcurementWatchlistGrnsDTO>;
  getInvoicesWithDiscrepancies(filters: DashboardFilters): Promise<ProcurementWatchlistInvoicesDTO>;
  getVendorBalances(filters: DashboardFilters): Promise<ProcurementVendorBalancesDTO>;
  getAdjustmentsAudit(filters: DashboardFilters, params?: { vendor?: string }): Promise<ProcurementAdjustmentsAuditDTO>;
};

export type ProcurementVendorBalanceRowDTO = {
  vendor: string;
  branchScope: string; // "All" or branch name
  totalReceived: number;
  totalReceivedDisplay: string;
  totalPaid: number;
  totalPaidDisplay: string;
  outstanding: number;
  outstandingDisplay: string;
  migratedOpeningBalance: number; // flagged as migrated
  migratedOpeningBalanceDisplay: string;
  hasManualAdjustments: boolean; // audit-required adjustments exist
};

export type ProcurementVendorBalancesDTO = {
  filters: DashboardFilters;
  rows: ProcurementVendorBalanceRowDTO[];
};

export type ProcurementAdjustmentsAuditRowDTO = {
  id: string;
  at: string; // ISO date-time
  vendor: string;
  branch: string;
  amount: number;
  amountDisplay: string;
  reason: string;
  actorName: string;
};

export type ProcurementAdjustmentsAuditDTO = {
  filters: DashboardFilters;
  vendorFilter?: string;
  rows: ProcurementAdjustmentsAuditRowDTO[];
};

export type InventoryKpisDTO = {
  filters: DashboardFilters;
  kpis: {
    totalInventoryValue: KpiDTO;
    lowStockItems: KpiDTO;
    overstockedItems: KpiDTO;
    recentAdjustments: KpiDTO;
    pettyCashReceiptsCount: KpiDTO;
    pettyCashReceiptsValue: KpiDTO;
  };
};

export type InventoryStockStatus = "OK" | "Low" | "Critical";

export type InventoryStockRowDTO = {
  item: string;
  category: string;
  branch: string;
  onHand: number;
  available: number;
  value: number;
  valueDisplay: string;
  status: InventoryStockStatus;
};

export type InventoryStockDTO = {
  filters: DashboardFilters;
  rows: InventoryStockRowDTO[];
};

export type InventoryMovementType = "GRN" | "PETTY_CASH" | "ADJUSTMENT" | "ISSUE";

export type InventoryMovementRowDTO = {
  date: string; // ISO date
  item: string;
  movementType: InventoryMovementType;
  quantity: number;
  sourceDocument: string;
  branch: string;
};

export type InventoryMovementsDTO = {
  filters: DashboardFilters;
  rows: InventoryMovementRowDTO[];
};

export type InventoryDashboardApi = {
  getKpis(filters: DashboardFilters): Promise<InventoryKpisDTO>;
  getStock(filters: DashboardFilters): Promise<InventoryStockDTO>;
  getMovements(filters: DashboardFilters): Promise<InventoryMovementsDTO>;
  getMonthEndSnapshots(filters: DashboardFilters, params?: { month?: string }): Promise<InventoryMonthEndSnapshotsDTO>;
  getMovementLedger(
    filters: DashboardFilters,
    params: { month: string; branch: string; item?: string }
  ): Promise<InventoryMovementLedgerDTO>;
};

export type InventoryLedgerMovementKind = "FETCHED" | "RECEIVED" | "ISSUED" | "ADJUSTMENT";

export type InventoryMovementLedgerRowDTO = {
  id: string;
  date: string; // ISO date
  branch: string;
  item: string;
  kind: InventoryLedgerMovementKind;
  quantity: number;
  sourceDocument?: string;
  reason?: string; // used mainly for ADJUSTMENT, or variance explanations if needed
};

export type InventoryMovementLedgerDTO = {
  filters: DashboardFilters;
  month: string; // YYYY-MM
  branch: string;
  item?: string;
  rows: InventoryMovementLedgerRowDTO[];
};

export type InventoryMonthEndSnapshotRowDTO = {
  branch: string;
  month: string; // YYYY-MM
  item: string;
  opening: number;
  received: number;
  issued: number;
  systemClosing: number; // derived: opening + received - issued
  physicalCount?: number; // externally reported
  variance?: number; // derived only when physicalCount exists: physicalCount - systemClosing
  varianceReason?: string; // only present when physicalCount exists
};

export type InventoryMonthEndSnapshotsDTO = {
  filters: DashboardFilters;
  month: string; // YYYY-MM
  rows: InventoryMonthEndSnapshotRowDTO[];
};

export type FinanceKpisDTO = {
  filters: DashboardFilters;
  kpis: {
    totalPayables: KpiDTO;
    overdueInvoices: KpiDTO;
    paymentsMade: KpiDTO;
    pettyCashSpend: KpiDTO;
    outstandingGrnValue: KpiDTO;
  };
};

export type AgingBucket = "0-30" | "31-60" | "60+";

export type InvoiceAgingRowDTO = {
  invoiceId: string;
  invoiceNumber: string;
  vendor: string;
  branch: string;
  invoiceDate: string; // ISO date
  dueDate: string; // ISO date
  grnId: string; // must link to GRN
  lpoId: string; // derived via GRN->LPO linkage
  amount: number;
  amountDisplay: string;
  paid: number;
  paidDisplay: string;
  balance: number;
  balanceDisplay: string;
  agingDays: number; // derived from dueDate
  agingBucket: AgingBucket;
  status: "PAID" | "OUTSTANDING";
};

export type InvoiceAgingDTO = {
  filters: DashboardFilters;
  rows: InvoiceAgingRowDTO[];
};

export type PaymentMethod = "BANK" | "CASH" | "MOBILE_MONEY";

export type PaymentsLogRowDTO = {
  paymentId: string;
  paymentDate: string; // ISO date
  vendor: string;
  amount: number;
  amountDisplay: string;
  method: PaymentMethod;
  linkedInvoiceId: string;
  linkedInvoiceNumber: string;
  grnId: string;
  lpoId: string;
  branch: string;
};

export type PaymentsLogDTO = {
  filters: DashboardFilters;
  rows: PaymentsLogRowDTO[];
};

export type FinanceDashboardApi = {
  getKpis(filters: DashboardFilters): Promise<FinanceKpisDTO>;
  getInvoiceAging(filters: DashboardFilters): Promise<InvoiceAgingDTO>;
  getPaymentsLog(filters: DashboardFilters): Promise<PaymentsLogDTO>;
  getPettyCashSummary(filters: DashboardFilters): Promise<PettyCashSummaryDTO>;
  getPettyCashLedger(filters: DashboardFilters, params: { branch: string; month: string }): Promise<PettyCashLedgerDTO>;
};

export type PettyCashDirection = "IN" | "OUT";

export type PettyCashLedgerRowDTO = {
  id: string;
  date: string; // ISO date
  branch: string;
  pvNumber: string;
  expenseType: string;
  expenseAccount: string;
  direction: PettyCashDirection;
  amount: number;
  amountDisplay: string;
  linkedDocument?: string;
};

export type PettyCashLedgerDTO = {
  filters: DashboardFilters;
  month: string; // YYYY-MM
  branch: string;
  openingBalance: number;
  openingBalanceDisplay: string;
  totalIn: number;
  totalInDisplay: string;
  totalOut: number;
  totalOutDisplay: string;
  closingBalance: number;
  closingBalanceDisplay: string;
  rows: PettyCashLedgerRowDTO[];
};

export type PettyCashSummaryRowDTO = {
  branch: string;
  month: string; // YYYY-MM
  openingBalance: number;
  openingBalanceDisplay: string;
  totalIn: number;
  totalInDisplay: string;
  totalOut: number;
  totalOutDisplay: string;
  closingBalance: number;
  closingBalanceDisplay: string;
};

export type PettyCashSummaryDTO = {
  filters: DashboardFilters;
  month: string; // YYYY-MM
  rows: PettyCashSummaryRowDTO[];
};


export type UserStatus = "ACTIVE" | "SUSPENDED";

export type AdminUserDTO = {
  id: string;
  fullName: string;
  email: string;
  phone?: string;
  role: RoleName;
  branch?: string;
  status: UserStatus;
  lastLogin?: string; // ISO date-time
};

export type AdminUserAuditEventDTO = {
  id: string;
  userId: string;
  actorName: string;
  action: string;
  at: string; // ISO date-time
  details: string;
};

export type AdminUsersListDTO = {
  rows: AdminUserDTO[];
};

export type AdminUsersFilters = {
  branch?: string;
  role?: RoleName;
  status?: UserStatus;
};

export type CreateAdminUserInput = {
  fullName: string;
  email: string;
  phone?: string;
  role: RoleName;
  branch?: string;
  status: UserStatus;
};

export type CreateAdminUserResultDTO = {
  user: AdminUserDTO;
  inviteLink?: string;
  tempPassword?: string;
};

export type AdminUsersApi = {
  list(filters?: AdminUsersFilters): Promise<AdminUsersListDTO>;
  create(input: CreateAdminUserInput, params?: { replaceBranchManagerForBranch?: string }): Promise<CreateAdminUserResultDTO>;
  updateStatus(userId: string, status: UserStatus): Promise<{ ok: true }>;
  resetPassword(userId: string): Promise<{ ok: true; tempPassword: string }>;
  getAudit(userId: string): Promise<{ rows: AdminUserAuditEventDTO[] }>;
};
