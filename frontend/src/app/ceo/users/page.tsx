"use client";

import React, { useCallback, useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { DataTable } from "@/components/ui/DataTable";
import { api } from "@/lib/api/client";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import type { UserRow } from "@/lib/api/services/admin.service";
import { Shield, Search, CheckCircle, XCircle, History, MoreVertical } from "lucide-react";

export default function CeoUsersPage() {
  const { state } = useAuth();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const data = state.user ? await api.admin.listUsers(state.user) : [];
      setUsers(data);
    } finally {
      setLoading(false);
    }
  }, [state.user]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const filteredUsers = users.filter(
    (u) =>
      u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.role.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  return (
    <div className="p-8 space-y-6 max-w-[1200px] mx-auto">
      <div>
        <h1 className="text-3xl font-black text-[var(--text-primary)] tracking-tighter uppercase">Identity Oversight</h1>
        <p className="text-[var(--text-secondary)] font-medium">Executive view of system identities</p>
      </div>

      <div className="flex items-center gap-4 glass p-4 rounded-2xl border border-white/10 shadow-sm">
        <div className="flex-1 relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
          <input
            type="text"
            placeholder="Search by name, email, or role..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-11 pr-4 py-2.5 bg-[var(--input)] border border-[var(--input-border)] rounded-xl text-sm font-medium text-[var(--text-primary)] outline-none focus:ring-2 focus:ring-[var(--ring)]/20 transition-all"
          />
        </div>
        <Button variant="outline" size="sm" onClick={loadUsers}>
          Refresh
        </Button>
      </div>

      <Card noPadding title="Active Identities" subtitle="System-wide users and their respective scope boundaries">
        <DataTable
          loading={loading}
          data={filteredUsers}
          columns={[
            {
              header: "Identity",
              accessor: (u) => (
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center font-black text-[var(--accent-hover)]">
                    {u.name[0]}
                  </div>
                  <div>
                    <p className="font-black text-[var(--text-primary)] leading-none">{u.name}</p>
                    <p className="text-[10px] font-bold text-[var(--text-muted)] uppercase mt-1">{u.email}</p>
                  </div>
                </div>
              ),
            },
            {
              header: "Security Role",
              accessor: (u) => (
                <div className="flex items-center gap-2">
                  <Shield className="w-3.5 h-3.5 text-[var(--accent-hover)]" />
                  <span className="text-[10px] font-black text-[var(--text-secondary)] uppercase tracking-widest">{u.role}</span>
                </div>
              ),
            },
            {
              header: "Deployment Scope",
              accessor: (u) => (
                <div className="flex flex-col">
                  <span className="text-[10px] font-black text-[var(--text-secondary)] uppercase">{u.locationName || "GLOBAL"}</span>
                  {u.departmentName && <span className="text-[9px] font-bold text-[var(--text-muted)]">{u.departmentName}</span>}
                </div>
              ),
            },
            {
              header: "Status",
              accessor: (u) => (
                <div
                  className={cn(
                    "inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest",
                    u.status === "ACTIVE"
                      ? "bg-emerald-500/10 text-emerald-300 border border-emerald-500/20"
                      : "bg-rose-500/10 text-rose-300 border border-rose-500/20",
                  )}
                >
                  {u.status === "ACTIVE" ? <CheckCircle className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                  {u.status}
                </div>
              ),
            },
            {
              header: "Tactical",
              accessor: () => (
                <div className="flex items-center gap-2">
                  <Button size="icon" variant="ghost" className="h-8 w-8">
                    <History className="w-4 h-4 text-[var(--text-muted)]" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-8 w-8">
                    <MoreVertical className="w-4 h-4 text-[var(--text-muted)]" />
                  </Button>
                </div>
              ),
            },
          ]}
        />
      </Card>
    </div>
  );
}
