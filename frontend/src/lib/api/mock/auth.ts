import type { AuthApi } from "@/lib/api/types";
import { DEMO_LOCATIONS, type DemoLocation } from "@/lib/locations";

const BRANCH_CODE_TO_NAME: Record<string, DemoLocation> = {
  "pb-01": "The Patiobela",
  "pb-02": "The Maze Bistro",
  "pb-03": "The Maze Forest Mall",
  "it-01": "Itaru",
  "rd-01": "Rosa Dames",
};

const BRANCH_CODE_TO_ID: Record<string, number> = {
  "pb-01": 1,
  "pb-02": 2,
  "pb-03": 3,
  "it-01": 4,
  "rd-01": 5,
};

export const mockAuthApi: AuthApi = {
  async login({ email }) {
    const lower = email.toLowerCase();
    const isCeo = lower === "ceo@company.com";

    const local = lower.split("@", 1)[0] ?? "";
    const parts = local.split(".");
    const role = isCeo ? "CEO" : (parts[0] ?? "DEPARTMENT_STAFF").toUpperCase();
    const branchCode = !isCeo ? (parts[1] ?? "") : "";
    const branchName = branchCode ? BRANCH_CODE_TO_NAME[branchCode] : undefined;
    const branchId = branchCode && BRANCH_CODE_TO_ID[branchCode] ? BRANCH_CODE_TO_ID[branchCode] : null;

    return {
      user: {
        id: "u_1",
        name: isCeo ? "CEO User" : "Demo User",
        email,
      },
      roles: [role],
      allowedLocations: role === "CEO" ? [...DEMO_LOCATIONS] : branchName ? ([branchName] as DemoLocation[]) : [],
      token: "mock.jwt.token",
      userContext: {
        userId: 1,
        role,
        branchId,
        departmentId: role === "DEPARTMENT_HEAD" || role === "DEPARTMENT_STAFF" ? 1 : null,
      },
    };
  },
};
