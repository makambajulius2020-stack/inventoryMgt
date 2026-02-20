/**
 * DOMAIN 1: Inventory Engine
 * Scope enforcement at service layer — not just UI.
 * All reads filter by user.scope.locationId / departmentId.
 * All mutations blocked for read-only roles (Auditor).
 */

import { mockDB } from "../../mock-db";
import type { AuthUser } from "@/lib/auth/types";
import { Role, isReadOnlyRole, normalizeRole } from "@/lib/auth/roles";
import {
    assertLocationAccess,
    hasGlobalScope,
} from "./_guards";
import { withAuditGuard } from "./_auditGuard";
import { AuthorizationError, DomainError, ScopeViolationError } from "@/lib/runtime/errors";

const DELAY = process.env.VITEST ? 0 : 300;
const delay = () => new Promise((r) => setTimeout(r, DELAY));

// ─── TYPES ───────────────────────────────────────────────────────────────────

export interface StockLevelRow {
    id: string;
    itemId: string;
    itemName: string;
    sku: string;
    categoryName: string;
    uom: string;
    onHand: number;
    reserved: number;
    available: number;
    reorderLevel: number;
    unitValue: number;
    totalValue: number;
    status: "HEALTHY" | "LOW" | "CRITICAL" | "OUT_OF_STOCK";
    locationId: string;
    locationName: string;
}

export interface StockMovementRow {
    id: string;
    itemName: string;
    type:
        | "OPENING_BALANCE"
        | "PURCHASE_RECEIPT"
        | "TRANSFER_IN"
        | "TRANSFER_OUT"
        | "DEPARTMENT_ISSUE"
        | "ADJUSTMENT";
    quantity: number;
    unitCost: number;
    referenceType?: string;
    referenceId?: string;
    performedByName: string;
    createdAt: string;
    locationName: string;
}

export interface StockTransferRow {
    id: string;
    sourceLocationName: string;
    destinationLocationName: string;
    itemName: string;
    quantity: number;
    status: string;
    requestedAt: string;
    completedAt?: string;
}

export interface LowStockAlert {
    itemId: string;
    itemName: string;
    sku: string;
    locationName: string;
    onHand: number;
    reorderLevel: number;
    deficit: number;
}

export interface InventoryKPIs {
    totalItems: number;
    totalValue: number;
    lowStockCount: number;
    outOfStockCount: number;
    movementThisMonth: number;
    fastMoving: { itemId: string; itemName: string; quantity: number }[];
    slowMoving: { itemId: string; itemName: string; quantity: number }[];
}

export interface DepartmentStockRow {
    id: string;
    departmentName: string;
    itemName: string;
    sku: string;
    currentQuantity: number;
    uom: string;
}

// ─── HELPERS ─────────────────────────────────────────────────────────────────

function resolveItemName(itemId: string): string {
    return mockDB.inventoryItems.find((i) => i.id === itemId)?.name ?? "Unknown";
}

function resolveLocationName(locationId: string): string {
    return mockDB.locations.find((l) => l.id === locationId)?.name ?? "Unknown";
}

function resolveCategoryName(categoryId: string): string {
    return mockDB.categories.find((c) => c.id === categoryId)?.name ?? "Uncategorized";
}

function resolveUserName(userId: string): string {
    return mockDB.users.find((u) => u.id === userId)?.name ?? "System";
}

function assertNotCeo(user: AuthUser) {
    if (normalizeRole(user.role) === Role.CEO) {
        throw new AuthorizationError("[RBAC] CEO cannot access operational inventory detail services.", {
            metadata: { userId: user.id, role: user.role },
        });
    }
}

function assertRole(user: AuthUser, allowed: Role[]) {
    const role = normalizeRole(user.role);
    if (!role || !allowed.includes(role)) {
        throw new AuthorizationError(`[RBAC] Role "${user.role}" is not permitted to perform this action.`, {
            metadata: { userId: user.id, role: user.role },
        });
    }
}

function assertCanMutateInventory(user: AuthUser, allowed: Role[]) {
    const role = normalizeRole(user.role);
    if (!role) {
        throw new AuthorizationError(`[RBAC] Role "${user.role}" is not recognized.`, {
            metadata: { userId: user.id, role: user.role },
        });
    }
    if (isReadOnlyRole(role)) {
        throw new AuthorizationError("[RBAC] Read-only roles cannot mutate inventory.", {
            metadata: { userId: user.id, role: user.role },
        });
    }
    assertRole(user, allowed);
}

type MovementType = StockMovementRow["type"];

function movementDelta(type: MovementType, qty: number): number {
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

function isoMonthStart(d = new Date()): Date {
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1, 0, 0, 0));
}

function makeTraceId(prefix = "tr"): string {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
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

function listMovementsForUser(user: AuthUser) {
    if (hasGlobalScope(user)) return mockDB.stockMovements;
    const locId = user.scope.locationId;
    return mockDB.stockMovements.filter((m) => m.locationId === locId);
}

function listLocationStockMetaForUser(user: AuthUser) {
    if (hasGlobalScope(user)) return mockDB.locationStock;
    const locId = user.scope.locationId;
    return mockDB.locationStock.filter((s) => s.locationId === locId);
}

function computeLocationBalances(user: AuthUser): Map<string, { locationId: string; itemId: string; onHand: number }> {
    const moves = listMovementsForUser(user);
    const byKey = new Map<string, { locationId: string; itemId: string; onHand: number }>();

    for (const m of moves) {
        const key = `${m.locationId}::${m.inventoryItemId}`;
        const current = byKey.get(key) ?? { locationId: m.locationId, itemId: m.inventoryItemId, onHand: 0 };
        current.onHand += movementDelta(m.type as MovementType, m.quantity);
        byKey.set(key, current);
    }

    return byKey;
}

function latestUnitCost(locationId: string, itemId: string): number {
    const relevant = mockDB.stockMovements
        .filter((m) => m.locationId === locationId && m.inventoryItemId === itemId)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return relevant[0]?.unitCost ?? (mockDB.inventoryItems.find((i) => i.id === itemId)?.basePrice ?? 0);
}

function stockStatus(onHand: number, reorderLevel: number): StockLevelRow["status"] {
    if (onHand <= 0) return "OUT_OF_STOCK";
    if (onHand <= reorderLevel * 0.5) return "CRITICAL";
    if (onHand <= reorderLevel) return "LOW";
    return "HEALTHY";
}

// ─── SERVICE ─────────────────────────────────────────────────────────────────

export const inventoryService = {

    // ── READ: Location Stock Levels (scope-filtered) ──────────────────────
    async getLocationStock(user: AuthUser): Promise<StockLevelRow[]> {
        assertNotCeo(user);
        await delay();
        const balances = computeLocationBalances(user);
        const meta = listLocationStockMetaForUser(user);

        // ensure we include items that exist in meta table even if no movements exist yet
        for (const s of meta) {
            const key = `${s.locationId}::${s.itemId}`;
            if (!balances.has(key)) balances.set(key, { locationId: s.locationId, itemId: s.itemId, onHand: 0 });
        }

        const rows: StockLevelRow[] = [];
        for (const b of balances.values()) {
            const item = mockDB.inventoryItems.find((i) => i.id === b.itemId);
            const metaRow = meta.find((m) => m.locationId === b.locationId && m.itemId === b.itemId);
            const reserved = metaRow?.reservedQuantity ?? 0;
            const reorderLevel = metaRow?.reorderLevel ?? 0;
            const available = b.onHand - reserved;
            const unitValue = latestUnitCost(b.locationId, b.itemId);

            rows.push({
                id: metaRow?.id ?? `lst_meta_${b.locationId}_${b.itemId}`,
                itemId: b.itemId,
                itemName: item?.name ?? "Unknown",
                sku: item?.sku ?? "",
                categoryName: resolveCategoryName(item?.categoryId ?? ""),
                uom: item?.uom ?? "",
                onHand: b.onHand,
                reserved,
                available,
                reorderLevel,
                unitValue,
                totalValue: unitValue * b.onHand,
                status: stockStatus(b.onHand, reorderLevel),
                locationId: b.locationId,
                locationName: resolveLocationName(b.locationId),
            });
        }

        return rows;
    },

    // ── READ: KPIs (scope-filtered) ───────────────────────────────────────
    async getKPIs(user: AuthUser): Promise<InventoryKPIs> {
        assertNotCeo(user);
        await delay();
        const stock = await this.getLocationStock(user);

        const totalItems = stock.length;
        const totalValue = stock.reduce((s, r) => s + r.totalValue, 0);
        const lowStockCount = stock.filter((r) => r.status === "LOW" || r.status === "CRITICAL").length;
        const outOfStockCount = stock.filter((r) => r.status === "OUT_OF_STOCK").length;

        const monthStart = isoMonthStart();
        const moves = listMovementsForUser(user);
        const movementThisMonth = moves
            .filter((m) => new Date(m.createdAt).getTime() >= monthStart.getTime())
            .reduce((sum, m) => sum + Math.abs(m.quantity), 0);

        const consumption = new Map<string, number>();
        for (const m of moves) {
            if (m.type !== "DEPARTMENT_ISSUE" && m.type !== "TRANSFER_OUT") continue;
            if (new Date(m.createdAt).getTime() < monthStart.getTime()) continue;
            consumption.set(m.inventoryItemId, (consumption.get(m.inventoryItemId) ?? 0) + Math.abs(m.quantity));
        }

        const movers = Array.from(consumption.entries())
            .map(([itemId, qty]) => ({ itemId, itemName: resolveItemName(itemId), quantity: qty }))
            .sort((a, b) => b.quantity - a.quantity);

        const fastMoving = movers.slice(0, 5);
        const slowMoving = movers.slice(-5).reverse();

        return {
            totalItems,
            totalValue,
            lowStockCount,
            outOfStockCount,
            movementThisMonth,
            fastMoving,
            slowMoving,
        };
    },

    // ── READ: Low Stock Alerts (scope-filtered) ───────────────────────────
    async getLowStockAlerts(user: AuthUser): Promise<LowStockAlert[]> {
        assertNotCeo(user);
        await delay();
        const stock = await this.getLocationStock(user);
        return stock
            .filter((r) => r.onHand <= r.reorderLevel)
            .map((r) => ({
                itemId: r.itemId,
                itemName: r.itemName,
                sku: r.sku,
                locationName: r.locationName,
                onHand: r.onHand,
                reorderLevel: r.reorderLevel,
                deficit: r.reorderLevel - r.onHand,
            }))
            .sort((a, b) => b.deficit - a.deficit);
    },

    // ── READ: Stock Movement History (scope-filtered) ─────────────────────
    async getMovementHistory(
        user: AuthUser,
        filters?: { from?: string; to?: string; itemId?: string; type?: MovementType; departmentId?: string }
    ): Promise<StockMovementRow[]> {
        assertNotCeo(user);
        await delay();
        let movements = listMovementsForUser(user);

        if (filters?.from) {
            const fromTs = new Date(filters.from).getTime();
            movements = movements.filter((m) => new Date(m.createdAt).getTime() >= fromTs);
        }
        if (filters?.to) {
            const toTs = new Date(filters.to).getTime();
            movements = movements.filter((m) => new Date(m.createdAt).getTime() <= toTs);
        }
        if (filters?.itemId) movements = movements.filter((m) => m.inventoryItemId === filters.itemId);
        if (filters?.type) movements = movements.filter((m) => m.type === filters.type);
        if (filters?.departmentId) movements = movements.filter((m) => m.departmentId === filters.departmentId);

        return movements
            .map((m) => ({
                id: m.id,
                itemName: resolveItemName(m.inventoryItemId),
                type: m.type,
                quantity: m.quantity,
                unitCost: m.unitCost,
                referenceType: m.referenceType,
                referenceId: m.referenceId,
                performedByName: resolveUserName(m.createdBy),
                createdAt: m.createdAt,
                locationName: resolveLocationName(m.locationId),
            }))
            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    },

    // ── READ: Stock Transfers (scope-filtered) ────────────────────────────
    async getStockTransfers(user: AuthUser): Promise<StockTransferRow[]> {
        assertNotCeo(user);
        await delay();
        const transfers = hasGlobalScope(user)
            ? mockDB.stockTransfers
            : mockDB.stockTransfers.filter(
                (t) =>
                    t.sourceLocationId === user.scope.locationId ||
                    t.destinationLocationId === user.scope.locationId
            );
        return transfers.map((t) => ({
            id: t.id,
            sourceLocationName: resolveLocationName(t.sourceLocationId),
            destinationLocationName: resolveLocationName(t.destinationLocationId),
            itemName: resolveItemName(t.itemId),
            quantity: t.quantity,
            status: t.status,
            requestedAt: t.requestedAt,
            completedAt: t.completedAt,
        }));
    },

    // ── READ: Department Stock (scope-filtered by location + department) ──
    async getDepartmentStock(user: AuthUser): Promise<DepartmentStockRow[]> {
        assertNotCeo(user);
        await delay();
        // Department stock is derived from DEPARTMENT_ISSUE movements (ledger)
        const departments = hasGlobalScope(user)
            ? mockDB.departments
            : user.scope.departmentId
                ? mockDB.departments.filter((d) => d.id === user.scope.departmentId)
                : mockDB.departments.filter((d) => d.locationId === user.scope.locationId);

        const deptIds = new Set(departments.map((d) => d.id));
        let moves = listMovementsForUser(user).filter((m) => m.type === "DEPARTMENT_ISSUE" && m.departmentId);
        moves = moves.filter((m) => !!m.departmentId && deptIds.has(m.departmentId));

        const byKey = new Map<string, { departmentId: string; itemId: string; qty: number }>();
        for (const m of moves) {
            const deptId = m.departmentId as string;
            const key = `${deptId}::${m.inventoryItemId}`;
            const curr = byKey.get(key) ?? { departmentId: deptId, itemId: m.inventoryItemId, qty: 0 };
            curr.qty += m.quantity;
            byKey.set(key, curr);
        }

        const rows: DepartmentStockRow[] = [];
        for (const v of byKey.values()) {
            const dept = mockDB.departments.find((d) => d.id === v.departmentId);
            const item = mockDB.inventoryItems.find((i) => i.id === v.itemId);
            rows.push({
                id: `dst_${v.departmentId}_${v.itemId}`,
                departmentName: dept?.name ?? "Unknown",
                itemName: item?.name ?? "Unknown",
                sku: item?.sku ?? "",
                currentQuantity: v.qty,
                uom: item?.uom ?? "",
            });
        }

        return rows;
    },

    // ── READ: Stock Valuation Summary (scope-filtered) ────────────────────
    async getStockValuation(user: AuthUser): Promise<{ categoryName: string; totalValue: number; itemCount: number }[]> {
        assertNotCeo(user);
        await delay();
        const stock = await this.getLocationStock(user);
        const byCat: Record<string, { totalValue: number; itemCount: number }> = {};

        for (const row of stock) {
            const item = mockDB.inventoryItems.find((i) => i.id === row.itemId);
            const catName = resolveCategoryName(item?.categoryId ?? "");
            if (!byCat[catName]) byCat[catName] = { totalValue: 0, itemCount: 0 };
            byCat[catName].totalValue += row.totalValue;
            byCat[catName].itemCount++;
        }

        return Object.entries(byCat).map(([categoryName, data]) => ({
            categoryName,
            ...data,
        }));
    },

    // ── MUTATION: Transfer Stock (double-entry ledger) ────────────────────
    async transferStock(
        user: AuthUser,
        input: { sourceLocationId: string; destinationLocationId: string; itemId: string; quantity: number }
    ): Promise<{ transferId: string }> {
        return withAuditGuard(async (ctx) => {
            assertNotCeo(user);
            assertCanMutateInventory(user, [Role.STORE_MANAGER]);

            if (input.quantity <= 0) throw new DomainError("Transfer quantity must be greater than 0", {
                metadata: { quantity: input.quantity },
            });
            assertLocationAccess(user, input.sourceLocationId);
            await delay();

            // ensure sufficient balance at source
            const tempUser: AuthUser = hasGlobalScope(user)
                ? user
                : ({ ...user, scope: { ...user.scope, locationId: input.sourceLocationId } } as AuthUser);

            const balances = computeLocationBalances(tempUser);
            const key = `${input.sourceLocationId}::${input.itemId}`;
            const onHand = balances.get(key)?.onHand ?? 0;
            if (onHand < input.quantity) {
                throw new DomainError("Insufficient stock to transfer", {
                    metadata: { onHand, requested: input.quantity },
                });
            }

            const referenceChainId = makeTraceId("tr_inv");
            ctx.referenceChainId = referenceChainId;

            const ts = new Date().toISOString();
            const transferId = `stx_${Date.now()}`;
            mockDB.stockTransfers.push({
                id: transferId,
                sourceLocationId: input.sourceLocationId,
                destinationLocationId: input.destinationLocationId,
                itemId: input.itemId,
                quantity: input.quantity,
                status: "APPROVED",
                requestedAt: ts,
                completedAt: ts,
            });

            const unitCost = latestUnitCost(input.sourceLocationId, input.itemId);
            const outId = `mov_${Date.now()}_to`;
            const inId = `mov_${Date.now()}_ti`;

            mockDB.stockMovements.push({
                id: outId,
                locationId: input.sourceLocationId,
                inventoryItemId: input.itemId,
                type: "TRANSFER_OUT",
                quantity: input.quantity,
                unitCost,
                referenceType: "STOCK_TRANSFER",
                referenceId: transferId,
                createdAt: ts,
                createdBy: user.id,
            });
            createAuditLog({
                user,
                entityType: "StockMovement",
                entityId: outId,
                action: "CREATE",
                changes: JSON.stringify({ ...input, type: "TRANSFER_OUT" }),
                at: ts,
                referenceChainId,
                locationId: input.sourceLocationId,
                beforeState: null,
                afterState: structuredClone(mockDB.stockMovements.find((m) => m.id === outId)),
            });

            mockDB.stockMovements.push({
                id: inId,
                locationId: input.destinationLocationId,
                inventoryItemId: input.itemId,
                type: "TRANSFER_IN",
                quantity: input.quantity,
                unitCost,
                referenceType: "STOCK_TRANSFER",
                referenceId: transferId,
                createdAt: ts,
                createdBy: user.id,
            });
            createAuditLog({
                user,
                entityType: "StockMovement",
                entityId: inId,
                action: "CREATE",
                changes: JSON.stringify({ ...input, type: "TRANSFER_IN" }),
                at: ts,
                referenceChainId,
                locationId: input.destinationLocationId,
                beforeState: null,
                afterState: structuredClone(mockDB.stockMovements.find((m) => m.id === inId)),
            });

            return { transferId };
        }, {
            actorId: user.id,
            actorRole: user.role,
            locationId: input.sourceLocationId,
            entityType: "STOCK_TRANSFER",
            action: "TRANSFER",
        });
    },

    // ── MUTATION: Issue to Department (ledger) ────────────────────────────
    async issueToDepartment(
        user: AuthUser,
        input: { locationId: string; departmentId: string; itemId: string; quantity: number; referenceId?: string }
    ): Promise<{ movementId: string }> {
        return withAuditGuard(async (ctx) => {
            assertNotCeo(user);
            assertCanMutateInventory(user, [Role.DEPARTMENT_HEAD]);

            if (input.quantity <= 0) {
                throw new DomainError("Issue quantity must be greater than 0", {
                    metadata: { quantity: input.quantity },
                });
            }
            assertLocationAccess(user, input.locationId);
            await delay();

            if (user.scope.departmentId && user.scope.departmentId !== input.departmentId) {
                throw new ScopeViolationError("[Scope] Department head can only issue for their department", {
                    metadata: { userId: user.id, departmentId: input.departmentId, assignedDepartmentId: user.scope.departmentId },
                });
            }

            const dept = mockDB.departments.find((d) => d.id === input.departmentId);
            if (!dept) throw new DomainError("Department not found", { metadata: { departmentId: input.departmentId } });
            if (dept.locationId !== input.locationId) {
                throw new DomainError("Department must belong to the same location", {
                    metadata: { departmentId: dept.id, departmentLocationId: dept.locationId, inputLocationId: input.locationId },
                });
            }

            const tempUser: AuthUser = hasGlobalScope(user)
                ? user
                : ({ ...user, scope: { ...user.scope, locationId: input.locationId } } as AuthUser);

            const balances = computeLocationBalances(tempUser);
            const key = `${input.locationId}::${input.itemId}`;
            const onHand = balances.get(key)?.onHand ?? 0;
            if (onHand < input.quantity) {
                throw new DomainError("Insufficient stock to issue", {
                    metadata: { onHand, requested: input.quantity },
                });
            }

            const referenceChainId = makeTraceId("tr_inv");
            ctx.referenceChainId = referenceChainId;

            const unitCost = latestUnitCost(input.locationId, input.itemId);
            const ts = new Date().toISOString();
            const movementId = `mov_${Date.now()}`;

            mockDB.stockMovements.push({
                id: movementId,
                locationId: input.locationId,
                departmentId: input.departmentId,
                inventoryItemId: input.itemId,
                type: "DEPARTMENT_ISSUE",
                quantity: input.quantity,
                unitCost,
                referenceType: "DEPARTMENT_ISSUE",
                referenceId: input.referenceId ?? input.departmentId,
                createdAt: ts,
                createdBy: user.id,
            });
            createAuditLog({
                user,
                entityType: "StockMovement",
                entityId: movementId,
                action: "CREATE",
                changes: JSON.stringify(input),
                at: ts,
                referenceChainId,
                locationId: input.locationId,
                beforeState: null,
                afterState: structuredClone(mockDB.stockMovements.find((m) => m.id === movementId)),
            });

            return { movementId };
        }, {
            actorId: user.id,
            actorRole: user.role,
            locationId: input.locationId,
            entityType: "StockMovement",
            action: "DEPARTMENT_ISSUE",
        });
    },

    // ── MUTATION: Adjust Stock (ledger) ───────────────────────────────────
    async adjustStock(
        user: AuthUser,
        input: { locationId: string; itemId: string; adjustment: number; unitCost?: number; reason: string }
    ): Promise<{ movementId: string }> {
        return withAuditGuard(async (ctx) => {
            assertNotCeo(user);
            assertCanMutateInventory(user, [Role.STORE_MANAGER]);

            if (input.adjustment === 0) {
                throw new DomainError("Adjustment must be non-zero", {
                    metadata: { adjustment: input.adjustment },
                });
            }
            assertLocationAccess(user, input.locationId);
            await delay();

            // prevent negative ending balance
            const tempUser: AuthUser = hasGlobalScope(user)
                ? user
                : ({ ...user, scope: { ...user.scope, locationId: input.locationId } } as AuthUser);

            const balances = computeLocationBalances(tempUser);
            const key = `${input.locationId}::${input.itemId}`;
            const onHand = balances.get(key)?.onHand ?? 0;
            if (onHand + input.adjustment < 0) {
                throw new DomainError("Adjustment would make stock negative", {
                    metadata: { onHand, adjustment: input.adjustment },
                });
            }

            const referenceChainId = makeTraceId("tr_inv");
            ctx.referenceChainId = referenceChainId;

            const ts = new Date().toISOString();
            const movementId = `mov_${Date.now()}`;
            mockDB.stockMovements.push({
                id: movementId,
                locationId: input.locationId,
                inventoryItemId: input.itemId,
                type: "ADJUSTMENT",
                quantity: input.adjustment,
                unitCost: input.unitCost ?? latestUnitCost(input.locationId, input.itemId),
                referenceType: "MANUAL_ADJUSTMENT",
                referenceId: `adj_${Date.now()}`,
                createdAt: ts,
                createdBy: user.id,
            });
            createAuditLog({
                user,
                entityType: "StockMovement",
                entityId: movementId,
                action: "CREATE",
                changes: JSON.stringify({ ...input, reason: input.reason }),
                at: ts,
                referenceChainId,
                locationId: input.locationId,
                beforeState: null,
                afterState: structuredClone(mockDB.stockMovements.find((m) => m.id === movementId)),
            });

            return { movementId };
        }, {
            actorId: user.id,
            actorRole: user.role,
            locationId: input.locationId,
            entityType: "StockMovement",
            action: "ADJUSTMENT",
        });
    },
};
