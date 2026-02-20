/**
 * Service-layer RBAC enforcement utilities.
 * Every domain service must call these before returning or mutating data.
 *
 * Three enforcement layers:
 *   1. Route guard (WithRoleGuard HOC) — UI level
 *   2. Service guard (this file)       — data filtering + mutation blocking
 *   3. Data filtering (scopeFilter)    — row-level scope enforcement
 */

import type { AuthUser } from "@/lib/auth/types";
import { isReadOnlyRole, normalizeRole, Role } from "@/lib/auth/roles";
import { AuthorizationError, ScopeViolationError } from "@/lib/runtime/errors";

// ─── READ-ONLY ENFORCEMENT ───────────────────────────────────────────────────

function assertValidAuthContext(user: AuthUser): Role {
  if (!user?.id) {
    throw new AuthorizationError("[RBAC] Missing user context", { metadata: { userId: user?.id } });
  }

  const role = normalizeRole(user.role);
  if (!role) throw new AuthorizationError("[RBAC] Invalid role", { metadata: { role: user.role } });

  const isGlobalRole = role === Role.CEO || role === Role.SYSTEM_AUDITOR;
  if (isGlobalRole && user.scope.allLocations !== true) {
    throw new AuthorizationError("[RBAC] Invalid scope: global role must have allLocations=true", {
      metadata: { role: user.role, allLocations: user.scope.allLocations },
    });
  }
  if (!isGlobalRole && user.scope.allLocations === true) {
    throw new AuthorizationError("[RBAC] Invalid scope: non-global role cannot have allLocations=true", {
      metadata: { role: user.role, allLocations: user.scope.allLocations },
    });
  }

  if (!isGlobalRole && !user.scope.locationId) {
    throw new ScopeViolationError("[RBAC] Invalid scope: missing locationId for non-global role", {
      metadata: { role: user.role },
    });
  }
  if (role === Role.DEPARTMENT_HEAD && !user.scope.departmentId) {
    throw new ScopeViolationError("[RBAC] Invalid scope: missing departmentId for DEPARTMENT_HEAD", {
      metadata: { role: user.role, locationId: user.scope.locationId },
    });
  }

  return role;
}

/**
 * Throws if the user's role is read-only (e.g. AUDITOR).
 * Must be called at the top of every mutation method in every service.
 */
export function assertCanMutate(user: AuthUser): void {
  const role = assertValidAuthContext(user);
  if (isReadOnlyRole(role)) {
    throw new AuthorizationError(`[RBAC] Role "${user.role}" is read-only. Mutation denied.`, {
      metadata: { userId: user.id, role: user.role },
    });
  }
}

// ─── SCOPE ENFORCEMENT ──────────────────────────────────────────────────────

/**
 * Returns true if the user has global scope (CEO, AUDITOR).
 */
export function hasGlobalScope(user: AuthUser): boolean {
  assertValidAuthContext(user);
  return user.scope.allLocations === true;
}

/**
 * Asserts the user can access a specific location.
 * CEO/AUDITOR can access all. Others must match locationId.
 */
export function assertLocationAccess(user: AuthUser, locationId: string): void {
  assertValidAuthContext(user);
  if (hasGlobalScope(user)) return;
  if (user.scope.locationId !== locationId) {
    throw new ScopeViolationError(
      `[RBAC] User "${user.id}" (role=${user.role}) cannot access location "${locationId}". ` +
        `Assigned location: "${user.scope.locationId}".`,
      { metadata: { userId: user.id, role: user.role, locationId, assignedLocationId: user.scope.locationId } }
    );
  }
}

/**
 * Asserts the user can access a specific department.
 * Global-scope and location-scope roles can access all departments in their location.
 * Department-scoped roles must match departmentId.
 */
export function assertDepartmentAccess(user: AuthUser, departmentId: string, locationId: string): void {
  assertValidAuthContext(user);
  assertLocationAccess(user, locationId);
  const isDeptScoped = user.role === "DEPARTMENT_HEAD";
  if (isDeptScoped && user.scope.departmentId !== departmentId) {
    throw new ScopeViolationError(
      `[RBAC] User "${user.id}" (role=${user.role}) cannot access department "${departmentId}". ` +
        `Assigned department: "${user.scope.departmentId}".`,
      { metadata: { userId: user.id, role: user.role, departmentId, assignedDepartmentId: user.scope.departmentId } }
    );
  }
}

// ─── DATA FILTERING (ROW-LEVEL) ─────────────────────────────────────────────

/**
 * Filters an array of records by locationId based on user scope.
 * CEO/AUDITOR see all. Others see only their location.
 */
export function scopeFilterByLocation<T extends { locationId: string }>(
  user: AuthUser,
  records: T[]
): T[] {
  assertValidAuthContext(user);
  if (hasGlobalScope(user)) return records;
  return records.filter((r) => r.locationId === user.scope.locationId);
}

/**
 * Filters an array of records by departmentId based on user scope.
 * Only department-scoped roles get filtered. Others see all departments in their location.
 */
export function scopeFilterByDepartment<T extends { departmentId?: string; locationId?: string }>(
  user: AuthUser,
  records: T[]
): T[] {
  assertValidAuthContext(user);
  // First filter by location
  const locationFiltered = records.filter((r) => {
    if (hasGlobalScope(user)) return true;
    return r.locationId === user.scope.locationId;
  });

  // Then filter by department if user is department-scoped
  const isDeptScoped = user.role === "DEPARTMENT_HEAD";
  if (!isDeptScoped || !user.scope.departmentId) return locationFiltered;

  return locationFiltered.filter(
    (r) => r.departmentId === user.scope.departmentId
  );
}

/**
 * Resolves the effective locationId for a user.
 * For global-scope users, returns undefined (meaning "all").
 * For location-scoped users, returns their assigned locationId.
 */
export function getEffectiveLocationId(user: AuthUser): string | undefined {
  assertValidAuthContext(user);
  if (hasGlobalScope(user)) return undefined;
  return user.scope.locationId;
}
