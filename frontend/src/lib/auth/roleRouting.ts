import { RoleName } from "./types";

const ROLE_PRIORITY: RoleName[] = [
  "CEO",
  "SYSTEM_AUDITOR",
  "GENERAL_MANAGER",
  "FINANCE_MANAGER",
  "PROCUREMENT_OFFICER",
  "STORE_MANAGER",
  "DEPARTMENT_HEAD",
];

export function getHighestPriorityRole(roles: string[]): RoleName | null {
  for (const role of ROLE_PRIORITY) {
    if (roles.includes(role)) return role;
  }
  return null;
}

export function getLandingRouteForRoles(roles: string[]): string {
  const highest = getHighestPriorityRole(roles);

  const landingMap: Record<RoleName, string> = {
    CEO: "/ceo/dashboard",
    SYSTEM_AUDITOR: "/auditor/dashboard",
    GENERAL_MANAGER: "/gm/dashboard",
    FINANCE_MANAGER: "/finance/dashboard",
    PROCUREMENT_OFFICER: "/procurement/dashboard",
    STORE_MANAGER: "/inventory/dashboard",
    DEPARTMENT_HEAD: "/department/dashboard",
  };

  return highest ? landingMap[highest] : "/login";
}

export function getRolePrefix(role: RoleName): string {
  const prefixMap: Record<RoleName, string> = {
    CEO: "ceo",
    SYSTEM_AUDITOR: "auditor",
    GENERAL_MANAGER: "gm",
    FINANCE_MANAGER: "finance",
    PROCUREMENT_OFFICER: "procurement",
    STORE_MANAGER: "inventory",
    DEPARTMENT_HEAD: "department",
  };
  return prefixMap[role];
}
