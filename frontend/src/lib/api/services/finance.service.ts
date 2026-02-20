/**
 * DOMAIN 3: Finance Engine
 * AP aging, expense tracking, cashflow, budget vs actual, payment tracking.
 * All scope-filtered. Mutations guarded for read-only roles.
 */

import { mockDB } from "../../mock-db";
import type { AuthUser } from "@/lib/auth/types";
import {
    assertCanMutate,
    assertLocationAccess,
    scopeFilterByLocation,
    hasGlobalScope,
} from "./_guards";
import { normalizeRole, Role } from "@/lib/auth/roles";
import { withAuditGuard } from "./_auditGuard";
import { AuthorizationError, DomainError, InvariantViolationError, LifecycleViolationError } from "@/lib/runtime/errors";

const DELAY = 300;
const delay = () => new Promise((r) => setTimeout(r, DELAY));

// ─── TYPES ───────────────────────────────────────────────────────────────────

export interface FinanceKPIs {
    totalPayables: number;
    totalPaid: number;
    overdueInvoices: number;
    pendingApprovals: number;
    totalExpenses: number;
    totalRevenue: number;
    netCashflow: number;
}

export interface APAgingRow {
    bucket: string;
    amount: number;
    invoiceCount: number;
}

export interface ExpenseRow {
    id: string;
    locationName: string;
    departmentName: string;
    categoryName: string;
    amount: number;
    description: string;
    date: string;
}

export interface PaymentRow {
    id: string;
    invoiceId: string;
    vendorName: string;
    amount: number;
    paymentMethod: string;
    paidAt: string;
    reference: string;
}

export interface BudgetVsActualRow {
    categoryName: string;
    budgeted: number;
    actual: number;
    variance: number;
    variancePercent: number;
}

export interface CashflowRow {
    period: string;
    inflow: number;
    outflow: number;
    net: number;
}

export interface InvoiceRow {
    id: string;
    vendorName: string;
    locationName: string;
    amount: number;
    dueDate: string;
    status: string;
    daysOverdue: number;
}

// ─── HELPERS ─────────────────────────────────────────────────────────────────

function resolveLocationName(id: string) { return mockDB.locations.find((l) => l.id === id)?.name ?? "Unknown"; }
function resolveDeptName(id?: string) { return id ? (mockDB.departments.find((d) => d.id === id)?.name ?? "—") : "—"; }
function resolveCategoryName(id: string) { return mockDB.categories.find((c) => c.id === id)?.name ?? "General"; }
function resolveVendorName(id: string) { return mockDB.vendors.find((v) => v.id === id)?.name ?? "Unknown"; }
function resolvePaymentMethodName(id: string) { return mockDB.paymentMethods.find((p) => p.id === id)?.name ?? "Unknown"; }

function daysBetween(dateStr: string, now: Date): number {
    const d = new Date(dateStr);
    return Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
}

function assertFinanceRole(user: AuthUser, allowed: Role[]) {
    const role = normalizeRole(user.role);
    if (!role || !allowed.includes(role)) {
        throw new AuthorizationError(`[RBAC] Role "${user.role}" is not permitted to perform this action.`, {
            metadata: { userId: user.id, role: user.role },
        });
    }
}

function makeTraceId(prefix = "tr"): string {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function getExistingTraceId(entityType: string, entityId: string): string | undefined {
    // Most recent trace for this entity
    for (let i = mockDB.auditLogs.length - 1; i >= 0; i--) {
        const log = mockDB.auditLogs[i];
        if (log.entityType === entityType && log.entityId === entityId && log.referenceChainId) return log.referenceChainId;
    }
    return undefined;
}

function createAuditLog(params: {
    user: AuthUser;
    entityType: string;
    entityId: string;
    action?: string;
    changes: string;
    at: string;
    referenceChainId?: string;
    locationId?: string;
    beforeState?: unknown;
    afterState?: unknown;
    metadata?: Record<string, unknown>;
}) {
    mockDB.auditLogs.push({
        id: `aud_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        userId: params.user.id,
        actorRole: params.user.role,
        actorLocationId: params.user.scope.locationId,
        action: params.action ?? "CREATE",
        entityType: params.entityType,
        entityId: params.entityId,
        changes: params.changes,
        referenceChainId: params.referenceChainId,
        locationId: params.locationId,
        beforeState: params.beforeState,
        afterState: params.afterState,
        metadata: params.metadata,
        timestamp: params.at,
    });
}

const ACCOUNT = {
    CASH: "CASH",
    BANK: "BANK",
    MOBILE_MONEY: "MOBILE_MONEY",
    CARD: "CARD",
    ACCOUNTS_PAYABLE: "ACCOUNTS_PAYABLE",
    REVENUE: "REVENUE",
    COGS: "COGS",
    OPEX_PREFIX: "OPEX:",
} as const;

function cashAccountForMethod(paymentMethodId: string): string {
    const pm = mockDB.paymentMethods.find((p) => p.id === paymentMethodId);
    switch (pm?.type) {
        case "BANK":
            return ACCOUNT.BANK;
        case "MOBILE_MONEY":
            return ACCOUNT.MOBILE_MONEY;
        case "CARD":
            return ACCOUNT.CARD;
        case "CASH":
        default:
            return ACCOUNT.CASH;
    }
}

function assertBalanced(lines: { debit: number; credit: number }[]) {
    const totalDebit = lines.reduce((s, l) => s + l.debit, 0);
    const totalCredit = lines.reduce((s, l) => s + l.credit, 0);
    if (totalDebit !== totalCredit) {
        throw new InvariantViolationError("[Ledger] Double-entry imbalance", {
            metadata: { totalDebit, totalCredit },
        });
    }
}

function assertIdempotent(referenceType: string, referenceId: string) {
    const exists = mockDB.financialEntries.some((e) => e.referenceType === referenceType && e.referenceId === referenceId);
    if (exists) {
        throw new InvariantViolationError("[Ledger] Entries already posted for this reference", {
            metadata: { referenceType, referenceId },
        });
    }
}

function postDoubleEntry(params: {
    user: AuthUser;
    locationId: string;
    referenceType: "INVOICE" | "PAYMENT" | "EXPENSE" | "EXPENSE_PAYMENT" | "SALE" | "REVERSAL";
    referenceId: string;
    lines: { accountCode: string; debit: number; credit: number }[];
    referenceChainId?: string;
}): { entryIds: string[] } {
    assertBalanced(params.lines);
    assertLocationAccess(params.user, params.locationId);
    assertIdempotent(params.referenceType, params.referenceId);

    const ts = new Date().toISOString();
    const entryIds: string[] = [];
    for (const line of params.lines) {
        const id = `fe_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
        mockDB.financialEntries.push({
            id,
            locationId: params.locationId,
            accountCode: line.accountCode,
            debit: line.debit,
            credit: line.credit,
            referenceType: params.referenceType,
            referenceId: params.referenceId,
            createdAt: ts,
        });
        entryIds.push(id);
        createAuditLog({
            user: params.user,
            entityType: "FINANCIAL_ENTRY",
            entityId: id,
            action: "CREATE",
            changes: JSON.stringify({ ...line, locationId: params.locationId, referenceType: params.referenceType, referenceId: params.referenceId }),
            at: ts,
            referenceChainId: params.referenceChainId,
            locationId: params.locationId,
        });
    }
    return { entryIds };
}

// ─── SERVICE ─────────────────────────────────────────────────────────────────

export const financeService = {

    // ── KPIs (scope-filtered) ─────────────────────────────────────────────
    async getKPIs(user: AuthUser): Promise<FinanceKPIs> {
        await delay();
        const invoices = scopeFilterByLocation(user, mockDB.vendorInvoices);
        const expenses = scopeFilterByLocation(user, mockDB.expenses);
        const sales = scopeFilterByLocation(user, mockDB.sales);

        const unpaid = invoices.filter((i) => i.status !== "PAID");
        const now = new Date();
        const overdue = unpaid.filter((i) => new Date(i.dueDate) < now);

        const totalPayables = unpaid.reduce((s, i) => s + i.amount, 0);
        const totalPaid = invoices.filter((i) => i.status === "PAID").reduce((s, i) => s + i.amount, 0);
        const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0);
        const totalRevenue = sales.reduce((s, s2) => s + s2.netAmount, 0);

        return {
            totalPayables,
            totalPaid,
            overdueInvoices: overdue.length,
            pendingApprovals: invoices.filter((i) => i.status === "PENDING").length,
            totalExpenses,
            totalRevenue,
            netCashflow: totalRevenue - totalExpenses - totalPaid,
        };
    },

    async getAPAging(user: AuthUser): Promise<APAgingRow[]> {
        await delay();
        const invoices = scopeFilterByLocation(user, mockDB.vendorInvoices).filter((i) => i.status !== "PAID");
        const now = new Date();

        const buckets: { label: string; from: number; to: number }[] = [
            { label: "0-30", from: 0, to: 30 },
            { label: "31-60", from: 31, to: 60 },
            { label: "61-90", from: 61, to: 90 },
            { label: "90+", from: 91, to: Number.POSITIVE_INFINITY },
        ];

        return buckets.map((b) => {
            const hits = invoices.filter((i) => {
                const days = Math.max(0, daysBetween(i.dueDate, now));
                return days >= b.from && days <= b.to;
            });
            return {
                bucket: b.label,
                amount: hits.reduce((s, i) => s + i.amount, 0),
                invoiceCount: hits.length,
            };
        });
    },

    async getInvoices(user: AuthUser): Promise<InvoiceRow[]> {
        await delay();
        const now = new Date();
        return scopeFilterByLocation(user, mockDB.vendorInvoices).map((i) => ({
            id: i.id,
            vendorName: resolveVendorName(i.vendorId),
            locationName: resolveLocationName(i.locationId),
            amount: i.amount,
            dueDate: i.dueDate,
            status: i.status,
            daysOverdue: Math.max(0, daysBetween(i.dueDate, now)),
        }));
    },

    async getExpenses(user: AuthUser): Promise<ExpenseRow[]> {
        await delay();
        return scopeFilterByLocation(user, mockDB.expenses).map((e) => ({
            id: e.id,
            locationName: resolveLocationName(e.locationId),
            departmentName: resolveDeptName(e.departmentId),
            categoryName: resolveCategoryName(e.categoryId),
            amount: e.amount,
            description: e.description,
            date: e.date,
        }));
    },

    async createExpense(
        user: AuthUser,
        input: { locationId: string; categoryId: string; amount: number; description: string; paymentMethodId?: string; reference?: string; departmentId?: string }
    ): Promise<ExpenseRow> {
        return withAuditGuard(async (ctx) => {
            assertCanMutate(user);
            assertFinanceRole(user, [Role.FINANCE_MANAGER, Role.GENERAL_MANAGER]);
            assertLocationAccess(user, input.locationId);
            await delay();

            const ts = new Date().toISOString();
            const referenceChainId = makeTraceId("tr_fin");
            ctx.referenceChainId = referenceChainId;

            const exp = {
                id: `exp_${Date.now()}`,
                locationId: input.locationId,
                departmentId: input.departmentId,
                categoryId: input.categoryId,
                amount: input.amount,
                description: input.description,
                date: ts.split("T")[0],
                status: input.paymentMethodId ? ("PAID" as const) : ("UNPAID" as const),
                paidAt: input.paymentMethodId ? ts : undefined,
                paymentId: undefined as string | undefined,
            };

            mockDB.expenses.push(exp);

            const expenseAccount = `${ACCOUNT.OPEX_PREFIX}${input.categoryId}`;
            if (input.paymentMethodId) {
                // paid immediately: OPEX Dr, CASH Cr
                postDoubleEntry({
                    user,
                    locationId: input.locationId,
                    referenceType: "EXPENSE",
                    referenceId: exp.id,
                    lines: [
                        { accountCode: expenseAccount, debit: input.amount, credit: 0 },
                        { accountCode: cashAccountForMethod(input.paymentMethodId), debit: 0, credit: input.amount },
                    ],
                    referenceChainId,
                });
            } else {
                // unpaid: OPEX Dr, AP Cr
                postDoubleEntry({
                    user,
                    locationId: input.locationId,
                    referenceType: "EXPENSE",
                    referenceId: exp.id,
                    lines: [
                        { accountCode: expenseAccount, debit: input.amount, credit: 0 },
                        { accountCode: ACCOUNT.ACCOUNTS_PAYABLE, debit: 0, credit: input.amount },
                    ],
                    referenceChainId,
                });
            }

            createAuditLog({
                user,
                entityType: "EXPENSE",
                entityId: exp.id,
                action: "CREATE",
                changes: JSON.stringify(input),
                at: ts,
                referenceChainId,
                locationId: input.locationId,
                beforeState: null,
                afterState: structuredClone(exp),
            });

            return {
                id: exp.id,
                locationName: resolveLocationName(exp.locationId),
                departmentName: resolveDeptName(exp.departmentId),
                categoryName: resolveCategoryName(exp.categoryId),
                amount: exp.amount,
                description: exp.description,
                date: exp.date,
            };
        }, {
            actorId: user.id,
            actorRole: user.role,
            locationId: input.locationId,
            entityType: "EXPENSE",
            action: "CREATE",
        });
    },

    async payExpense(user: AuthUser, input: { expenseId: string; paymentMethodId: string; reference: string }): Promise<{ paymentId: string }> {
        return withAuditGuard(async (ctx) => {
            assertCanMutate(user);
            assertFinanceRole(user, [Role.FINANCE_MANAGER, Role.GENERAL_MANAGER]);
            await delay();

        const exp = mockDB.expenses.find((e) => e.id === input.expenseId);
        if (!exp) throw new DomainError("Expense not found", { metadata: { expenseId: input.expenseId } });
        assertLocationAccess(user, exp.locationId);
        if (exp.status === "PAID") throw new LifecycleViolationError("Expense is already PAID", { metadata: { expenseId: exp.id } });

            const beforeExpense = structuredClone(exp);
            const referenceChainId = getExistingTraceId("EXPENSE", exp.id) ?? makeTraceId("tr_fin");
            ctx.referenceChainId = referenceChainId;
            const ts = new Date().toISOString();
            const paymentId = `expay_${Date.now()}`;

            mockDB.expensePayments.push({
            id: paymentId,
            expenseId: exp.id,
            locationId: exp.locationId,
            paymentMethodId: input.paymentMethodId,
            amount: exp.amount,
            reference: input.reference,
            paidAt: ts,
        });

        // EXPENSE_PAYMENT: AP Dr, CASH Cr
            postDoubleEntry({
            user,
            locationId: exp.locationId,
            referenceType: "EXPENSE_PAYMENT",
            referenceId: paymentId,
            lines: [
                { accountCode: ACCOUNT.ACCOUNTS_PAYABLE, debit: exp.amount, credit: 0 },
                { accountCode: cashAccountForMethod(input.paymentMethodId), debit: 0, credit: exp.amount },
            ],
            referenceChainId,
        });

            exp.status = "PAID";
            exp.paidAt = ts;
            exp.paymentId = paymentId;

            createAuditLog({
            user,
            entityType: "EXPENSE_PAYMENT",
            entityId: paymentId,
            action: "CREATE",
            changes: JSON.stringify(input),
            at: ts,
            referenceChainId,
            locationId: exp.locationId,
            beforeState: null,
            afterState: structuredClone(mockDB.expensePayments.find((p) => p.id === paymentId)),
        });

        createAuditLog({
            user,
            entityType: "EXPENSE",
            entityId: exp.id,
            action: "TRANSITION",
            changes: JSON.stringify({ status: `${beforeExpense.status}->PAID`, paymentId }),
            at: ts,
            referenceChainId,
            locationId: exp.locationId,
            beforeState: beforeExpense,
            afterState: structuredClone(exp),
        });

            return { paymentId };
        }, {
            actorId: user.id,
            actorRole: user.role,
            locationId: user.scope.locationId,
            entityType: "EXPENSE_PAYMENT",
            action: "CREATE",
        });
    },

    async approveInvoice(user: AuthUser, invoiceId: string): Promise<void> {
        return withAuditGuard(async (ctx) => {
            assertCanMutate(user);
            assertFinanceRole(user, [Role.FINANCE_MANAGER, Role.GENERAL_MANAGER]);
            await delay();

        const inv = mockDB.vendorInvoices.find((i) => i.id === invoiceId);
        if (!inv) throw new DomainError("Invoice not found", { metadata: { invoiceId } });
        assertLocationAccess(user, inv.locationId);
        if (inv.status !== "PENDING") {
            throw new LifecycleViolationError(`Cannot approve invoice: status is "${inv.status}", must be "PENDING".`, {
                metadata: { invoiceId: inv.id, status: inv.status },
            });
        }

        const grn = inv.grnId ? mockDB.goodsReceivedNotes.find((g) => g.id === inv.grnId) : null;
        if (!grn) throw new DomainError("[3-Way Match] Invoice must reference a GRN", { metadata: { invoiceId: inv.id, grnId: inv.grnId } });
        if (grn.locationId !== inv.locationId) {
            throw new DomainError("[3-Way Match] GRN location must match invoice location", {
                metadata: { invoiceId: inv.id, grnLocationId: grn.locationId, invoiceLocationId: inv.locationId },
            });
        }
        if (grn.status !== "RECEIVED") {
            throw new LifecycleViolationError(`[3-Way Match] GRN status is "${grn.status}", must be "RECEIVED".`, {
                metadata: { invoiceId: inv.id, grnId: grn.id, grnStatus: grn.status },
            });
        }

        const lpo = mockDB.localPurchaseOrders.find((l) => l.id === grn.lpoId);
        if (!lpo) throw new DomainError("[3-Way Match] GRN must reference an LPO", { metadata: { invoiceId: inv.id, grnId: grn.id, lpoId: grn.lpoId } });
        if (lpo.locationId !== inv.locationId) {
            throw new DomainError("[3-Way Match] LPO location must match invoice location", {
                metadata: { invoiceId: inv.id, lpoLocationId: lpo.locationId, invoiceLocationId: inv.locationId },
            });
        }
        if (lpo.status === "DRAFT" || lpo.status === "CANCELLED") {
            throw new LifecycleViolationError(`[3-Way Match] LPO status is "${lpo.status}", must be issued.`, {
                metadata: { invoiceId: inv.id, lpoId: lpo.id, lpoStatus: lpo.status },
            });
        }

        if (inv.amount !== grn.totalAmount) {
            throw new DomainError("[3-Way Match] Invoice amount must match GRN total", {
                metadata: { invoiceId: inv.id, invoiceAmount: inv.amount, grnTotalAmount: grn.totalAmount },
            });
        }
        if (inv.amount > lpo.totalAmount) {
            throw new DomainError("[3-Way Match] Invoice amount cannot exceed LPO total", {
                metadata: { invoiceId: inv.id, invoiceAmount: inv.amount, lpoTotalAmount: lpo.totalAmount },
            });
        }

            const referenceChainId = getExistingTraceId("SUPPLIER_INVOICE", inv.id) ?? makeTraceId("tr_fin");
            ctx.referenceChainId = referenceChainId;
            const beforeInvoice = structuredClone(inv);

        // INVOICE: COGS Dr, AP Cr
            postDoubleEntry({
            user,
            locationId: inv.locationId,
            referenceType: "INVOICE",
            referenceId: inv.id,
            lines: [
                { accountCode: ACCOUNT.COGS, debit: inv.amount, credit: 0 },
                { accountCode: ACCOUNT.ACCOUNTS_PAYABLE, debit: 0, credit: inv.amount },
            ],
            referenceChainId,
        });

            const prev = inv.status;
            inv.status = "APPROVED";
            const ts = new Date().toISOString();
            createAuditLog({
            user,
            entityType: "SUPPLIER_INVOICE",
            entityId: inv.id,
            action: "TRANSITION",
            changes: JSON.stringify({ status: `${prev}->APPROVED` }),
            at: ts,
            referenceChainId,
            locationId: inv.locationId,
            beforeState: beforeInvoice,
            afterState: structuredClone(inv),
        });
        }, {
            actorId: user.id,
            actorRole: user.role,
            locationId: user.scope.locationId,
            entityType: "SUPPLIER_INVOICE",
            action: "APPROVE",
        });
    },

    async payInvoice(user: AuthUser, input: { invoiceId: string; amount: number; paymentMethodId: string; reference: string }): Promise<PaymentRow> {
        return withAuditGuard(async (ctx) => {
            assertCanMutate(user);
            assertFinanceRole(user, [Role.FINANCE_MANAGER, Role.GENERAL_MANAGER]);
            await delay();

        const inv = mockDB.vendorInvoices.find((i) => i.id === input.invoiceId);
        if (!inv) throw new DomainError("Invoice not found", { metadata: { invoiceId: input.invoiceId } });
        assertLocationAccess(user, inv.locationId);
        if (inv.status === "PAID") throw new LifecycleViolationError("Invoice is already PAID", { metadata: { invoiceId: inv.id } });
        if (inv.status !== "APPROVED") {
            throw new LifecycleViolationError(`Cannot pay invoice: status is "${inv.status}", must be "APPROVED".`, {
                metadata: { invoiceId: inv.id, status: inv.status },
            });
        }
        if (input.amount !== inv.amount) {
            throw new DomainError("Payment amount must match invoice amount", {
                metadata: { invoiceId: inv.id, amount: input.amount, invoiceAmount: inv.amount },
            });
        }

        const existingPay = mockDB.payments.find((p) => p.invoiceId === inv.id);
        if (existingPay) throw new LifecycleViolationError("Invoice is already PAID", { metadata: { invoiceId: inv.id } });

            const beforeInvoice = structuredClone(inv);
            const referenceChainId = getExistingTraceId("SUPPLIER_INVOICE", inv.id) ?? makeTraceId("tr_fin");
            ctx.referenceChainId = referenceChainId;
            const ts = new Date().toISOString();
            const paymentId = `pay_${Date.now()}`;

            mockDB.payments.push({
            id: paymentId,
            invoiceId: input.invoiceId,
            amount: input.amount,
            paymentMethodId: input.paymentMethodId,
            paidAt: ts,
            reference: input.reference,
        });

        // PAYMENT: AP Dr, CASH Cr
            postDoubleEntry({
            user,
            locationId: inv.locationId,
            referenceType: "PAYMENT",
            referenceId: paymentId,
            lines: [
                { accountCode: ACCOUNT.ACCOUNTS_PAYABLE, debit: input.amount, credit: 0 },
                { accountCode: cashAccountForMethod(input.paymentMethodId), debit: 0, credit: input.amount },
            ],
            referenceChainId,
        });

            inv.status = "PAID";

            createAuditLog({
            user,
            entityType: "PAYMENT",
            entityId: paymentId,
            action: "CREATE",
            changes: JSON.stringify(input),
            at: ts,
            referenceChainId,
            locationId: inv.locationId,
            beforeState: null,
            afterState: structuredClone(mockDB.payments.find((p) => p.id === paymentId)),
        });

        createAuditLog({
            user,
            entityType: "SUPPLIER_INVOICE",
            entityId: inv.id,
            action: "TRANSITION",
            changes: JSON.stringify({ status: `${beforeInvoice.status}->PAID`, paymentId }),
            at: ts,
            referenceChainId,
            locationId: inv.locationId,
            beforeState: beforeInvoice,
            afterState: structuredClone(inv),
        });

            return {
            id: paymentId,
            invoiceId: inv.id,
            vendorName: resolveVendorName(inv.vendorId),
            amount: input.amount,
            paymentMethod: resolvePaymentMethodName(input.paymentMethodId),
            paidAt: ts,
            reference: input.reference,
        };
        }, {
            actorId: user.id,
            actorRole: user.role,
            locationId: user.scope.locationId,
            entityType: "PAYMENT",
            action: "CREATE",
        });
    },

    async postRevenueFromSales(user: AuthUser, input: { locationId: string; from: string; to: string; paymentMethodId: string }): Promise<{ referenceId: string }> {
        return withAuditGuard(async (ctx) => {
            assertCanMutate(user);
            assertFinanceRole(user, [Role.FINANCE_MANAGER, Role.GENERAL_MANAGER]);
            assertLocationAccess(user, input.locationId);
            await delay();

        const fromD = new Date(input.from).getTime();
        const toD = new Date(input.to).getTime();
        const sales = mockDB.sales.filter((s) => s.locationId === input.locationId).filter((s) => {
            const t = new Date(s.soldAt).getTime();
            return t >= fromD && t <= toD;
        });

        const total = sales.reduce((s, r) => s + r.netAmount, 0);
        if (total <= 0) throw new DomainError("No sales found for period", { metadata: { locationId: input.locationId, from: input.from, to: input.to } });

        const referenceId = `sale_${input.locationId}_${fromD}_${toD}`;
        // idempotency guard (ledger-level)
        const exists = mockDB.financialEntries.some((e) => e.referenceType === "SALE" && e.referenceId === referenceId);
        if (exists) throw new InvariantViolationError("Sales revenue already posted", { metadata: { referenceId } });

        const referenceChainId = makeTraceId("tr_fin");
        ctx.referenceChainId = referenceChainId;
        postDoubleEntry({
            user,
            locationId: input.locationId,
            referenceType: "SALE",
            referenceId,
            lines: [
                { accountCode: cashAccountForMethod(input.paymentMethodId), debit: total, credit: 0 },
                { accountCode: ACCOUNT.REVENUE, debit: 0, credit: total },
            ],
            referenceChainId,
        });

        return { referenceId };
        }, {
            actorId: user.id,
            actorRole: user.role,
            locationId: input.locationId,
            entityType: "SALE",
            action: "POST_REVENUE",
        });
    },

    async postManualReversal(
        user: AuthUser,
        input: { locationId: string; reversalId: string; lines: { accountCode: string; debit: number; credit: number }[] }
    ): Promise<{ entryIds: string[] }> {
        return withAuditGuard(async (ctx) => {
            assertCanMutate(user);
            assertFinanceRole(user, [Role.FINANCE_MANAGER, Role.GENERAL_MANAGER]);
            assertLocationAccess(user, input.locationId);
            await delay();

            const referenceChainId = makeTraceId("tr_fin");
            ctx.referenceChainId = referenceChainId;
            return postDoubleEntry({
                user,
                locationId: input.locationId,
                referenceType: "REVERSAL",
                referenceId: input.reversalId,
                lines: input.lines,
                referenceChainId,
            });
        }, {
            actorId: user.id,
            actorRole: user.role,
            locationId: input.locationId,
            entityType: "REVERSAL",
            action: "POST_MANUAL_REVERSAL",
        });
    },

    async reversePostedReference(
        user: AuthUser,
        input: { locationId: string; referenceType: "INVOICE" | "PAYMENT" | "EXPENSE" | "EXPENSE_PAYMENT" | "SALE"; referenceId: string }
    ): Promise<{ reversalId: string }> {
        return withAuditGuard(async (ctx) => {
            assertCanMutate(user);
            assertFinanceRole(user, [Role.FINANCE_MANAGER, Role.GENERAL_MANAGER]);
            assertLocationAccess(user, input.locationId);
            await delay();

        const original = mockDB.financialEntries.filter(
            (e) => e.locationId === input.locationId && e.referenceType === input.referenceType && e.referenceId === input.referenceId
        );
        if (original.length === 0) {
            throw new DomainError("No ledger entries found to reverse", {
                metadata: { locationId: input.locationId, referenceType: input.referenceType, referenceId: input.referenceId },
            });
        }

        const reversalId = `rev_${Date.now()}`;
        const referenceChainId = makeTraceId("tr_fin");
        ctx.referenceChainId = referenceChainId;
        postDoubleEntry({
            user,
            locationId: input.locationId,
            referenceType: "REVERSAL",
            referenceId: reversalId,
            lines: original.map((e) => ({ accountCode: e.accountCode, debit: e.credit, credit: e.debit })),
            referenceChainId,
        });

        createAuditLog({
            user,
            entityType: "LEDGER_REVERSAL",
            entityId: reversalId,
            action: "CREATE",
            changes: JSON.stringify({ ...input, reversalId }),
            at: new Date().toISOString(),
            referenceChainId,
            locationId: input.locationId,
            beforeState: null,
            afterState: { ...input, reversalId },
        });

        return { reversalId };
        }, {
            actorId: user.id,
            actorRole: user.role,
            locationId: input.locationId,
            entityType: "LEDGER_REVERSAL",
            action: "REVERSE_REFERENCE",
        });
    },

    async getProfitAndLoss(
        user: AuthUser,
        input: { from: string; to: string; locationId?: string }
    ): Promise<{ revenue: number; cogs: number; operatingExpenses: number; grossProfit: number; netProfit: number }> {
        await delay();
        const locationId = input.locationId;
        if (locationId) assertLocationAccess(user, locationId);
        const fromD = new Date(input.from).getTime();
        const toD = new Date(input.to).getTime();

        const entries = mockDB.financialEntries.filter((e) => {
            if (!hasGlobalScope(user) && e.locationId !== user.scope.locationId) return false;
            if (locationId && e.locationId !== locationId) return false;
            const t = new Date(e.createdAt).getTime();
            return t >= fromD && t <= toD;
        });

        const revenue = entries.filter((e) => e.accountCode === ACCOUNT.REVENUE).reduce((s, e) => s + e.credit - e.debit, 0);
        const cogs = entries.filter((e) => e.accountCode === ACCOUNT.COGS).reduce((s, e) => s + e.debit - e.credit, 0);
        const operatingExpenses = entries
            .filter((e) => e.accountCode.startsWith(ACCOUNT.OPEX_PREFIX))
            .reduce((s, e) => s + e.debit - e.credit, 0);

        const grossProfit = revenue - cogs;
        const netProfit = grossProfit - operatingExpenses;
        return { revenue, cogs, operatingExpenses, grossProfit, netProfit };
    },

    async getCashFlowReport(
        user: AuthUser,
        input: { from: string; to: string; locationId?: string }
    ): Promise<{ cashFromSales: number; cashPaidToSuppliers: number; cashPaidForExpenses: number; netCashMovement: number }> {
        await delay();
        const locationId = input.locationId;
        if (locationId) assertLocationAccess(user, locationId);
        const fromD = new Date(input.from).getTime();
        const toD = new Date(input.to).getTime();

        const cashAccounts: Set<string> = new Set([ACCOUNT.CASH, ACCOUNT.BANK, ACCOUNT.MOBILE_MONEY, ACCOUNT.CARD]);
        const entries = mockDB.financialEntries.filter((e) => {
            if (!cashAccounts.has(e.accountCode)) return false;
            if (!hasGlobalScope(user) && e.locationId !== user.scope.locationId) return false;
            if (locationId && e.locationId !== locationId) return false;
            const t = new Date(e.createdAt).getTime();
            return t >= fromD && t <= toD;
        });

        const cashFromSales = entries.filter((e) => e.referenceType === "SALE").reduce((s, e) => s + e.debit - e.credit, 0);
        const cashPaidToSuppliers = entries.filter((e) => e.referenceType === "PAYMENT").reduce((s, e) => s + e.credit - e.debit, 0);
        const cashPaidForExpenses = entries
            .filter((e) => e.referenceType === "EXPENSE_PAYMENT" || e.referenceType === "EXPENSE")
            .reduce((s, e) => s + e.credit - e.debit, 0);
        const netCashMovement = entries.reduce((s, e) => s + (e.debit - e.credit), 0);

        return { cashFromSales, cashPaidToSuppliers, cashPaidForExpenses, netCashMovement };
    },

    async getExpenditureVsIncome(
        user: AuthUser,
        input: { from: string; to: string; locationId?: string }
    ): Promise<{ totalIncome: number; totalExpenses: number; netPosition: number; expenseBreakdown: { categoryId: string; amount: number }[] }> {
        await delay();
        const locationId = input.locationId;
        if (locationId) assertLocationAccess(user, locationId);
        const fromD = new Date(input.from).getTime();
        const toD = new Date(input.to).getTime();

        const entries = mockDB.financialEntries.filter((e) => {
            if (!hasGlobalScope(user) && e.locationId !== user.scope.locationId) return false;
            if (locationId && e.locationId !== locationId) return false;
            const t = new Date(e.createdAt).getTime();
            return t >= fromD && t <= toD;
        });

        const totalIncome = entries.filter((e) => e.accountCode === ACCOUNT.REVENUE).reduce((s, e) => s + e.credit - e.debit, 0);
        const totalExpenses = entries
            .filter((e) => e.accountCode === ACCOUNT.COGS || e.accountCode.startsWith(ACCOUNT.OPEX_PREFIX))
            .reduce((s, e) => s + e.debit - e.credit, 0);
        const netPosition = totalIncome - totalExpenses;

        const byCat: Record<string, number> = {};
        for (const e of entries) {
            if (!e.accountCode.startsWith(ACCOUNT.OPEX_PREFIX)) continue;
            const categoryId = e.accountCode.slice(ACCOUNT.OPEX_PREFIX.length);
            byCat[categoryId] = (byCat[categoryId] ?? 0) + (e.debit - e.credit);
        }
        const expenseBreakdown = Object.entries(byCat).map(([categoryId, amount]) => ({ categoryId, amount }));
        return { totalIncome, totalExpenses, netPosition, expenseBreakdown };
    },

    async getBudgetVsActual(user: AuthUser): Promise<BudgetVsActualRow[]> {
        await delay();
        const expenses = scopeFilterByLocation(user, mockDB.expenses);

        const budgets: Record<string, number> = {
            "Beverages": 800000,
            "Dairy": 400000,
            "Meat & Poultry": 1500000,
            "Fresh Produce": 600000,
            "Spirits & Alcohol": 900000,
            "Cleaning Supplies": 350000,
        };

        const actuals: Record<string, number> = {};
        for (const e of expenses) {
            const catName = resolveCategoryName(e.categoryId);
            actuals[catName] = (actuals[catName] ?? 0) + e.amount;
        }

        const allCats = new Set([...Object.keys(budgets), ...Object.keys(actuals)]);
        return Array.from(allCats).map((cat) => {
            const budgeted = budgets[cat] ?? 0;
            const actual = actuals[cat] ?? 0;
            const variance = budgeted - actual;
            const variancePercent = budgeted > 0 ? (variance / budgeted) * 100 : 0;
            return { categoryName: cat, budgeted, actual, variance, variancePercent };
        });
    },

    async getCashflowSummary(user: AuthUser): Promise<CashflowRow[]> {
        await delay();
        const sales = scopeFilterByLocation(user, mockDB.sales);
        const expenses = scopeFilterByLocation(user, mockDB.expenses);

        const byDate: Record<string, { inflow: number; outflow: number }> = {};

        for (const s of sales) {
            const date = s.soldAt.split("T")[0];
            if (!byDate[date]) byDate[date] = { inflow: 0, outflow: 0 };
            byDate[date].inflow += s.netAmount;
        }

        for (const e of expenses) {
            const date = e.date;
            if (!byDate[date]) byDate[date] = { inflow: 0, outflow: 0 };
            byDate[date].outflow += e.amount;
        }

        return Object.entries(byDate)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([period, data]) => ({
                period,
                inflow: data.inflow,
                outflow: data.outflow,
                net: data.inflow - data.outflow,
            }));
    },

    async getExpenseBreakdown(user: AuthUser): Promise<{ categoryName: string; amount: number; percentage: number }[]> {
        await delay();
        const expenses = scopeFilterByLocation(user, mockDB.expenses);
        const total = expenses.reduce((s, e) => s + e.amount, 0);

        const byCat: Record<string, number> = {};
        for (const e of expenses) {
            const catName = resolveCategoryName(e.categoryId);
            byCat[catName] = (byCat[catName] ?? 0) + e.amount;
        }

        return Object.entries(byCat)
            .map(([categoryName, amount]) => ({
                categoryName,
                amount,
                percentage: total > 0 ? (amount / total) * 100 : 0,
            }))
            .sort((a, b) => b.amount - a.amount);
    },
};
