/**
 * DOMAIN 4: Reporting Engine
 * Dedicated reporting service — role-based reporting methods.
 * CEO: executive summary, revenue trend, branch ranking
 * Auditor: full audit trail, cross-location variance
 * Finance: AP aging, expense breakdown
 * All computations happen here, not in UI.
 */

import { mockDB } from "../../mock-db";
import type { AuthUser } from "@/lib/auth/types";
import { normalizeRole, Role } from "@/lib/auth/roles";
import { financeService } from "./finance.service";

const DELAY = 300;
const delay = () => new Promise((r) => setTimeout(r, DELAY));

// ─── TYPES ───────────────────────────────────────────────────────────────────

export interface ExecutiveSummary {
    totalRevenue: number;
    totalExpenses: number;
    grossMargin: number;
    inventoryValue: number;
    cashBalance: number;
    locationCount: number;
    userCount: number;
    activeRequisitions: number;
    unpaidInvoices: number;
}

export interface BranchRanking {
    locationId: string;
    locationName: string;
    revenue: number;
    expenses: number;
    profit: number;
    stockValue: number;
    staffCount: number;
}

export interface RevenueTrendPoint {
    period: string;
    revenue: number;
    expenses: number;
    profit: number;
}

export interface AuditTrailEntry {
    id: string;
    timestamp: string;
    userName: string;
    userRole: string;
    action: string;
    entityType: string;
    entityId: string;
    changes: string;
    locationName: string;
}

export interface CrossLocationVariance {
    metric: string;
    locations: { locationName: string; value: number }[];
    average: number;
    maxVariance: number;
}

export interface GlobalRevenueSummary {
    totalRevenue: number;
    totalExpenses: number;
    netProfit: number;
    profitMarginPercent: number;
}

export interface InventoryHealthOverview {
    totalStockValue: number;
    lowStockAlertsCount: number;
    deadStockCount?: number;
}

export interface ProcurementOverview {
    openLpoCount: number;
    pendingGrnCount: number;
    outstandingPayables: number;
}

export interface LocationComparisonRow {
    locationId: string;
    locationName: string;
    revenue: number;
    expenses: number;
    netProfit: number;
}

export interface ExecutiveReports {
    revenueSummary: GlobalRevenueSummary;
    inventoryHealth: InventoryHealthOverview;
    procurementOverview: ProcurementOverview;
    locationComparison: LocationComparisonRow[];
}

// ─── HELPERS ─────────────────────────────────────────────────────────────────

function resolveLocationName(id: string) { return mockDB.locations.find((l) => l.id === id)?.name ?? "Unknown"; }

function assertReportingRole(user: AuthUser) {
    const role = normalizeRole(user.role);
    if (!role) throw new Error(`[RBAC] Role "${user.role}" is not recognized.`);
    const allowed = [Role.CEO, Role.SYSTEM_AUDITOR, Role.GENERAL_MANAGER, Role.FINANCE_MANAGER];
    if (!allowed.includes(role)) throw new Error(`[RBAC] Role "${user.role}" is not permitted to access reporting aggregation.`);
}

function assertReportScope(user: AuthUser, inputLocationId?: string): { locationId?: string; global: boolean } {
    const role = normalizeRole(user.role);
    if (!role) throw new Error(`[RBAC] Role "${user.role}" is not recognized.`);

    if (role === Role.CEO || role === Role.SYSTEM_AUDITOR) {
        if (inputLocationId) throw new Error("[Scope] Global roles must not request a single-location executive aggregation.");
        return { global: true };
    }

    if (!user.scope.locationId) throw new Error("[Scope] User has no location assigned.");
    if (inputLocationId && inputLocationId !== user.scope.locationId) throw new Error("[Scope] Cross-location access is blocked.");
    return { global: false, locationId: user.scope.locationId };
}

type InventorySnapshot = { totalStockValue: number; lowStockAlertsCount: number };

function movementDelta(
    type:
        | "OPENING_BALANCE"
        | "PURCHASE_RECEIPT"
        | "TRANSFER_IN"
        | "TRANSFER_OUT"
        | "DEPARTMENT_ISSUE"
        | "ADJUSTMENT",
    qty: number
): number {
    switch (type) {
        case "OPENING_BALANCE":
        case "PURCHASE_RECEIPT":
        case "TRANSFER_IN":
            return qty;
        case "TRANSFER_OUT":
        case "DEPARTMENT_ISSUE":
            return -qty;
        case "ADJUSTMENT":
            return qty;
    }
}

function latestUnitCost(locationId: string, itemId: string): number {
    const relevant = mockDB.stockMovements
        .filter((m) => m.locationId === locationId && m.inventoryItemId === itemId)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return relevant[0]?.unitCost ?? (mockDB.inventoryItems.find((i) => i.id === itemId)?.basePrice ?? 0);
}

const memo = {
    inventorySnapshot: new Map<string, InventorySnapshot>(),
    pnlByLocation: new Map<string, { revenue: number; cogs: number; operatingExpenses: number; grossProfit: number; netProfit: number }>(),
} as const;

function memoKey(parts: Record<string, string | number | boolean | undefined>) {
    return Object.entries(parts)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => `${k}=${String(v ?? "")}`)
        .join("&");
}

function computeInventorySnapshot(locationId?: string): InventorySnapshot {
    const key = memoKey({ locationId: locationId ?? "ALL" });
    const cached = memo.inventorySnapshot.get(key);
    if (cached) return cached;

    const moves = locationId ? mockDB.stockMovements.filter((m) => m.locationId === locationId) : mockDB.stockMovements;
    const byKey = new Map<string, { locationId: string; itemId: string; onHand: number }>();

    for (const m of moves) {
        const k = `${m.locationId}::${m.inventoryItemId}`;
        const current = byKey.get(k) ?? { locationId: m.locationId, itemId: m.inventoryItemId, onHand: 0 };
        current.onHand += movementDelta(m.type, m.quantity);
        byKey.set(k, current);
    }

    const stockMeta = locationId ? mockDB.locationStock.filter((s) => s.locationId === locationId) : mockDB.locationStock;
    for (const s of stockMeta) {
        const k = `${s.locationId}::${s.itemId}`;
        if (!byKey.has(k)) byKey.set(k, { locationId: s.locationId, itemId: s.itemId, onHand: 0 });
    }

    let totalStockValue = 0;
    let lowStockAlertsCount = 0;
    for (const bal of byKey.values()) {
        const meta = mockDB.locationStock.find((s) => s.locationId === bal.locationId && s.itemId === bal.itemId);
        const reorderLevel = meta?.reorderLevel ?? 0;
        if (reorderLevel > 0 && bal.onHand <= reorderLevel) lowStockAlertsCount++;
        const unitCost = latestUnitCost(bal.locationId, bal.itemId);
        totalStockValue += unitCost * bal.onHand;
    }

    const snap = { totalStockValue, lowStockAlertsCount };
    memo.inventorySnapshot.set(key, snap);
    return snap;
}

// ─── SERVICE ─────────────────────────────────────────────────────────────────

export const reportingService = {

    // ── Phase 2.4 Executive Reports (read-only aggregation) ───────────────
    async getExecutiveReports(user: AuthUser, input: { from: string; to: string; locationId?: string }): Promise<ExecutiveReports> {
        assertReportingRole(user);
        await delay();

        const scope = assertReportScope(user, input.locationId);
        const from = input.from;
        const to = input.to;

        const locations = scope.global
            ? mockDB.locations.filter((l) => l.status === "ACTIVE")
            : mockDB.locations.filter((l) => l.id === scope.locationId);

        const locationComparison: LocationComparisonRow[] = [];
        let totalRevenue = 0;
        let totalExpenses = 0;
        let totalNetProfit = 0;

        for (const loc of locations) {
            const k = memoKey({ from, to, locationId: loc.id });
            let pnl = memo.pnlByLocation.get(k);
            if (!pnl) {
                pnl = await financeService.getProfitAndLoss(user, { from, to, locationId: loc.id });
                memo.pnlByLocation.set(k, pnl);
            }
            const revenue = pnl.revenue;
            const expenses = pnl.cogs + pnl.operatingExpenses;
            const netProfit = pnl.netProfit;

            totalRevenue += revenue;
            totalExpenses += expenses;
            totalNetProfit += netProfit;
            locationComparison.push({ locationId: loc.id, locationName: loc.name, revenue, expenses, netProfit });
        }

        const profitMarginPercent = totalRevenue > 0 ? (totalNetProfit / totalRevenue) * 100 : 0;

        const inventorySnapshot = computeInventorySnapshot(scope.locationId);

        const openLpoCount = scope.global
            ? mockDB.localPurchaseOrders.filter((l) => l.status === "ISSUED" || l.status === "RECEIVED").length
            : mockDB.localPurchaseOrders.filter((l) => l.locationId === scope.locationId && (l.status === "ISSUED" || l.status === "RECEIVED")).length;

        const pendingGrnCount = scope.global
            ? mockDB.goodsReceivedNotes.filter((g) => g.status === "PENDING").length
            : mockDB.goodsReceivedNotes.filter((g) => g.locationId === scope.locationId && g.status === "PENDING").length;

        const apBalance = (scope.global ? mockDB.financialEntries : mockDB.financialEntries.filter((e) => e.locationId === scope.locationId))
            .filter((e) => e.accountCode === "ACCOUNTS_PAYABLE")
            .reduce((s, e) => s + (e.credit - e.debit), 0);

        return {
            revenueSummary: {
                totalRevenue,
                totalExpenses,
                netProfit: totalNetProfit,
                profitMarginPercent,
            },
            inventoryHealth: {
                totalStockValue: inventorySnapshot.totalStockValue,
                lowStockAlertsCount: inventorySnapshot.lowStockAlertsCount,
            },
            procurementOverview: {
                openLpoCount,
                pendingGrnCount,
                outstandingPayables: apBalance,
            },
            locationComparison: scope.global ? locationComparison : [],
        };
    },

    // ── CEO: Executive Summary (aggregated, no raw data) ──────────────────
    async getExecutiveSummary(): Promise<ExecutiveSummary> {
        await delay();

        const ceo: AuthUser = {
            id: "system",
            name: "System",
            email: "system@local",
            role: "CEO",
            scope: { allLocations: true },
        };

        const now = new Date();
        const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
        const to = now.toISOString();
        const reports = await this.getExecutiveReports(ceo, { from, to });

        return {
            totalRevenue: reports.revenueSummary.totalRevenue,
            totalExpenses: reports.revenueSummary.totalExpenses,
            grossMargin: reports.revenueSummary.profitMarginPercent,
            inventoryValue: reports.inventoryHealth.totalStockValue,
            cashBalance: reports.revenueSummary.totalRevenue - reports.revenueSummary.totalExpenses,
            locationCount: mockDB.locations.filter((l) => l.status === "ACTIVE").length,
            userCount: mockDB.users.filter((u) => u.status === "ACTIVE").length,
            activeRequisitions: mockDB.requisitions.filter((r) => r.status === "SUBMITTED" || r.status === "APPROVED").length,
            unpaidInvoices: mockDB.vendorInvoices.filter((i) => i.status !== "PAID").length,
        };
    },

    // ── CEO: Branch Ranking ───────────────────────────────────────────────
    async getBranchRanking(): Promise<BranchRanking[]> {
        await delay();

        const ceo: AuthUser = {
            id: "system",
            name: "System",
            email: "system@local",
            role: "CEO",
            scope: { allLocations: true },
        };

        const now = new Date();
        const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
        const to = now.toISOString();

        const branches = mockDB.locations.filter((l) => l.type === "BRANCH" && l.status === "ACTIVE");
        const rows: BranchRanking[] = [];
        for (const loc of branches) {
            const pnl = await financeService.getProfitAndLoss(ceo, { from, to, locationId: loc.id });
            const expenses = pnl.cogs + pnl.operatingExpenses;
            const inventorySnapshot = computeInventorySnapshot(loc.id);
            const locStaff = mockDB.users.filter((u) => u.locationId === loc.id && u.status === "ACTIVE");

            rows.push({
                locationId: loc.id,
                locationName: loc.name,
                revenue: pnl.revenue,
                expenses,
                profit: pnl.netProfit,
                stockValue: inventorySnapshot.totalStockValue,
                staffCount: locStaff.length,
            });
        }

        return rows.sort((a, b) => b.profit - a.profit);
    },

    // ── CEO: Revenue Trend ────────────────────────────────────────────────
    async getRevenueTrend(): Promise<RevenueTrendPoint[]> {
        await delay();

        // Group ledger entries by date (day)
        const byDate: Record<string, { revenue: number; expenses: number }> = {};
        for (const e of mockDB.financialEntries) {
            const day = e.createdAt.split("T")[0];
            if (!byDate[day]) byDate[day] = { revenue: 0, expenses: 0 };

            if (e.accountCode === "REVENUE") {
                byDate[day].revenue += e.credit - e.debit;
                continue;
            }
            if (e.accountCode === "COGS" || e.accountCode.startsWith("OPEX:")) {
                byDate[day].expenses += e.debit - e.credit;
            }
        }

        return Object.entries(byDate)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([period, data]) => ({
                period,
                revenue: data.revenue,
                expenses: data.expenses,
                profit: data.revenue - data.expenses,
            }));
    },

    // ── Auditor: Full Audit Trail ─────────────────────────────────────────
    async getFullAuditTrail(): Promise<AuditTrailEntry[]> {
        await delay();

        return mockDB.auditLogs
            .map((log) => {
                const user = mockDB.users.find((u) => u.id === log.userId);
                return {
                    id: log.id,
                    timestamp: log.timestamp,
                    userName: user?.name ?? "System",
                    userRole: user?.role ?? "Unknown",
                    action: log.action,
                    entityType: log.entityType,
                    entityId: log.entityId,
                    changes: log.changes,
                    locationName: user?.locationId ? resolveLocationName(user.locationId) : "Global",
                };
            })
            .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    },

    // ── Auditor: Cross-Location Variance ──────────────────────────────────
    async getCrossLocationVariance(): Promise<CrossLocationVariance[]> {
        await delay();

        const branches = mockDB.locations.filter((l) => l.type === "BRANCH");
        const metrics: CrossLocationVariance[] = [];

        // Revenue variance
        const auditor: AuthUser = {
            id: "system",
            name: "System",
            email: "system@local",
            role: "SYSTEM_AUDITOR",
            scope: { allLocations: true },
        };
        const now = new Date();
        const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
        const to = now.toISOString();

        const revenueByLoc = [] as { locationName: string; value: number }[];
        const expenseByLoc = [] as { locationName: string; value: number }[];

        for (const loc of branches) {
            const pnl = await financeService.getProfitAndLoss(auditor, { from, to, locationId: loc.id });
            revenueByLoc.push({ locationName: loc.name, value: pnl.revenue });
            expenseByLoc.push({ locationName: loc.name, value: pnl.cogs + pnl.operatingExpenses });
        }

        const avgRevenue = revenueByLoc.reduce((s, r) => s + r.value, 0) / (revenueByLoc.length || 1);
        metrics.push({
            metric: "Revenue",
            locations: revenueByLoc,
            average: avgRevenue,
            maxVariance: Math.max(...revenueByLoc.map((r) => Math.abs(r.value - avgRevenue))),
        });

        // Expense variance
        const avgExpense = expenseByLoc.reduce((s, e) => s + e.value, 0) / (expenseByLoc.length || 1);
        metrics.push({
            metric: "Expenses",
            locations: expenseByLoc,
            average: avgExpense,
            maxVariance: Math.max(...expenseByLoc.map((e) => Math.abs(e.value - avgExpense))),
        });

        // Stock value variance
        const stockByLoc = branches.map((loc) => ({
            locationName: loc.name,
            value: computeInventorySnapshot(loc.id).totalStockValue,
        }));
        const avgStock = stockByLoc.reduce((s, sv) => s + sv.value, 0) / (stockByLoc.length || 1);
        metrics.push({
            metric: "Inventory Value",
            locations: stockByLoc,
            average: avgStock,
            maxVariance: Math.max(...stockByLoc.map((sv) => Math.abs(sv.value - avgStock))),
        });

        return metrics;
    },

    // ── Auditor: Entity Summary (read-only access to all entities) ────────
    async getEntitySummary(): Promise<{ entity: string; count: number }[]> {
        await delay();
        return [
            { entity: "Users", count: mockDB.users.length },
            { entity: "Locations", count: mockDB.locations.length },
            { entity: "Departments", count: mockDB.departments.length },
            { entity: "Inventory Items", count: mockDB.inventoryItems.length },
            { entity: "Location Stock Records", count: mockDB.locationStock.length },
            { entity: "Department Stock Records", count: mockDB.departmentStock.length },
            { entity: "Requisitions", count: mockDB.requisitions.length },
            { entity: "LPOs", count: mockDB.localPurchaseOrders.length },
            { entity: "GRNs", count: mockDB.goodsReceivedNotes.length },
            { entity: "Vendor Invoices", count: mockDB.vendorInvoices.length },
            { entity: "Payments", count: mockDB.payments.length },
            { entity: "Expenses", count: mockDB.expenses.length },
            { entity: "Sales", count: mockDB.sales.length },
            { entity: "Stock Transfers", count: mockDB.stockTransfers.length },
            { entity: "Vendors", count: mockDB.vendors.length },
            { entity: "Audit Logs", count: mockDB.auditLogs.length },
        ];
    },

    // ── Location-scoped summary (for GM/Finance) ──────────────────────────
    async getLocationSummary(user: AuthUser): Promise<{
        locationName: string;
        revenue: number;
        expenses: number;
        profit: number;
        stockValue: number;
        staffCount: number;
        pendingRequisitions: number;
        lowStockItems: number;
    }> {
        await delay();

        assertReportingRole(user);
        const scope = assertReportScope(user, undefined);
        if (!scope.locationId) throw new Error("No location assigned");

        const loc = mockDB.locations.find((l) => l.id === scope.locationId);
        const staff = mockDB.users.filter((u) => u.locationId === scope.locationId && u.status === "ACTIVE");
        const reqs = mockDB.requisitions.filter((r) => r.locationId === scope.locationId && (r.status === "SUBMITTED" || r.status === "APPROVED"));

        const now = new Date();
        const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
        const to = now.toISOString();
        const pnl = await financeService.getProfitAndLoss(user, { from, to, locationId: scope.locationId });
        const revenue = pnl.revenue;
        const totalExpenses = pnl.cogs + pnl.operatingExpenses;
        const inventorySnapshot = computeInventorySnapshot(scope.locationId);

        return {
            locationName: loc?.name ?? "Unknown",
            revenue,
            expenses: totalExpenses,
            profit: pnl.netProfit,
            stockValue: inventorySnapshot.totalStockValue,
            staffCount: staff.length,
            pendingRequisitions: reqs.length,
            lowStockItems: inventorySnapshot.lowStockAlertsCount,
        };
    },
};
