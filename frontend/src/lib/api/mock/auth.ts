import type { AuthApi } from "@/lib/api/types";
import { Role } from "@/lib/auth/roles";
import type { AuthUser } from "@/lib/auth/types";
import { mockDB } from "@/lib/mock-db";

const BRANCH_CODE_TO_LOCATION_CODE: Record<string, string> = {
  "pb": "PB01",
  "mk": "MK01",
  "wh": "WH01",
};

function resolveLocationIdFromBranchCode(branchCode?: string) {
  if (!branchCode) return undefined;
  const key = branchCode.split("-")[0] ?? branchCode;
  const locationCode = BRANCH_CODE_TO_LOCATION_CODE[key];
  if (!locationCode) return undefined;
  return mockDB.locations.find((l) => l.code === locationCode)?.id;
}

export const mockAuthApi: AuthApi = {
  async login({ email }) {
    const lower = email.toLowerCase();

    // CEO — global scope
    if (lower === "ceo@company.com") {
      const user: AuthUser = {
        id: "u_ceo",
        name: "CEO",
        email,
        role: Role.CEO,
        scope: { allLocations: true },
      };
      return { user, token: "mock.jwt.ceo" };
    }

    // System Auditor — global scope, hard read-only
    if (lower === "auditor@company.com") {
      const user: AuthUser = {
        id: "u_auditor",
        name: "System Auditor",
        email,
        role: Role.SYSTEM_AUDITOR,
        scope: { allLocations: true },
      };
      return { user, token: "mock.jwt.auditor" };
    }

    // Role.BranchCode@company.com format (management roles only)
    const [userPart] = lower.split("@");
    if (!userPart) throw new Error("Invalid email");

    const parts = userPart.split(".");
    const roleSlug = parts[0];
    const branchCode = parts[1];

    const roleMap: Record<string, Role> = {
      gm: Role.GENERAL_MANAGER,
      finance: Role.FINANCE_MANAGER,
      procurement: Role.PROCUREMENT_OFFICER,
      store: Role.STORE_MANAGER,
      controller: Role.STORE_CONTROLLER,
      store_controller: Role.STORE_CONTROLLER,
      department_head: Role.DEPARTMENT_HEAD,
    };

    const role = (roleSlug && roleMap[roleSlug]) || Role.STORE_MANAGER;
    const locationId = resolveLocationIdFromBranchCode(branchCode);

    if (!locationId && !isCeoEmail(lower)) {
      // Fallback for some legacy test accounts if any
    }

    const user: AuthUser = {
      id: `u_${userPart}`,
      name: `${roleSlug?.replace("_", " ")} ${branchCode || ""}`.trim(),
      email,
      role,
      scope: {
        allLocations: false,
        locationId,
        departmentId: undefined,
      },
    };

    return { user, token: `mock.jwt.${userPart}` };
  },
};

function isCeoEmail(email: string) {
  return email.toLowerCase() === "ceo@company.com";
}

