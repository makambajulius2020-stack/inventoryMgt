export enum Role {
  CEO = "CEO",
  SYSTEM_AUDITOR = "SYSTEM_AUDITOR",
  GENERAL_MANAGER = "GENERAL_MANAGER",
  DEPARTMENT_HEAD = "DEPARTMENT_HEAD",
  PROCUREMENT_OFFICER = "PROCUREMENT_OFFICER",
  STORE_MANAGER = "STORE_MANAGER",
  FINANCE_MANAGER = "FINANCE_MANAGER",
  STORE_CONTROLLER = "STORE_CONTROLLER",
}

export type ScopeKind = "GLOBAL" | "LOCATION" | "DEPARTMENT";

export type UserScope = {
  kind: ScopeKind;
  locationId?: string;
  departmentId?: string;
};

export type GuardRequirements = {
  roles: Role[];
  requireScope?: ScopeKind;
  readOnly?: boolean;
};

export const ROLE_SCOPE_KIND: Record<Role, ScopeKind> = {
  [Role.CEO]: "GLOBAL",
  [Role.SYSTEM_AUDITOR]: "GLOBAL",
  [Role.GENERAL_MANAGER]: "LOCATION",
  [Role.DEPARTMENT_HEAD]: "DEPARTMENT",
  [Role.PROCUREMENT_OFFICER]: "LOCATION",
  [Role.STORE_MANAGER]: "LOCATION",
  [Role.FINANCE_MANAGER]: "LOCATION",
  [Role.STORE_CONTROLLER]: "LOCATION",
};

export function isReadOnlyRole(role: Role) {
  return role === Role.SYSTEM_AUDITOR;
}

export function normalizeRole(input: string): Role | null {
  const upper = input.toUpperCase();

  if (upper === "CEO") return Role.CEO;
  if (upper === "AUDITOR" || upper === "SYSTEM_AUDITOR") return Role.SYSTEM_AUDITOR;
  if (upper === "GENERAL_MANAGER" || upper === "GM") return Role.GENERAL_MANAGER;
  if (upper === "DEPARTMENT_HEAD" || upper === "DEPT_HEAD") return Role.DEPARTMENT_HEAD;
  if (upper === "PROCUREMENT_OFFICER" || upper === "PROCUREMENT") return Role.PROCUREMENT_OFFICER;
  if (upper === "STORE_MANAGER" || upper === "STORE" || upper === "INVENTORY") return Role.STORE_MANAGER;
  if (upper === "FINANCE_MANAGER" || upper === "FINANCE") return Role.FINANCE_MANAGER;
  if (upper === "STORE_CONTROLLER" || upper === "CONTROLLER") return Role.STORE_CONTROLLER;

  return null;
}

export function deriveUserScope(params: {
  role: Role;
  allLocations: boolean;
  locationId?: string;
  departmentId?: string;
}): UserScope {
  const kind: ScopeKind = params.allLocations
    ? "GLOBAL"
    : ROLE_SCOPE_KIND[params.role] === "DEPARTMENT"
      ? "DEPARTMENT"
      : "LOCATION";

  return {
    kind,
    locationId: params.locationId,
    departmentId: params.departmentId,
  };
}
