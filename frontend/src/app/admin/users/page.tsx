"use client";

import { useEffect, useMemo, useState } from "react";

import { PortalSidebar } from "@/components/core/PortalSidebar";
import { RequireRoles } from "@/components/core/RequireRoles";
import { StatusBadge } from "@/components/core/StatusBadge";
import { getApiClient } from "@/lib/api/client";
import type { AdminUserDTO, AdminUsersFilters, CreateAdminUserInput, UserStatus } from "@/lib/api/types";
import type { RoleName } from "@/lib/auth/types";
import { ALL_BRANCHES_LABEL, getDemoBranchPool } from "@/lib/locations";

const ROLES: RoleName[] = [
  "CEO",
  "BRANCH_MANAGER",
  "PROCUREMENT_HEAD",
  "STORE_MANAGER",
  "FINANCE",
  "DEPARTMENT_HEAD",
  "DEPARTMENT_STAFF",
];

const DEPARTMENTS = ["Kitchen", "Bar", "Housekeeping", "Front Office", "Maintenance"];

function toneForStatus(s: UserStatus) {
  return s === "ACTIVE" ? "good" : "warn";
}

function needsBranch(role: RoleName) {
  return role !== "CEO";
}

function needsDepartment(role: RoleName) {
  return role === "DEPARTMENT_HEAD" || role === "DEPARTMENT_STAFF";
}

const ROLE_PERMISSIONS: Record<RoleName, { can: string[]; cannot: string[] }> = {
  CEO: {
    can: ["All dashboards", "Manage users", "View all branches"],
    cannot: [],
  },
  BRANCH_MANAGER: {
    can: ["View branch dashboard", "Approve requisitions", "View finance summaries"],
    cannot: ["View other branches", "Manage users"],
  },
  PROCUREMENT_HEAD: {
    can: ["View procurement dashboards", "Manage procurement flow"],
    cannot: ["Manage users"],
  },
  STORE_MANAGER: {
    can: ["View inventory", "Record stock movements"],
    cannot: ["View other branches", "Manage users"],
  },
  FINANCE: {
    can: ["View finance", "Reconcile invoices/payments"],
    cannot: ["View other branches", "Manage users"],
  },
  DEPARTMENT_HEAD: {
    can: ["View department dashboard", "Approve department requisitions"],
    cannot: ["View other branches", "Manage users"],
  },
  DEPARTMENT_STAFF: {
    can: ["Create requisitions"],
    cannot: ["Manage users", "Approve requisitions"],
  },
};

export default function AdminUsersPage() {
  const api = useMemo(() => getApiClient(), []);

  const branches = useMemo(() => [ALL_BRANCHES_LABEL, ...getDemoBranchPool()], []);

  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<AdminUserDTO[]>([]);

  const [filters, setFilters] = useState<AdminUsersFilters>({});

  const [showCreate, setShowCreate] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createInput, setCreateInput] = useState<CreateAdminUserInput>({
    fullName: "",
    email: "",
    phone: "",
    role: "DEPARTMENT_STAFF",
    branch: undefined,
    department: undefined,
    status: "ACTIVE",
  });

  const [replaceWarning, setReplaceWarning] = useState<{ branch: string } | null>(null);
  const [createdResult, setCreatedResult] = useState<{ tempPassword?: string; inviteLink?: string } | null>(null);

  const [selectedUser, setSelectedUser] = useState<AdminUserDTO | null>(null);
  const [auditOpen, setAuditOpen] = useState(false);
  const [auditRows, setAuditRows] = useState<{ at: string; action: string; actorName: string; details: string }[]>([]);

  const [permissionRole, setPermissionRole] = useState<RoleName>("BRANCH_MANAGER");

  async function refresh() {
    setLoading(true);
    try {
      const res = await api.adminUsers.list(filters);
      setRows(res.rows);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(filters)]);

  async function onToggleStatus(user: AdminUserDTO) {
    const next: UserStatus = user.status === "ACTIVE" ? "SUSPENDED" : "ACTIVE";
    await api.adminUsers.updateStatus(user.id, next);
    await refresh();
  }

  async function onResetPassword(user: AdminUserDTO) {
    const res = await api.adminUsers.resetPassword(user.id);
    alert(`Temporary password for ${user.email}: ${res.tempPassword}`);
  }

  async function openAudit(user: AdminUserDTO) {
    setSelectedUser(user);
    setAuditOpen(true);
    const res = await api.adminUsers.getAudit(user.id);
    setAuditRows(res.rows);
  }

  function branchManagerExists(branch: string) {
    return rows.some((u) => u.role === "BRANCH_MANAGER" && u.branch === branch && u.status === "ACTIVE");
  }

  async function submitCreate(replaceBranchManagerForBranch?: string) {
    setCreateError(null);
    try {
      const res = await api.adminUsers.create(createInput, {
        replaceBranchManagerForBranch,
      });
      setCreatedResult({ tempPassword: res.tempPassword, inviteLink: res.inviteLink });
      setShowCreate(false);
      setCreateInput({
        fullName: "",
        email: "",
        phone: "",
        role: "DEPARTMENT_STAFF",
        branch: undefined,
        department: undefined,
        status: "ACTIVE",
      });
      await refresh();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to create user";
      if (msg.startsWith("Branch Manager already exists for ")) {
        const branch = msg.replace("Branch Manager already exists for ", "");
        setReplaceWarning({ branch });
        return;
      }
      setCreateError(msg);
    }
  }

  const visibleRows = rows;

  return (
    <RequireRoles roles={["CEO"]}>
      <div className="min-h-screen bg-zinc-50">
        <div className="mx-auto flex max-w-7xl">
          <PortalSidebar />

          <main className="w-full px-6 py-8">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h1 className="text-2xl font-semibold text-zinc-900">Users & Access</h1>
                <div className="mt-1 text-sm text-zinc-600">Governance layer: roles, branch scoping, and accountability</div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white"
                  onClick={() => {
                    setCreatedResult(null);
                    setCreateError(null);
                    setReplaceWarning(null);
                    setShowCreate(true);
                  }}
                >
                  + Create User
                </button>
                {loading ? <div className="text-xs text-zinc-500">Refreshing…</div> : null}
              </div>
            </div>

            {createdResult ? (
              <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
                <div className="font-semibold">User created</div>
                <div className="mt-1">Temp password: {createdResult.tempPassword ?? "—"}</div>
                <div>Invite link: {createdResult.inviteLink ?? "—"}</div>
              </div>
            ) : null}

            <section className="mt-6 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
              <div className="text-sm font-semibold text-zinc-900">Filters</div>
              <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-4">
                <div>
                  <div className="text-xs font-medium text-zinc-500">Branch</div>
                  <select
                    className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-800"
                    value={filters.branch ?? ""}
                    onChange={(e) => setFilters((f) => ({ ...f, branch: e.target.value || undefined }))}
                  >
                    <option value="">All</option>
                    {branches
                      .filter((b) => b !== ALL_BRANCHES_LABEL)
                      .map((b) => (
                        <option key={b} value={b}>
                          {b}
                        </option>
                      ))}
                  </select>
                </div>

                <div>
                  <div className="text-xs font-medium text-zinc-500">Role</div>
                  <select
                    className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-800"
                    value={filters.role ?? ""}
                    onChange={(e) => setFilters((f) => ({ ...f, role: (e.target.value as RoleName) || undefined }))}
                  >
                    <option value="">All</option>
                    {ROLES.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <div className="text-xs font-medium text-zinc-500">Department</div>
                  <select
                    className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-800"
                    value={filters.department ?? ""}
                    onChange={(e) => setFilters((f) => ({ ...f, department: e.target.value || undefined }))}
                  >
                    <option value="">All</option>
                    {DEPARTMENTS.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <div className="text-xs font-medium text-zinc-500">Status</div>
                  <select
                    className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-800"
                    value={filters.status ?? ""}
                    onChange={(e) => setFilters((f) => ({ ...f, status: (e.target.value as UserStatus) || undefined }))}
                  >
                    <option value="">All</option>
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="SUSPENDED">SUSPENDED</option>
                  </select>
                </div>
              </div>
            </section>

            <section className="mt-6 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold text-zinc-900">Users</div>
                <div className="text-xs text-zinc-500">Total: {visibleRows.length}</div>
              </div>

              <div className="mt-3 overflow-x-auto">
                <table className="w-full border-separate border-spacing-0">
                  <thead>
                    <tr>
                      {[
                        "Name",
                        "Email",
                        "Role",
                        "Branch",
                        "Department",
                        "Status",
                        "Last Login",
                        "Actions",
                      ].map((h) => (
                        <th
                          key={h}
                          className="whitespace-nowrap border-b border-zinc-200 px-3 py-2 text-left text-xs font-medium text-zinc-500"
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {visibleRows.map((u) => (
                      <tr key={u.id} className="hover:bg-zinc-50">
                        <td className="border-b border-zinc-100 px-3 py-2 text-sm text-zinc-900">{u.fullName}</td>
                        <td className="border-b border-zinc-100 px-3 py-2 text-sm text-zinc-800">{u.email}</td>
                        <td className="border-b border-zinc-100 px-3 py-2 text-sm text-zinc-800">{u.role}</td>
                        <td className="border-b border-zinc-100 px-3 py-2 text-sm text-zinc-800">{u.branch ?? "—"}</td>
                        <td className="border-b border-zinc-100 px-3 py-2 text-sm text-zinc-800">{u.department ?? "—"}</td>
                        <td className="border-b border-zinc-100 px-3 py-2 text-sm text-zinc-800">
                          <StatusBadge label={u.status} tone={toneForStatus(u.status)} />
                        </td>
                        <td className="border-b border-zinc-100 px-3 py-2 text-sm text-zinc-800">
                          {u.lastLogin ? new Date(u.lastLogin).toLocaleString() : "—"}
                        </td>
                        <td className="border-b border-zinc-100 px-3 py-2 text-sm text-zinc-800">
                          <div className="flex flex-wrap gap-2">
                            <button
                              className="rounded-md border border-zinc-200 bg-white px-2 py-1 text-xs text-zinc-700"
                              onClick={() => openAudit(u)}
                            >
                              Audit
                            </button>
                            <button
                              className="rounded-md border border-zinc-200 bg-white px-2 py-1 text-xs text-zinc-700"
                              onClick={() => onToggleStatus(u)}
                            >
                              {u.status === "ACTIVE" ? "Disable" : "Enable"}
                            </button>
                            <button
                              className="rounded-md border border-zinc-200 bg-white px-2 py-1 text-xs text-zinc-700"
                              onClick={() => onResetPassword(u)}
                            >
                              Reset Password
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {visibleRows.length === 0 ? (
                      <tr>
                        <td className="px-3 py-10 text-center text-sm text-zinc-500" colSpan={8}>
                          No data for selected filters
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="mt-6 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="text-sm font-semibold text-zinc-900">Role Permission Viewer (read-only)</div>
                  <div className="mt-1 text-sm text-zinc-600">Visibility only (editing later)</div>
                </div>

                <div className="flex items-center gap-2">
                  <div className="text-xs font-medium text-zinc-500">Role</div>
                  <select
                    className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-800"
                    value={permissionRole}
                    onChange={(e) => setPermissionRole(e.target.value as RoleName)}
                  >
                    {ROLES.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="rounded-lg border border-zinc-200 bg-white p-3">
                  <div className="text-xs font-semibold text-zinc-700">Can</div>
                  <div className="mt-2 space-y-1">
                    {ROLE_PERMISSIONS[permissionRole].can.map((t) => (
                      <div key={t} className="text-sm text-zinc-800">
                        {t}
                      </div>
                    ))}
                  </div>
                </div>
                <div className="rounded-lg border border-zinc-200 bg-white p-3">
                  <div className="text-xs font-semibold text-zinc-700">Cannot</div>
                  <div className="mt-2 space-y-1">
                    {ROLE_PERMISSIONS[permissionRole].cannot.length ? (
                      ROLE_PERMISSIONS[permissionRole].cannot.map((t) => (
                        <div key={t} className="text-sm text-zinc-800">
                          {t}
                        </div>
                      ))
                    ) : (
                      <div className="text-sm text-zinc-500">—</div>
                    )}
                  </div>
                </div>
              </div>
            </section>
          </main>
        </div>

        {showCreate ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="w-full max-w-xl rounded-xl bg-white p-4 shadow-xl">
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold text-zinc-900">Create User</div>
                <button className="text-sm text-zinc-500" onClick={() => setShowCreate(false)}>
                  Close
                </button>
              </div>

              {createError ? <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-900">{createError}</div> : null}

              <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
                <div>
                  <div className="text-xs font-medium text-zinc-500">Full Name</div>
                  <input
                    className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm"
                    value={createInput.fullName}
                    onChange={(e) => setCreateInput((s) => ({ ...s, fullName: e.target.value }))}
                  />
                </div>
                <div>
                  <div className="text-xs font-medium text-zinc-500">Email</div>
                  <input
                    className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm"
                    value={createInput.email}
                    onChange={(e) => setCreateInput((s) => ({ ...s, email: e.target.value }))}
                  />
                </div>
                <div>
                  <div className="text-xs font-medium text-zinc-500">Phone (optional)</div>
                  <input
                    className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm"
                    value={createInput.phone ?? ""}
                    onChange={(e) => setCreateInput((s) => ({ ...s, phone: e.target.value }))}
                  />
                </div>
                <div>
                  <div className="text-xs font-medium text-zinc-500">Role</div>
                  <select
                    className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm"
                    value={createInput.role}
                    onChange={(e) => {
                      const role = e.target.value as RoleName;
                      setCreateInput((s) => ({
                        ...s,
                        role,
                        branch: needsBranch(role) ? s.branch : undefined,
                        department: needsDepartment(role) ? s.department : undefined,
                      }));
                    }}
                  >
                    {ROLES.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <div className="text-xs font-medium text-zinc-500">Branch</div>
                  <select
                    className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm"
                    value={createInput.branch ?? ""}
                    onChange={(e) => setCreateInput((s) => ({ ...s, branch: e.target.value || undefined }))}
                    disabled={!needsBranch(createInput.role)}
                  >
                    <option value="">{needsBranch(createInput.role) ? "Select" : "—"}</option>
                    {branches
                      .filter((b) => b !== ALL_BRANCHES_LABEL)
                      .map((b) => (
                        <option key={b} value={b}>
                          {b}
                        </option>
                      ))}
                  </select>
                  {createInput.role === "BRANCH_MANAGER" && createInput.branch && branchManagerExists(createInput.branch) ? (
                    <div className="mt-1 text-xs text-amber-700">Warning: an active Branch Manager already exists for this branch.</div>
                  ) : null}
                </div>

                <div>
                  <div className="text-xs font-medium text-zinc-500">Department</div>
                  <select
                    className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm"
                    value={createInput.department ?? ""}
                    onChange={(e) => setCreateInput((s) => ({ ...s, department: e.target.value || undefined }))}
                    disabled={!needsDepartment(createInput.role)}
                  >
                    <option value="">{needsDepartment(createInput.role) ? "Select" : "—"}</option>
                    {DEPARTMENTS.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <div className="text-xs font-medium text-zinc-500">Status</div>
                  <select
                    className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm"
                    value={createInput.status}
                    onChange={(e) => setCreateInput((s) => ({ ...s, status: e.target.value as UserStatus }))}
                  >
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="SUSPENDED">SUSPENDED</option>
                  </select>
                </div>
              </div>

              <div className="mt-4 flex items-center justify-end gap-2">
                <button className="rounded-lg border border-zinc-200 bg-white px-4 py-2 text-sm" onClick={() => setShowCreate(false)}>
                  Cancel
                </button>
                <button
                  className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white"
                  onClick={() => submitCreate()}
                >
                  Create
                </button>
              </div>

              {replaceWarning ? (
                <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                  <div className="font-semibold">Branch Manager already exists</div>
                  <div className="mt-1">Branch: {replaceWarning.branch}</div>
                  <div className="mt-2">Do you want to replace them? This will suspend the current Branch Manager.</div>
                  <div className="mt-3 flex items-center justify-end gap-2">
                    <button className="rounded-lg border border-amber-200 bg-white px-3 py-1.5 text-sm" onClick={() => setReplaceWarning(null)}>
                      No
                    </button>
                    <button
                      className="rounded-lg bg-amber-600 px-3 py-1.5 text-sm font-medium text-white"
                      onClick={() => {
                        const b = replaceWarning.branch;
                        setReplaceWarning(null);
                        submitCreate(b);
                      }}
                    >
                      Replace
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        ) : null}

        {auditOpen && selectedUser ? (
          <div className="fixed inset-0 z-50 flex items-center justify-end bg-black/30">
            <div className="h-full w-full max-w-lg overflow-y-auto bg-white p-4 shadow-xl">
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold text-zinc-900">Audit Trail</div>
                <button
                  className="text-sm text-zinc-500"
                  onClick={() => {
                    setAuditOpen(false);
                    setSelectedUser(null);
                  }}
                >
                  Close
                </button>
              </div>

              <div className="mt-2 text-sm text-zinc-700">
                {selectedUser.fullName} ({selectedUser.email})
              </div>

              <div className="mt-4 space-y-2">
                {auditRows.length ? (
                  auditRows.map((a) => (
                    <div key={a.at + a.action} className="rounded-lg border border-zinc-200 bg-white p-3">
                      <div className="text-xs text-zinc-500">{new Date(a.at).toLocaleString()}</div>
                      <div className="mt-1 text-sm font-medium text-zinc-900">{a.action}</div>
                      <div className="mt-1 text-sm text-zinc-700">{a.details}</div>
                      <div className="mt-2 text-xs text-zinc-500">By: {a.actorName}</div>
                    </div>
                  ))
                ) : (
                  <div className="rounded-lg border border-zinc-200 bg-white p-4 text-sm text-zinc-500">No audit events</div>
                )}
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </RequireRoles>
  );
}
