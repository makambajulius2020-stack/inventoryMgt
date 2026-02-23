/**
 * DOMAIN 2: Procurement Lifecycle
 * Full flow: Requisition → LPO → GRN → VendorInvoice → Payment
 * Status transitions enforced in service layer.
 * Scope filtering by locationId / departmentId.
 * Mutations blocked for read-only roles.
 */

import {
    mockDB,
    type RequisitionStatus,
    type LPOStatus,
    type GRNStatus,
    type InvoiceStatus,
    type PaymentRequestStatus,
} from "../../mock-db";
import type { AuthUser } from "@/lib/auth/types";
import { Role, normalizeRole } from "@/lib/auth/roles";
import {
    assertCanMutate,
    assertLocationAccess,
    scopeFilterByLocation,
    scopeFilterByDepartment,
    hasGlobalScope,
} from "./_guards";
import { withAuditGuard } from "./_auditGuard";
import { AuthorizationError, DomainError, InvariantViolationError, LifecycleViolationError } from "@/lib/runtime/errors";

const DELAY = 300;
const delay = () => new Promise((r) => setTimeout(r, DELAY));

// ─── TYPES ───────────────────────────────────────────────────────────────────

export interface RequisitionRow {
    id: string;
    locationName: string;
    departmentName: string;
    requestedByName: string;
    totalAmount: number;
    status: RequisitionStatus;
    createdAt: string;
    itemCount: number;
}

export interface RequisitionDetail extends RequisitionRow {
    items: { itemName: string; sku: string; quantity: number; estimatedPrice: number }[];
}

export interface LPORow {
    id: string;
    locationName: string;
    requisitionId: string;
    vendorName: string;
    totalAmount: number;
    status: LPOStatus;
    issuedAt: string;
    expectedDelivery: string;
}

export interface GRNRow {
    id: string;
    lpoId: string;
    locationName: string;
    receivedByName: string;
    totalAmount: number;
    status: GRNStatus;
    receivedAt: string;
    items: { itemName: string; quantity: number; vendorPrice: number }[];
}

export interface VendorInvoiceRow {
    id: string;
    grnId: string;
    vendorName: string;
    locationName: string;
    amount: number;
    dueDate: string;
    status: InvoiceStatus;
}

export interface PaymentRequestRow {
    id: string;
    invoiceId: string;
    locationName: string;
    requestedByName: string;
    amount: number;
    status: PaymentRequestStatus;
    createdAt: string;
}

export interface VendorRow {
    id: string;
    name: string;
    categoryName: string;
    rating: number;
    contactEmail: string;
    itemCount: number;
}

export interface ProcurementKPIs {
    activeRequisitions: number;
    openLPOs: number;
    pendingGRNs: number;
    unpaidInvoices: number;
    totalProcurementValue: number;
    vendorCount: number;
}

// ─── STATUS TRANSITION RULES (forward-only) ─────────────────────────────────

const TRANSITIONS = {
    REQUISITION: {
        DRAFT: ["SUBMITTED"],
        SUBMITTED: ["APPROVED", "REJECTED", "CANCELLED"],
        APPROVED: [],
        REJECTED: [],
        CANCELLED: [],
    } satisfies Record<RequisitionStatus, RequisitionStatus[]>,
    LPO: {
        DRAFT: ["ISSUED", "CANCELLED"],
        ISSUED: ["RECEIVED", "CANCELLED"],
        RECEIVED: ["CLOSED"],
        CLOSED: [],
        CANCELLED: [],
    } satisfies Record<LPOStatus, LPOStatus[]>,
    GRN: {
        DRAFT: ["PENDING"],
        PENDING: ["RECEIVED", "REJECTED"],
        RECEIVED: [],
        REJECTED: [],
    } satisfies Record<GRNStatus, GRNStatus[]>,
    INVOICE: {
        DRAFT: ["PENDING", "CANCELLED"],
        PENDING: ["APPROVED", "REJECTED", "CANCELLED"],
        APPROVED: [],
        REJECTED: [],
        PAID: [],
        CANCELLED: [],
    } satisfies Record<InvoiceStatus, InvoiceStatus[]>,
    PAYMENT_REQUEST: {
        DRAFT: ["SUBMITTED", "CANCELLED"],
        SUBMITTED: ["APPROVED", "REJECTED", "CANCELLED"],
        APPROVED: [],
        REJECTED: [],
        CANCELLED: [],
    } satisfies Record<PaymentRequestStatus, PaymentRequestStatus[]>,
};

function assertTransition<T extends string>(current: T, next: T, rules: Record<T, T[]>) {
    const allowed = rules[current];
    if (!allowed || !allowed.includes(next)) {
        throw new LifecycleViolationError(`[Lifecycle] Cannot transition from "${current}" to "${next}".`, {
            metadata: { current, next },
        });
    }
}

function assertProcurementRole(user: AuthUser, allowed: Role[]) {
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

// ─── HELPERS ─────────────────────────────────────────────────────────────────

function resolveLocationName(id: string) { return mockDB.locations.find((l) => l.id === id)?.name ?? "Unknown"; }
function resolveDeptName(id?: string) { return id ? (mockDB.departments.find((d) => d.id === id)?.name ?? "Unknown") : "—"; }
function resolveUserName(id: string) { return mockDB.users.find((u) => u.id === id)?.name ?? "System"; }
function resolveVendorName(id: string) { return mockDB.vendors.find((v) => v.id === id)?.name ?? "Unknown"; }
function resolveItemName(id: string) { return mockDB.inventoryItems.find((i) => i.id === id)?.name ?? "Unknown"; }
function resolveItemSku(id: string) { return mockDB.inventoryItems.find((i) => i.id === id)?.sku ?? ""; }

// ─── SERVICE ─────────────────────────────────────────────────────────────────

export const procurementService = {

    // ── KPIs ──────────────────────────────────────────────────────────────
    async getKPIs(user: AuthUser): Promise<ProcurementKPIs> {
        await delay();
        const reqs = scopeFilterByLocation(user, mockDB.requisitions);
        const lpos = scopeFilterByLocation(user, mockDB.localPurchaseOrders);
        const invoices = scopeFilterByLocation(user, mockDB.vendorInvoices);

        return {
            activeRequisitions: reqs.filter((r) => r.status === "SUBMITTED" || r.status === "APPROVED").length,
            openLPOs: lpos.filter((l) => l.status === "ISSUED" || l.status === "RECEIVED").length,
            pendingGRNs: lpos.filter((l) => l.status === "ISSUED").length,
            unpaidInvoices: invoices.filter((i) => i.status === "PENDING" || i.status === "APPROVED").length,
            totalProcurementValue: lpos.reduce((sum, l) => sum + l.totalAmount, 0),
            vendorCount: mockDB.vendors.length,
        };
    },

    // ── Requisitions (scope-filtered) ─────────────────────────────────────
    async getRequisitions(user: AuthUser): Promise<RequisitionRow[]> {
        await delay();
        const filtered = scopeFilterByDepartment(user, mockDB.requisitions);
        return filtered.map((r) => ({
            id: r.id,
            locationName: resolveLocationName(r.locationId),
            departmentName: resolveDeptName(r.departmentId),
            requestedByName: resolveUserName(r.requestedById),
            totalAmount: r.totalAmount,
            status: r.status,
            createdAt: r.createdAt,
            itemCount: mockDB.requisitionItems.filter((ri) => ri.requisitionId === r.id).length,
        }));
    },

    async getRequisitionDetail(user: AuthUser, requisitionId: string): Promise<RequisitionDetail> {
        await delay();
        const req = mockDB.requisitions.find((r) => r.id === requisitionId);
        if (!req) throw new DomainError("Requisition not found", { metadata: { requisitionId } });
        if (!hasGlobalScope(user)) assertLocationAccess(user, req.locationId);

        const items = mockDB.requisitionItems
            .filter((ri) => ri.requisitionId === req.id)
            .map((ri) => ({
                itemName: resolveItemName(ri.itemId),
                sku: resolveItemSku(ri.itemId),
                quantity: ri.quantity,
                estimatedPrice: ri.estimatedPrice,
            }));

        return {
            id: req.id,
            locationName: resolveLocationName(req.locationId),
            departmentName: resolveDeptName(req.departmentId),
            requestedByName: resolveUserName(req.requestedById),
            totalAmount: req.totalAmount,
            status: req.status,
            createdAt: req.createdAt,
            itemCount: items.length,
            items,
        };
    },

    // ── MUTATION: Create Requisition ──────────────────────────────────────
    async createRequisition(
        user: AuthUser,
        input: { locationId: string; departmentId: string; items: { itemId: string; quantity: number; estimatedPrice: number }[] }
    ): Promise<RequisitionRow> {
        return withAuditGuard(async (ctx) => {
            assertCanMutate(user);
            assertProcurementRole(user, [Role.DEPARTMENT_HEAD, Role.PROCUREMENT_OFFICER, Role.GENERAL_MANAGER]);
            assertLocationAccess(user, input.locationId);
            await delay();

            const referenceChainId = makeTraceId("tr_pr");
            ctx.referenceChainId = referenceChainId;

            const totalAmount = input.items.reduce((s, i) => s + i.estimatedPrice, 0);
            const newReq = {
                id: `req_${Date.now()}`,
                locationId: input.locationId,
                departmentId: input.departmentId,
                requestedById: user.id,
                totalAmount,
                status: "DRAFT" as RequisitionStatus,
                createdAt: new Date().toISOString(),
            };
            mockDB.requisitions.push(newReq);
            createAuditLog({
                user,
                entityType: "REQUISITION",
                entityId: newReq.id,
                changes: JSON.stringify({ ...input, status: "DRAFT" }),
                at: newReq.createdAt,
                referenceChainId,
                locationId: newReq.locationId,
                beforeState: null,
                afterState: structuredClone(newReq),
            });

            for (const item of input.items) {
                mockDB.requisitionItems.push({
                    id: `ri_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
                    requisitionId: newReq.id,
                    itemId: item.itemId,
                    quantity: item.quantity,
                    estimatedPrice: item.estimatedPrice,
                });
            }

            return {
                id: newReq.id,
                locationName: resolveLocationName(newReq.locationId),
                departmentName: resolveDeptName(newReq.departmentId),
                requestedByName: resolveUserName(user.id),
                totalAmount,
                status: newReq.status,
                createdAt: newReq.createdAt,
                itemCount: input.items.length,
            };
        }, {
            actorId: user.id,
            actorRole: user.role,
            locationId: input.locationId,
            entityType: "REQUISITION",
            action: "CREATE",
        });
    },

    // ── MUTATION: Transition Requisition Status ───────────────────────────
    async transitionRequisition(user: AuthUser, requisitionId: string, newStatus: RequisitionStatus): Promise<void> {
        return withAuditGuard(async (ctx) => {
            assertCanMutate(user);
            await delay();
            const req = mockDB.requisitions.find((r) => r.id === requisitionId);
            if (!req) throw new DomainError("Requisition not found", { metadata: { requisitionId } });
            assertLocationAccess(user, req.locationId);

            if (newStatus === "SUBMITTED") {
                assertProcurementRole(user, [Role.DEPARTMENT_HEAD, Role.PROCUREMENT_OFFICER, Role.GENERAL_MANAGER]);
            } else {
                assertProcurementRole(user, [Role.PROCUREMENT_OFFICER, Role.GENERAL_MANAGER, Role.STORE_MANAGER]);
            }

            assertTransition(req.status, newStatus, TRANSITIONS.REQUISITION);
            const referenceChainId = getExistingTraceId("REQUISITION", req.id) ?? makeTraceId("tr_pr");
            ctx.referenceChainId = referenceChainId;

            const beforeReq = structuredClone(req);
            const prev = req.status;
            req.status = newStatus;
            const ts = new Date().toISOString();
            createAuditLog({
                user,
                entityType: "REQUISITION",
                entityId: req.id,
                action: "TRANSITION",
                changes: JSON.stringify({ status: `${prev}->${newStatus}` }),
                at: ts,
                referenceChainId,
                locationId: req.locationId,
                beforeState: beforeReq,
                afterState: structuredClone(req),
            });
        }, {
            actorId: user.id,
            actorRole: user.role,
            locationId: user.scope.locationId,
            entityType: "REQUISITION",
            action: "TRANSITION",
        });
    },

    // ── LPOs (scope-filtered) ─────────────────────────────────────────────
    async getLPOs(user: AuthUser): Promise<LPORow[]> {
        await delay();
        const filtered = scopeFilterByLocation(user, mockDB.localPurchaseOrders);
        return filtered.map((l) => ({
            id: l.id,
            locationName: resolveLocationName(l.locationId),
            requisitionId: l.requisitionId,
            vendorName: resolveVendorName(l.vendorId),
            totalAmount: l.totalAmount,
            status: l.status,
            issuedAt: l.issuedAt,
            expectedDelivery: l.expectedDelivery,
        }));
    },

    // ── MUTATION: Create LPO (requires APPROVED requisition) ──────────────
    async createLPO(
        user: AuthUser,
        input: { requisitionId: string; vendorId: string; locationId: string; totalAmount: number; expectedDelivery: string }
    ): Promise<LPORow> {
        return withAuditGuard(async (ctx) => {
            assertCanMutate(user);
            assertProcurementRole(user, [Role.PROCUREMENT_OFFICER, Role.GENERAL_MANAGER]);
            assertLocationAccess(user, input.locationId);
            await delay();

        // Validate: requisition must exist and be APPROVED
        const req = mockDB.requisitions.find((r) => r.id === input.requisitionId);
        if (!req) throw new DomainError("Requisition not found", { metadata: { requisitionId: input.requisitionId } });
        if (req.locationId !== input.locationId) {
            throw new DomainError("LPO location must match requisition location", {
                metadata: { requisitionId: req.id, requisitionLocationId: req.locationId, inputLocationId: input.locationId },
            });
        }
        if (req.status !== "APPROVED") {
            throw new LifecycleViolationError(`Cannot create LPO: requisition status is "${req.status}", must be "APPROVED".`, {
                metadata: { requisitionId: req.id, status: req.status },
            });
        }

        const referenceChainId = getExistingTraceId("REQUISITION", input.requisitionId) ?? makeTraceId("tr_pr");
        ctx.referenceChainId = referenceChainId;
        const newLPO = {
            id: `lpo_${Date.now()}`,
            locationId: input.locationId,
            requisitionId: input.requisitionId,
            vendorId: input.vendorId,
            totalAmount: input.totalAmount,
            status: "DRAFT" as LPOStatus,
            issuedAt: new Date().toISOString(),
            expectedDelivery: input.expectedDelivery,
        };
        mockDB.localPurchaseOrders.push(newLPO);

        createAuditLog({
            user,
            entityType: "LPO",
            entityId: newLPO.id,
            changes: JSON.stringify({ ...input, status: "DRAFT" }),
            at: newLPO.issuedAt,
            referenceChainId,
            locationId: newLPO.locationId,
            beforeState: null,
            afterState: structuredClone(newLPO),
        });

        return {
            id: newLPO.id,
            locationName: resolveLocationName(newLPO.locationId),
            requisitionId: newLPO.requisitionId,
            vendorName: resolveVendorName(newLPO.vendorId),
            totalAmount: newLPO.totalAmount,
            status: newLPO.status,
            issuedAt: newLPO.issuedAt,
            expectedDelivery: newLPO.expectedDelivery,
        };
        }, {
            actorId: user.id,
            actorRole: user.role,
            locationId: input.locationId,
            entityType: "LPO",
            action: "CREATE",
        });
    },

    // ── MUTATION: Transition LPO Status ───────────────────────────────────
    async transitionLPO(user: AuthUser, lpoId: string, newStatus: LPOStatus): Promise<void> {
        return withAuditGuard(async (ctx) => {
            assertCanMutate(user);
            assertProcurementRole(user, [Role.PROCUREMENT_OFFICER, Role.GENERAL_MANAGER]);
            await delay();
            const lpo = mockDB.localPurchaseOrders.find((l) => l.id === lpoId);
            if (!lpo) throw new DomainError("LPO not found", { metadata: { lpoId } });
            assertLocationAccess(user, lpo.locationId);

            assertTransition(lpo.status, newStatus, TRANSITIONS.LPO);
            const referenceChainId = getExistingTraceId("LPO", lpo.id) ?? makeTraceId("tr_pr");
            ctx.referenceChainId = referenceChainId;
            const beforeLpo = structuredClone(lpo);
            const prev = lpo.status;
            lpo.status = newStatus;
            const ts = new Date().toISOString();
            createAuditLog({
                user,
                entityType: "LPO",
                entityId: lpo.id,
                action: "TRANSITION",
                changes: JSON.stringify({ status: `${prev}->${newStatus}` }),
                at: ts,
                referenceChainId,
                locationId: lpo.locationId,
                beforeState: beforeLpo,
                afterState: structuredClone(lpo),
            });
        }, {
            actorId: user.id,
            actorRole: user.role,
            locationId: user.scope.locationId,
            entityType: "LPO",
            action: "TRANSITION",
        });
    },

    // ── GRNs (scope-filtered) ─────────────────────────────────────────────
    async getGRNs(user: AuthUser): Promise<GRNRow[]> {
        await delay();
        const filtered = scopeFilterByLocation(user, mockDB.goodsReceivedNotes);
        return filtered.map((g) => ({
            id: g.id,
            lpoId: g.lpoId,
            locationName: resolveLocationName(g.locationId),
            receivedByName: resolveUserName(g.receivedById),
            totalAmount: g.totalAmount,
            status: g.status,
            receivedAt: g.receivedAt,
            items: mockDB.grnItems
                .filter((gi) => gi.grnId === g.id)
                .map((gi) => ({
                    itemName: resolveItemName(gi.itemId),
                    quantity: gi.quantity,
                    vendorPrice: gi.vendorPrice,
                })),
        }));
    },

    // ── MUTATION: Create GRN (requires ISSUED LPO) ────────────────────────
    async createGRN(
        user: AuthUser,
        input: { lpoId: string; locationId: string; items: { itemId: string; quantity: number; vendorPrice: number }[] }
    ): Promise<GRNRow> {
        return withAuditGuard(async (ctx) => {
            assertCanMutate(user);
            assertProcurementRole(user, [Role.STORE_MANAGER, Role.GENERAL_MANAGER, Role.PROCUREMENT_OFFICER]);
            assertLocationAccess(user, input.locationId);
            await delay();

        // Validate: LPO must exist and be ISSUED
        const lpo = mockDB.localPurchaseOrders.find((l) => l.id === input.lpoId);
        if (!lpo) throw new DomainError("LPO not found", { metadata: { lpoId: input.lpoId } });
        if (lpo.locationId !== input.locationId) {
            throw new DomainError("GRN location must match LPO location", {
                metadata: { lpoId: lpo.id, lpoLocationId: lpo.locationId, inputLocationId: input.locationId },
            });
        }
        if (lpo.status !== "ISSUED") {
            throw new LifecycleViolationError(`Cannot create GRN: LPO status is "${lpo.status}", must be "ISSUED".`, {
                metadata: { lpoId: lpo.id, status: lpo.status },
            });
        }

        const referenceChainId = getExistingTraceId("LPO", lpo.id) ?? makeTraceId("tr_pr");
        ctx.referenceChainId = referenceChainId;
        const totalAmount = input.items.reduce((s, i) => s + i.quantity * i.vendorPrice, 0);
        const ts = new Date().toISOString();
        const newGRN = {
            id: `grn_${Date.now()}`,
            lpoId: input.lpoId,
            locationId: input.locationId,
            receivedById: user.id,
            totalAmount,
            status: "PENDING" as GRNStatus,
            receivedAt: ts,
        };
        mockDB.goodsReceivedNotes.push(newGRN);
        createAuditLog({
            user,
            entityType: "GRN",
            entityId: newGRN.id,
            changes: JSON.stringify({ ...input, status: "PENDING" }),
            at: ts,
            referenceChainId,
            locationId: newGRN.locationId,
            beforeState: null,
            afterState: structuredClone(newGRN),
        });

        for (const item of input.items) {
            mockDB.grnItems.push({
                id: `gi_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
                grnId: newGRN.id,
                itemId: item.itemId,
                quantity: item.quantity,
                vendorPrice: item.vendorPrice,
            });
        }

        return {
            id: newGRN.id,
            lpoId: newGRN.lpoId,
            locationName: resolveLocationName(newGRN.locationId),
            receivedByName: resolveUserName(user.id),
            totalAmount,
            status: newGRN.status,
            receivedAt: newGRN.receivedAt,
            items: input.items.map((i) => ({
                itemName: resolveItemName(i.itemId),
                quantity: i.quantity,
                vendorPrice: i.vendorPrice,
            })),
        };
        }, {
            actorId: user.id,
            actorRole: user.role,
            locationId: input.locationId,
            entityType: "GRN",
            action: "CREATE",
        });
    },

    // ── MUTATION: Mark GRN Received (creates PURCHASE_RECEIPT movements) ──
    async markGRNReceived(user: AuthUser, grnId: string): Promise<void> {
        return withAuditGuard(async (ctx) => {
            assertCanMutate(user);
            assertProcurementRole(user, [Role.STORE_MANAGER, Role.GENERAL_MANAGER]);
            await delay();

        const grn = mockDB.goodsReceivedNotes.find((g) => g.id === grnId);
        if (!grn) throw new DomainError("GRN not found", { metadata: { grnId } });
        assertLocationAccess(user, grn.locationId);

        if (grn.status === "RECEIVED") throw new LifecycleViolationError("GRN is already RECEIVED", { metadata: { grnId: grn.id } });

        // Validate: GRN must reference a valid LPO
        const lpo = mockDB.localPurchaseOrders.find((l) => l.id === grn.lpoId);
        if (!lpo) throw new DomainError("[ERD] GRN must reference a valid LPO", { metadata: { grnId: grn.id, lpoId: grn.lpoId } });
        assertLocationAccess(user, lpo.locationId);

        // Validate: LPO must still be ISSUED to be received
        if (lpo.status !== "ISSUED") {
            throw new LifecycleViolationError(`Cannot receive GRN: LPO status is "${lpo.status}", must be "ISSUED".`, {
                metadata: { grnId: grn.id, lpoId: lpo.id, status: lpo.status },
            });
        }

        // Idempotency: prevent duplicate ledger writes for this GRN
        const existing = mockDB.stockMovements.some((m) => m.referenceType === "GRN" && m.referenceId === grn.id && m.type === "PURCHASE_RECEIPT");
        if (existing) throw new InvariantViolationError("GRN already has PURCHASE_RECEIPT movements", { metadata: { grnId: grn.id } });

        const items = mockDB.grnItems.filter((gi) => gi.grnId === grn.id);
        if (items.length === 0) throw new DomainError("GRN has no items", { metadata: { grnId: grn.id } });

        const ts = new Date().toISOString();
        const referenceChainId = getExistingTraceId("GRN", grn.id) ?? getExistingTraceId("LPO", lpo.id) ?? makeTraceId("tr_pr");
        ctx.referenceChainId = referenceChainId;
        const beforeGrn = structuredClone(grn);
        const beforeLpo = structuredClone(lpo);

        for (const gi of items) {
            const movementId = `mov_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
            mockDB.stockMovements.push({
                id: movementId,
                locationId: grn.locationId,
                inventoryItemId: gi.itemId,
                type: "PURCHASE_RECEIPT",
                quantity: gi.quantity,
                unitCost: gi.vendorPrice,
                referenceType: "GRN",
                referenceId: grn.id,
                createdAt: ts,
                createdBy: user.id,
            });
            createAuditLog({
                user,
                entityType: "StockMovement",
                entityId: movementId,
                action: "CREATE",
                changes: JSON.stringify({ type: "PURCHASE_RECEIPT", grnId: grn.id, itemId: gi.itemId, quantity: gi.quantity, unitCost: gi.vendorPrice }),
                at: ts,
                referenceChainId,
                locationId: grn.locationId,
                beforeState: null,
                afterState: structuredClone(mockDB.stockMovements.find((m) => m.id === movementId)),
            });
        }

        // Transition GRN + LPO to RECEIVED
        const prevGrn = grn.status;
        assertTransition(grn.status, "RECEIVED", TRANSITIONS.GRN);
        grn.status = "RECEIVED";

        // LPO transition is part of procurement lifecycle; enforce via transition map
        const prevLpo = lpo.status;
        assertTransition(lpo.status, "RECEIVED", TRANSITIONS.LPO);
        lpo.status = "RECEIVED";

        createAuditLog({
            user,
            entityType: "GRN",
            entityId: grn.id,
            action: "TRANSITION",
            changes: JSON.stringify({ status: `${prevGrn}->RECEIVED` }),
            at: ts,
            referenceChainId,
            locationId: grn.locationId,
            beforeState: beforeGrn,
            afterState: structuredClone(grn),
        });
        createAuditLog({
            user,
            entityType: "LPO",
            entityId: lpo.id,
            action: "TRANSITION",
            changes: JSON.stringify({ status: `${prevLpo}->RECEIVED` }),
            at: ts,
            referenceChainId,
            locationId: lpo.locationId,
            beforeState: beforeLpo,
            afterState: structuredClone(lpo),
        });
        }, {
            actorId: user.id,
            actorRole: user.role,
            locationId: user.scope.locationId,
            entityType: "GRN",
            action: "RECEIVE",
        });
    },

    // ── Vendor Invoices (scope-filtered) ──────────────────────────────────
    async getVendorInvoices(user: AuthUser): Promise<VendorInvoiceRow[]> {
        await delay();
        const filtered = scopeFilterByLocation(user, mockDB.vendorInvoices);
        return filtered.map((vi) => ({
            id: vi.id,
            grnId: vi.grnId,
            vendorName: resolveVendorName(vi.vendorId),
            locationName: resolveLocationName(vi.locationId),
            amount: vi.amount,
            dueDate: vi.dueDate,
            status: vi.status,
        }));
    },

    // ── MUTATION: Create Vendor Invoice (requires GRN) ────────────────────
    async createVendorInvoice(
        user: AuthUser,
        input: { grnId: string; vendorId: string; locationId: string; amount: number; dueDate: string }
    ): Promise<VendorInvoiceRow> {
        return withAuditGuard(async (ctx) => {
            assertCanMutate(user);
            assertProcurementRole(user, [Role.PROCUREMENT_OFFICER, Role.GENERAL_MANAGER, Role.FINANCE_MANAGER]);
            assertLocationAccess(user, input.locationId);
            await delay();

        // Validate: GRN must exist — no orphan invoices (ERD constraint)
        if (!input.grnId) throw new DomainError("[ERD] Vendor invoice must reference a GRN.");
        const grn = mockDB.goodsReceivedNotes.find((g) => g.id === input.grnId);
        if (!grn) throw new DomainError("GRN not found", { metadata: { grnId: input.grnId } });
        if (grn.status !== "RECEIVED") {
            throw new LifecycleViolationError(`Cannot create vendor invoice: GRN status is "${grn.status}", must be "RECEIVED".`, {
                metadata: { grnId: grn.id, status: grn.status },
            });
        }
        if (grn.locationId !== input.locationId) {
            throw new DomainError("Vendor invoice location must match GRN location", {
                metadata: { grnId: grn.id, grnLocationId: grn.locationId, inputLocationId: input.locationId },
            });
        }

        const referenceChainId = getExistingTraceId("GRN", input.grnId) ?? makeTraceId("tr_pr");
        ctx.referenceChainId = referenceChainId;
        const newInvoice = {
            id: `vinv_${Date.now()}`,
            grnId: input.grnId,
            vendorId: input.vendorId,
            locationId: input.locationId,
            amount: input.amount,
            dueDate: input.dueDate,
            status: "PENDING" as InvoiceStatus,
        };
        mockDB.vendorInvoices.push(newInvoice);
        const ts = new Date().toISOString();
        createAuditLog({
            user,
            entityType: "SUPPLIER_INVOICE",
            entityId: newInvoice.id,
            changes: JSON.stringify({ ...input, status: "PENDING" }),
            at: ts,
            referenceChainId,
            locationId: newInvoice.locationId,
            beforeState: null,
            afterState: structuredClone(newInvoice),
        });

        return {
            id: newInvoice.id,
            grnId: newInvoice.grnId,
            vendorName: resolveVendorName(newInvoice.vendorId),
            locationName: resolveLocationName(newInvoice.locationId),
            amount: newInvoice.amount,
            dueDate: newInvoice.dueDate,
            status: newInvoice.status,
        };
        }, {
            actorId: user.id,
            actorRole: user.role,
            locationId: input.locationId,
            entityType: "SUPPLIER_INVOICE",
            action: "CREATE",
        });
    },

    // ── MUTATION: Transition Invoice Status ───────────────────────────────
    async transitionInvoice(user: AuthUser, invoiceId: string, newStatus: InvoiceStatus): Promise<void> {
        return withAuditGuard(async (ctx) => {
            assertCanMutate(user);
            await delay();
            const inv = mockDB.vendorInvoices.find((i) => i.id === invoiceId);
            if (!inv) throw new DomainError("Invoice not found", { metadata: { invoiceId } });
            assertLocationAccess(user, inv.locationId);

        if (newStatus === "APPROVED") {
            assertProcurementRole(user, [Role.FINANCE_MANAGER, Role.GENERAL_MANAGER]);
        } else {
            assertProcurementRole(user, [Role.FINANCE_MANAGER, Role.GENERAL_MANAGER, Role.PROCUREMENT_OFFICER]);
        }

        assertTransition(inv.status, newStatus, TRANSITIONS.INVOICE);
        const referenceChainId = getExistingTraceId("SUPPLIER_INVOICE", inv.id) ?? makeTraceId("tr_pr");
        ctx.referenceChainId = referenceChainId;
        const beforeInv = structuredClone(inv);
        const prev = inv.status;
        inv.status = newStatus;
        const ts = new Date().toISOString();
        createAuditLog({
            user,
            entityType: "SUPPLIER_INVOICE",
            entityId: inv.id,
            action: "TRANSITION",
            changes: JSON.stringify({ status: `${prev}->${newStatus}` }),
            at: ts,
            referenceChainId,
            locationId: inv.locationId,
            beforeState: beforeInv,
            afterState: structuredClone(inv),
        });
        }, {
            actorId: user.id,
            actorRole: user.role,
            locationId: user.scope.locationId,
            entityType: "SUPPLIER_INVOICE",
            action: "TRANSITION",
        });
    },

    // ── Payment Requests (scope-filtered) ─────────────────────────────────
    async getPaymentRequests(user: AuthUser): Promise<PaymentRequestRow[]> {
        await delay();
        const filtered = scopeFilterByLocation(user, mockDB.paymentRequests);
        return filtered.map((pr) => ({
            id: pr.id,
            invoiceId: pr.invoiceId,
            locationName: resolveLocationName(pr.locationId),
            requestedByName: resolveUserName(pr.requestedById),
            amount: pr.amount,
            status: pr.status,
            createdAt: pr.createdAt,
        }));
    },

    async createPaymentRequest(user: AuthUser, input: { invoiceId: string; locationId: string; amount: number }): Promise<PaymentRequestRow> {
        return withAuditGuard(async (ctx) => {
            assertCanMutate(user);
            assertProcurementRole(user, [Role.FINANCE_MANAGER, Role.GENERAL_MANAGER]);
            assertLocationAccess(user, input.locationId);
            await delay();

        const inv = mockDB.vendorInvoices.find((i) => i.id === input.invoiceId);
        if (!inv) throw new DomainError("Invoice not found", { metadata: { invoiceId: input.invoiceId } });
        if (inv.locationId !== input.locationId) {
            throw new DomainError("Invoice must belong to the same location", {
                metadata: { invoiceId: inv.id, invoiceLocationId: inv.locationId, inputLocationId: input.locationId },
            });
        }
        if (inv.status !== "APPROVED") {
            throw new LifecycleViolationError(`Cannot create payment request: invoice status is "${inv.status}", must be "APPROVED".`, {
                metadata: { invoiceId: inv.id, status: inv.status },
            });
        }

        const ts = new Date().toISOString();
        const referenceChainId = getExistingTraceId("SUPPLIER_INVOICE", input.invoiceId) ?? makeTraceId("tr_pr");
        ctx.referenceChainId = referenceChainId;
        const pr = {
            id: `payreq_${Date.now()}`,
            invoiceId: input.invoiceId,
            locationId: input.locationId,
            requestedById: user.id,
            amount: input.amount,
            status: "DRAFT" as PaymentRequestStatus,
            createdAt: ts,
        };
        mockDB.paymentRequests.push(pr);
        createAuditLog({
            user,
            entityType: "PAYMENT_REQUEST",
            entityId: pr.id,
            changes: JSON.stringify({ ...input, status: "DRAFT" }),
            at: ts,
            referenceChainId,
            locationId: pr.locationId,
            beforeState: null,
            afterState: structuredClone(pr),
        });

        return {
            id: pr.id,
            invoiceId: pr.invoiceId,
            locationName: resolveLocationName(pr.locationId),
            requestedByName: resolveUserName(pr.requestedById),
            amount: pr.amount,
            status: pr.status,
            createdAt: pr.createdAt,
        };
        }, {
            actorId: user.id,
            actorRole: user.role,
            locationId: input.locationId,
            entityType: "PAYMENT_REQUEST",
            action: "CREATE",
        });
    },

    async transitionPaymentRequest(user: AuthUser, paymentRequestId: string, newStatus: PaymentRequestStatus): Promise<void> {
        return withAuditGuard(async (ctx) => {
            assertCanMutate(user);
            await delay();
            const pr = mockDB.paymentRequests.find((p) => p.id === paymentRequestId);
            if (!pr) throw new DomainError("Payment request not found", { metadata: { paymentRequestId } });
            assertLocationAccess(user, pr.locationId);

        if (newStatus === "APPROVED") {
            assertProcurementRole(user, [Role.GENERAL_MANAGER, Role.FINANCE_MANAGER]);
        } else {
            assertProcurementRole(user, [Role.FINANCE_MANAGER, Role.GENERAL_MANAGER]);
        }

        assertTransition(pr.status, newStatus, TRANSITIONS.PAYMENT_REQUEST);
        const referenceChainId = getExistingTraceId("PAYMENT_REQUEST", pr.id) ?? makeTraceId("tr_pr");
        ctx.referenceChainId = referenceChainId;
        const beforePr = structuredClone(pr);
        const prev = pr.status;
        pr.status = newStatus;
        const ts = new Date().toISOString();
        createAuditLog({
            user,
            entityType: "PAYMENT_REQUEST",
            entityId: pr.id,
            action: "TRANSITION",
            changes: JSON.stringify({ status: `${prev}->${newStatus}` }),
            at: ts,
            referenceChainId,
            locationId: pr.locationId,
            beforeState: beforePr,
            afterState: structuredClone(pr),
        });
        }, {
            actorId: user.id,
            actorRole: user.role,
            locationId: user.scope.locationId,
            entityType: "PAYMENT_REQUEST",
            action: "TRANSITION",
        });
    },

    // ── Vendors (read-only, no scope filter — vendors are global) ─────────
    async getVendors(): Promise<VendorRow[]> {
        await delay();
        return mockDB.vendors.map((v) => ({
            id: v.id,
            name: v.name,
            categoryName: mockDB.vendorCategories.find((vc) => vc.id === v.categoryId)?.name ?? "Uncategorized",
            rating: v.rating,
            contactEmail: v.contactEmail,
            itemCount: mockDB.vendorItems.filter((vi) => vi.vendorId === v.id).length,
        }));
    },

    // ── 3-Way Match Verification ──────────────────────────────────────────
    async getThreeWayMatch(user: AuthUser, invoiceId: string): Promise<{
        invoice: VendorInvoiceRow;
        grn: GRNRow | null;
        lpo: LPORow | null;
        matched: boolean;
        discrepancy: number;
    }> {
        await delay();
        const inv = mockDB.vendorInvoices.find((i) => i.id === invoiceId);
        if (!inv) throw new DomainError("Invoice not found", { metadata: { invoiceId } });
        if (!hasGlobalScope(user)) assertLocationAccess(user, inv.locationId);

        const grn = inv.grnId ? mockDB.goodsReceivedNotes.find((g) => g.id === inv.grnId) : null;
        const lpo = grn ? mockDB.localPurchaseOrders.find((l) => l.id === grn.lpoId) : null;

        const invoiceAmount = inv.amount;
        const grnAmount = grn?.totalAmount ?? 0;
        const lpoAmount = lpo?.totalAmount ?? 0;
        const discrepancy = Math.abs(invoiceAmount - grnAmount) + Math.abs(grnAmount - lpoAmount);
        const matched = discrepancy === 0 && !!grn && !!lpo;

        return {
            invoice: {
                id: inv.id, grnId: inv.grnId, vendorName: resolveVendorName(inv.vendorId),
                locationName: resolveLocationName(inv.locationId), amount: inv.amount, dueDate: inv.dueDate, status: inv.status,
            },
            grn: grn ? {
                id: grn.id, lpoId: grn.lpoId, locationName: resolveLocationName(grn.locationId),
                receivedByName: resolveUserName(grn.receivedById), totalAmount: grn.totalAmount, status: grn.status, receivedAt: grn.receivedAt,
                items: mockDB.grnItems.filter((gi) => gi.grnId === grn.id).map((gi) => ({
                    itemName: resolveItemName(gi.itemId), quantity: gi.quantity, vendorPrice: gi.vendorPrice,
                })),
            } : null,
            lpo: lpo ? {
                id: lpo.id, locationName: resolveLocationName(lpo.locationId), requisitionId: lpo.requisitionId,
                vendorName: resolveVendorName(lpo.vendorId), totalAmount: lpo.totalAmount, status: lpo.status,
                issuedAt: lpo.issuedAt, expectedDelivery: lpo.expectedDelivery,
            } : null,
            matched,
            discrepancy,
        };
    },
};
