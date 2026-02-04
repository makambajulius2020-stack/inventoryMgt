import type { RoleName } from "@/lib/auth/types";

const ROLE_PRIORITY: RoleName[] = [
  "CEO",
  "BRANCH_MANAGER",
  "PROCUREMENT_HEAD",
  "STORE_MANAGER",
  "FINANCE",
  "DEPARTMENT_HEAD",
  "DEPARTMENT_STAFF",
];

export function getHighestPriorityRole(roles: string[]): RoleName | null {
  const set = new Set(roles);
  for (const r of ROLE_PRIORITY) {
    if (set.has(r)) return r;
  }
  return null;
}

export function getLandingRouteForRoles(roles: string[]): string {
  const highest = getHighestPriorityRole(roles);
  switch (highest) {
    case "CEO":
      return "/ceo/dashboard";
    case "BRANCH_MANAGER":
      return "/branch/dashboard";
    case "PROCUREMENT_HEAD":
      return "/procurement/dashboard";
    case "STORE_MANAGER":
      return "/store/dashboard";
    case "FINANCE":
      return "/finance/dashboard";
    case "DEPARTMENT_HEAD":
      return "/department/dashboard";
    case "DEPARTMENT_STAFF":
      return "/requisitions/new";
    default:
      return "/login";
  }
}
