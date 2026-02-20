import type {
  AdminUsersApi,
  AdminUsersFilters,
  AdminUserDTO,
  AdminUserAuditEventDTO,
  CreateAdminUserInput,
  CreateAdminUserResultDTO,
  UserStatus,
} from "@/lib/api/types";
import { ALL_BRANCHES_LABEL, getDemoBranchPool } from "@/lib/locations";

function nowIso() {
  return new Date().toISOString();
}

function uid(prefix: string) {
  return `${prefix}_${Math.random().toString(16).slice(2)}_${Date.now()}`;
}

function makeTempPassword() {
  return `Temp-${Math.random().toString(36).slice(2, 10)}`;
}

const BRANCHES = getDemoBranchPool();
const DEPARTMENTS = ["Kitchen", "Bar", "Housekeeping", "Front Office", "Maintenance"] as const;

let USERS: AdminUserDTO[] = [
  {
    id: "u_admin_1",
    fullName: "CEO User",
    email: "ceo@company.com",
    role: "CEO",
    status: "ACTIVE",
    lastLogin: nowIso(),
  },
  {
    id: "u_gm_1",
    fullName: "General Manager (The Patiobela)",
    email: "gm.patiobela@demo.local",
    role: "GENERAL_MANAGER",
    branch: BRANCHES[0] ?? "The Patiobela",
    status: "ACTIVE",
    lastLogin: nowIso(),
  },
  {
    id: "u_fin_1",
    fullName: "Finance (The Maze Bistro)",
    email: "finance.bistro@demo.local",
    role: "FINANCE_MANAGER",
    branch: BRANCHES[1] ?? "The Maze Bistro",
    status: "ACTIVE",
    lastLogin: nowIso(),
  },
];

const AUDIT: AdminUserAuditEventDTO[] = [
  {
    id: "audit_1",
    userId: "u_gm_1",
    actorName: "CEO User",
    action: "USER_CREATED",
    at: nowIso(),
    details: "Created GENERAL_MANAGER for location",
  },
];

function matchesFilters(u: AdminUserDTO, f?: AdminUsersFilters) {
  if (!f) return true;
  if (f.branch && u.branch !== f.branch) return false;
  if (f.role && u.role !== f.role) return false;
  if (f.status && u.status !== f.status) return false;
  return true;
}

function validate(input: CreateAdminUserInput) {
  if (!input.fullName.trim()) throw new Error("Full Name is required");
  if (!input.email.trim()) throw new Error("Email is required");

  const email = input.email.toLowerCase();
  if (USERS.some((u) => u.email.toLowerCase() === email)) {
    throw new Error("Email already exists");
  }

  const role = input.role;
  const needsBranch = role !== "CEO";
  const needsDept = false;

  if (needsBranch) {
    if (!input.branch || input.branch === ALL_BRANCHES_LABEL) throw new Error("Branch is required for this role");
  }

  if (needsDept) {
    throw new Error("Department is required for this role");
  }
}

export const mockAdminUsersApi: AdminUsersApi = {
  async list(filters?: AdminUsersFilters) {
    return { rows: USERS.filter((u) => matchesFilters(u, filters)) };
  },

  async create(input: CreateAdminUserInput): Promise<CreateAdminUserResultDTO> {
    validate(input);

    const user: AdminUserDTO = {
      id: uid("u"),
      fullName: input.fullName,
      email: input.email,
      phone: input.phone,
      role: input.role,
      branch: input.branch,
      status: input.status,
      lastLogin: undefined,
    };

    USERS = [user, ...USERS];

    AUDIT.unshift({
      id: uid("audit"),
      userId: user.id,
      actorName: "CEO User",
      action: "USER_CREATED",
      at: nowIso(),
      details: `Created user (${user.role})`,
    });

    return {
      user,
      inviteLink: `https://demo.local/invite/${user.id}`,
      tempPassword: makeTempPassword(),
    };
  },

  async updateStatus(userId: string, status: UserStatus) {
    const u = USERS.find((x) => x.id === userId);
    if (!u) throw new Error("User not found");
    u.status = status;

    AUDIT.unshift({
      id: uid("audit"),
      userId,
      actorName: "CEO User",
      action: status === "ACTIVE" ? "USER_ENABLED" : "USER_DISABLED",
      at: nowIso(),
      details: `Set status to ${status}`,
    });

    return { ok: true } as const;
  },

  async resetPassword(userId: string) {
    const u = USERS.find((x) => x.id === userId);
    if (!u) throw new Error("User not found");

    const tempPassword = makeTempPassword();

    AUDIT.unshift({
      id: uid("audit"),
      userId,
      actorName: "CEO User",
      action: "PASSWORD_RESET",
      at: nowIso(),
      details: "Password reset issued",
    });

    return { ok: true as const, tempPassword };
  },

  async getAudit(userId: string) {
    return { rows: AUDIT.filter((a) => a.userId === userId) };
  },
};

export const ADMIN_USER_DEPARTMENTS = [...DEPARTMENTS];
export const ADMIN_USER_BRANCHES = [...BRANCHES];
