import { mockDB } from "@/lib/mock-db";
import { InvariantViolationError } from "@/lib/runtime/errors";
import { asDomainError } from "@/lib/runtime/errors";
import { logMutationFailure, logMutationStart, logMutationSuccess } from "@/lib/core/operational-logger";
import { consumeRateLimit } from "@/lib/core/rate-limiter";

export type AuditGuardContext = {
    referenceChainId?: string;
};

export type MutationLogMeta = {
    actorId: string;
    actorRole: string;
    locationId?: string;
    entityType: string;
    action: string;
};

function shouldThrottle(meta: MutationLogMeta): boolean {
    // Apply only to:
    // - financial posting
    // - inventory adjustments
    // - procurement status transitions
    if (meta.entityType === "StockMovement" && meta.action === "ADJUSTMENT") return true;

    if (meta.entityType === "REQUISITION" && meta.action === "TRANSITION") return true;
    if (meta.entityType === "LPO" && meta.action === "TRANSITION") return true;
    if (meta.entityType === "SUPPLIER_INVOICE" && meta.action === "TRANSITION") return true;
    if (meta.entityType === "PAYMENT_REQUEST" && meta.action === "TRANSITION") return true;
    if (meta.entityType === "GRN" && meta.action === "RECEIVE") return true;

    if (meta.entityType === "SUPPLIER_INVOICE" && meta.action === "APPROVE") return true;
    if (meta.entityType === "PAYMENT" && meta.action === "CREATE") return true;
    if (meta.entityType === "EXPENSE_PAYMENT" && meta.action === "CREATE") return true;
    if (meta.entityType === "SALE" && meta.action === "POST_REVENUE") return true;
    if (meta.entityType === "REVERSAL" && meta.action === "POST_MANUAL_REVERSAL") return true;
    if (meta.entityType === "LEDGER_REVERSAL" && meta.action === "REVERSE_REFERENCE") return true;

    return false;
}

function makeOperationalTraceId(prefix = "tr_op"): string {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export async function withAuditGuard<T>(mutationFn: (ctx: AuditGuardContext) => Promise<T>, meta?: MutationLogMeta): Promise<T> {
    const ctx: AuditGuardContext = {};
    const beforeLen = mockDB.auditLogs.length;

    const startedAt = Date.now();
    const provisionalTraceId = makeOperationalTraceId();
    const startTimestamp = new Date().toISOString();

    if (meta) {
        logMutationStart({
            traceId: provisionalTraceId,
            actorId: meta.actorId,
            actorRole: meta.actorRole,
            locationId: meta.locationId,
            entityType: meta.entityType,
            action: meta.action,
            executionTimeMs: 0,
            timestamp: startTimestamp,
        });
    }

    try {
        if (meta && shouldThrottle(meta)) {
            consumeRateLimit({
                actorId: meta.actorId,
                locationId: meta.locationId,
                mutationType: `${meta.entityType}:${meta.action}`,
            });
        }

        const result = await mutationFn(ctx);

        const traceId = ctx.referenceChainId;
        if (!traceId) throw new InvariantViolationError("[Invariant] Mutation completed without referenceChainId");

        // Fast path: if audit log array did not grow, invariant violated
        if (mockDB.auditLogs.length <= beforeLen) {
            throw new InvariantViolationError("[Invariant] Mutation completed without audit write");
        }

        // Deterministic check: ensure at least one new audit entry belongs to this trace
        for (let i = beforeLen; i < mockDB.auditLogs.length; i++) {
            if (mockDB.auditLogs[i]?.referenceChainId === traceId) {
                if (meta) {
                    const execMs = Date.now() - startedAt;
                    logMutationSuccess({
                        traceId,
                        actorId: meta.actorId,
                        actorRole: meta.actorRole,
                        locationId: meta.locationId,
                        entityType: meta.entityType,
                        action: meta.action,
                        executionTimeMs: execMs,
                        timestamp: new Date().toISOString(),
                    });
                }
                return result;
            }
        }

        throw new InvariantViolationError("[Invariant] Mutation completed without audit write for referenceChainId");
    } catch (err) {
        if (meta) {
            const traceId = ctx.referenceChainId ?? provisionalTraceId;
            const execMs = Date.now() - startedAt;
            const domainErr = asDomainError(err);
            logMutationFailure({
                traceId,
                actorId: meta.actorId,
                actorRole: meta.actorRole,
                locationId: meta.locationId,
                entityType: meta.entityType,
                action: meta.action,
                executionTimeMs: execMs,
                errorType: domainErr.code,
                timestamp: new Date().toISOString(),
            });
        }
        throw err;
    }
}
