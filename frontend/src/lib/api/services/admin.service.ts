/**
 * Admin Service — User management, location/department CRUD.
 * CEO: full access to all users across all locations.
 * GM: can manage users within their own location.
 * Auditor: read-only (mutations blocked by _guards).
 */

import { mockDB } from "../../mock-db";
import type { AuthUser } from "@/lib/auth/types";
import {
    assertCanMutate,
    hasGlobalScope,
} from "./_guards";
import { normalizeRole, Role } from "@/lib/auth/roles";
import { AuthorizationError, DomainError, ScopeViolationError } from "@/lib/runtime/errors";

const DELAY = 300;
const delay = () => new Promise((r) => setTimeout(r, DELAY));

export interface UserRow {
    id: string;
    name: string;
    email: string;
    role: string;
    status: string;
    locationName: string;
    departmentName: string;
}

export interface LocationRow {
    id: string;
    name: string;
    code: string;
    type: string;
    address: string;
    status: string;
    staffCount: number;
}

export interface DepartmentRow {
    id: string;
    name: string;
    code: string;
    locationName: string;
    status: string;
    staffCount: number;
}

type UserStatus = "ACTIVE" | "INACTIVE" | "ARCHIVED";

type UserAuditLogRow = {
    id: string;
    userId: string;
    timestamp: string;
    action: string;
    entityType: string;
    entityId: string;
    changes: string;
    referenceChainId?: string;
};

function resolveLocationName(id?: string) {
    return id ? (mockDB.locations.find((l) => l.id === id)?.name ?? "—") : "—";
}
function resolveDeptName(id?: string) {
    return id ? (mockDB.departments.find((d) => d.id === id)?.name ?? "—") : "—";
}

export const adminService = {
    // ── Users (scope-filtered) ────────────────────────────────────────────
    async listUsers(user: AuthUser): Promise<UserRow[]> {
        await delay();
        const users = hasGlobalScope(user)
            ? mockDB.users
            : mockDB.users.filter((u) => u.locationId === user.scope.locationId);

        return users.map((u) => ({
            id: u.id,
            name: u.name,
            email: u.email,
            role: u.role,
            status: u.status,
            locationName: resolveLocationName(u.locationId),
            departmentName: resolveDeptName(u.departmentId),
        }));
    },

    // ── Locations ─────────────────────────────────────────────────────────
    async listLocations(): Promise<LocationRow[]> {
        await delay();
        return mockDB.locations.map((l) => ({
            id: l.id,
            name: l.name,
            code: l.code,
            type: l.type,
            address: l.address,
            status: l.status,
            staffCount: mockDB.users.filter((u) => u.locationId === l.id && u.status === "ACTIVE").length,
        }));
    },

    // ── Departments (scope-filtered) ──────────────────────────────────────
    async listDepartments(user: AuthUser): Promise<DepartmentRow[]> {
        await delay();
        const depts = hasGlobalScope(user)
            ? mockDB.departments
            : mockDB.departments.filter((d) => d.locationId === user.scope.locationId);

        return depts.map((d) => ({
            id: d.id,
            name: d.name,
            code: d.code,
            locationName: resolveLocationName(d.locationId),
            status: d.status,
            staffCount: mockDB.users.filter((u) => u.departmentId === d.id && u.status === "ACTIVE").length,
        }));
    },

    // ── MUTATION: Create User ─────────────────────────────────────────────
    async createUser(user: AuthUser, input: { name: string; email: string; role: string; locationId?: string; departmentId?: string }): Promise<UserRow> {
        assertCanMutate(user);
        const callerRole = normalizeRole(user.role);
        if (!callerRole) throw new AuthorizationError("[RBAC] Invalid caller role", { metadata: { role: user.role } });

        if (callerRole !== Role.CEO && callerRole !== Role.GENERAL_MANAGER) {
            throw new AuthorizationError("[RBAC] Only CEO or GM can create users", { metadata: { role: user.role } });
        }

        const targetRole = normalizeRole(input.role);
        if (!targetRole) throw new DomainError("Invalid role assigned to user", { metadata: { role: input.role } });

        if (callerRole === Role.GENERAL_MANAGER) {
            // GM governance: cannot create global roles and must create within own location
            if (targetRole === Role.CEO || targetRole === Role.SYSTEM_AUDITOR) {
                throw new AuthorizationError("[RBAC] GM cannot create global-scope roles", { metadata: { requestedRole: input.role } });
            }
            if (!input.locationId || input.locationId !== user.scope.locationId) {
                throw new ScopeViolationError("[RBAC] GM can only create users within their own location", {
                    metadata: { callerLocationId: user.scope.locationId, inputLocationId: input.locationId },
                });
            }
        }

        await delay();

        const newUser = {
            id: `usr_${Date.now()}`,
            name: input.name,
            email: input.email,
            role: targetRole,
            status: "ACTIVE" as const,
            locationId: input.locationId,
            departmentId: input.departmentId,
        };
        mockDB.users.push(newUser);

        return {
            id: newUser.id,
            name: newUser.name,
            email: newUser.email,
            role: newUser.role,
            status: newUser.status,
            locationName: resolveLocationName(newUser.locationId),
            departmentName: resolveDeptName(newUser.departmentId),
        };
    },

    // ── MUTATION: Update User Status ──────────────────────────────────────
    async updateUserStatus(caller: AuthUser, userId: string, status: UserStatus): Promise<void> {
        assertCanMutate(caller);
        const callerRole = normalizeRole(caller.role);
        if (!callerRole) throw new AuthorizationError("[RBAC] Invalid caller role", { metadata: { role: caller.role } });
        if (callerRole !== Role.CEO && callerRole !== Role.GENERAL_MANAGER) {
            throw new AuthorizationError("[RBAC] Only CEO or GM can update user status", { metadata: { role: caller.role } });
        }
        await delay();
        const target = mockDB.users.find((u) => u.id === userId);
        if (!target) throw new DomainError("User not found", { metadata: { userId } });

        if (callerRole === Role.GENERAL_MANAGER && target.locationId !== caller.scope.locationId) {
            throw new ScopeViolationError("[RBAC] GM can only manage users in their location", {
                metadata: { callerLocationId: caller.scope.locationId, targetLocationId: target.locationId },
            });
        }
        target.status = status;
    },

    // ── Audit Logs for a specific user ────────────────────────────────────
    async getUserAuditLogs(userId: string): Promise<UserAuditLogRow[]> {
        await delay();
        return mockDB.auditLogs.filter((l) => l.userId === userId);
    },
};
