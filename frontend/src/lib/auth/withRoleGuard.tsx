"use client";

import { useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";

import { useAuth } from "@/contexts/AuthContext";
import { getLandingRouteForRoles } from "@/lib/auth/roleRouting";
import { deriveUserScope, isReadOnlyRole, normalizeRole, type GuardRequirements, type ScopeKind, Role } from "@/lib/auth/roles";

function hasRequiredScope(params: { required?: ScopeKind; userScope: ReturnType<typeof deriveUserScope> }) {
  if (!params.required) return true;

  if (params.required === "GLOBAL") {
    return params.userScope.kind === "GLOBAL";
  }

  if (params.required === "LOCATION") {
    return params.userScope.kind === "GLOBAL" || (params.userScope.kind === "LOCATION" && !!params.userScope.locationId);
  }

  if (params.required === "DEPARTMENT") {
    return params.userScope.kind === "GLOBAL" || (params.userScope.kind === "DEPARTMENT" && !!params.userScope.locationId && !!params.userScope.departmentId);
  }

  return false;
}

export function useRoleGuard(requirements: GuardRequirements) {
  const { state } = useAuth();

  const role = useMemo(() => {
    const r = state.user?.role;
    return r ? normalizeRole(r) : null;
  }, [state.user?.role]);

  const scope = useMemo(() => {
    if (!state.user || !role) return null;
    return deriveUserScope({
      role,
      allLocations: !!state.user.scope.allLocations,
      locationId: state.user.scope.locationId,
      departmentId: state.user.scope.departmentId,
    });
  }, [state.user, role]);

  const allowed = useMemo(() => {
    if (!state.token || !state.user || !role || !scope) return false;
    if (!requirements.roles.includes(role)) return false;
    if (!hasRequiredScope({ required: requirements.requireScope, userScope: scope })) return false;
    return true;
  }, [state.token, state.user, role, scope, requirements.roles, requirements.requireScope]);

  const isReadOnly = useMemo(() => {
    return role ? isReadOnlyRole(role) : false;
  }, [role]);

  return { allowed, role, scope, isReadOnly };
}

export function WithRoleGuard({ requirements, children }: { requirements: GuardRequirements; children: React.ReactNode }) {
  const router = useRouter();
  const { state } = useAuth();
  const { allowed } = useRoleGuard(requirements);

  useEffect(() => {
    if (!state.token) {
      router.replace("/login");
      return;
    }

    if (!allowed) {
      router.replace(getLandingRouteForRoles(state.roles));
    }
  }, [allowed, router, state.roles, state.token]);

  if (!state.token) return null;
  if (!allowed) return null;

  return <>{children}</>;
}

export function assertNotReadOnly(params: { role: Role; action: string }) {
  if (isReadOnlyRole(params.role)) {
    throw new Error(`Forbidden: ${params.action} is not allowed for Auditor`);
  }
}
