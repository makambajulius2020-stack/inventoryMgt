import type { AuthApi } from "@/lib/api/types";
import { Role } from "@/lib/auth/roles";
import type { AuthUser } from "@/lib/auth/types";

const BRANCH_CODE_TO_NAME: Record<string, string> = {
  "pb-01": "The Patiobela",
  "pb-02": "The Maze Kololo",
  "er-01": "Eateroo",
};

const BRANCH_CODE_TO_ID: Record<string, string> = {
  "pb-01": "BR-001",
  "pb-02": "BR-002",
  "er-01": "BR-003",
};

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
      department_head: Role.DEPARTMENT_HEAD,
    };

    const role = (roleSlug && roleMap[roleSlug]) || Role.STORE_MANAGER;
    const branchName = branchCode ? BRANCH_CODE_TO_NAME[branchCode] : undefined;
    const branchId = branchCode ? BRANCH_CODE_TO_ID[branchCode] : null;

    if (!branchName && !isCeoEmail(lower)) {
      // Fallback for some legacy test accounts if any
    }

    const user: AuthUser = {
      id: `u_${userPart}`,
      name: `${roleSlug?.replace("_", " ")} ${branchCode || ""}`.trim(),
      email,
      role,
      scope: {
        allLocations: false,
        locationId: branchId ?? undefined,
        departmentId: undefined,
      },
    };

    return { user, token: `mock.jwt.${userPart}` };
  },
};

function isCeoEmail(email: string) {
  return email.toLowerCase() === "ceo@company.com";
}

