import { mockDB } from "../../mock-db";
import type { AuthUser } from "@/lib/auth/types";
import { assertLocationAccess, hasGlobalScope } from "./_guards";

export interface TraceChainEntry {
    id: string;
    timestamp: string;
    userId: string;
    actorRole?: string;
    actorLocationId?: string;
    action: string;
    entityType: string;
    entityId: string;
    changes: string;
    referenceChainId?: string;
    locationId?: string;
    metadata?: Record<string, unknown>;
    beforeState?: unknown;
    afterState?: unknown;
}

function canReadTrace(user: AuthUser): boolean {
    return hasGlobalScope(user) || user.role === "FINANCE_MANAGER" || user.role === "GENERAL_MANAGER" || user.role === "PROCUREMENT_OFFICER" || user.role === "STORE_MANAGER" || user.role === "DEPARTMENT_HEAD";
}

export const auditService = {
    async getTraceChain(user: AuthUser, traceId: string): Promise<TraceChainEntry[]> {
        if (!traceId) throw new Error("traceId is required");
        if (!canReadTrace(user)) throw new Error("[RBAC] Not permitted to view audit trace chains");

        const chain = mockDB.auditLogs.filter((l) => l.referenceChainId === traceId);

        // Scope enforcement: for non-global users, every entry must be in their location
        if (!hasGlobalScope(user)) {
            const locations = new Set(chain.map((c) => c.locationId).filter(Boolean) as string[]);
            if (locations.size === 0) {
                // If logs lack locationId, fall back to user scope: deny (avoid leaking cross-branch traces)
                throw new Error("[Scope] Trace entries missing locationId; access denied for non-global users");
            }
            if (locations.size > 1) {
                // Mixed location trace: only global users can read.
                throw new Error("[Scope] Cross-location trace chains require global scope");
            }
            assertLocationAccess(user, Array.from(locations)[0]);
        }

        return chain
            .map((l) => ({
                id: l.id,
                timestamp: l.timestamp,
                userId: l.userId,
                actorRole: l.actorRole,
                actorLocationId: l.actorLocationId,
                action: l.action,
                entityType: l.entityType,
                entityId: l.entityId,
                changes: l.changes,
                referenceChainId: l.referenceChainId,
                locationId: l.locationId,
                metadata: l.metadata,
                beforeState: l.beforeState,
                afterState: l.afterState,
            }))
            .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    },
};
