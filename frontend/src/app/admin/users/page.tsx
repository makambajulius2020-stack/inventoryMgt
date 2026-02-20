"use client";

import React, { useCallback, useEffect, useState } from "react";
import {
  Shield,
  Search,
  Plus,
  CheckCircle,
  XCircle,
  History,
  MoreVertical,
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { DataTable } from "@/components/ui/DataTable";
import { api } from "@/lib/api/client";
import { RoleName } from "@/lib/auth/types";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import type { UserRow } from "@/lib/api/services/admin.service";

const ROLES: RoleName[] = [
  "CEO",
  "SYSTEM_AUDITOR",
  "GENERAL_MANAGER",
  "FINANCE_MANAGER",
  "PROCUREMENT_OFFICER",
  "STORE_MANAGER",
  "DEPARTMENT_HEAD",
];

export default function AdminUsersPage() {
  const { state } = useAuth();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [createInput, setCreateInput] = useState({
    name: "",
    email: "",
    role: "STORE_MANAGER" as RoleName,
    locationId: "",
    departmentId: "",
  });

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

  const filteredUsers = users.filter((u) =>
    u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.role.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleCreate = async () => {
    try {
      if (state.user) await api.admin.createUser(state.user, createInput);
      setIsModalOpen(false);
      loadUsers();
    } catch {
      alert("Failed to create user");
    }
  };

  return (
    <div className="p-8 space-y-8 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-[#001F3F] dark:text-white tracking-tighter uppercase">Identity Registry</h1>
          <p className="text-slate-500 font-medium">Manage enterprise access and security roles</p>
        </div>
        <Button onClick={() => setIsModalOpen(true)}>
          <Plus className="w-4 h-4 mr-2" /> Provision New Identity
        </Button>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-4 bg-white dark:bg-[#00162a] p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="flex-1 relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by name, email, or role..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-11 pr-4 py-2.5 bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/10 rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-[#001F3F]/20 transition-all"
          />
        </div>
      </div>

      {/* Users Table */}
      <Card noPadding title="Active Identities" subtitle="System-wide users and their respective scope boundaries">
        <DataTable
          loading={loading}
          data={filteredUsers}
          columns={[
            {
              header: "Identity",
              accessor: (u) => (
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-white/5 flex items-center justify-center font-black text-[#001F3F] dark:text-teal-400">
                    {u.name[0]}
                  </div>
                  <div>
                    <p className="font-black text-[#001F3F] dark:text-white leading-none">{u.name}</p>
                    <p className="text-[10px] font-bold text-slate-400 uppercase mt-1">{u.email}</p>
                  </div>
                </div>
              )
            },
            {
              header: "Security Role",
              accessor: (u) => (
                <div className="flex items-center gap-2">
                  <Shield className="w-3.5 h-3.5 text-teal-600" />
                  <span className="text-[10px] font-black text-slate-600 dark:text-slate-300 uppercase tracking-widest">{u.role}</span>
                </div>
              )
            },
            {
              header: "Deployment Scope",
              accessor: (u) => (
                <div className="flex flex-col">
                  <span className="text-[10px] font-black text-slate-500 uppercase">{u.locationName || "GLOBAL"}</span>
                  {u.departmentName && <span className="text-[9px] font-bold text-slate-400">{u.departmentName}</span>}
                </div>
              )
            },
            {
              header: "Status",
              accessor: (u) => (
                <div className={cn(
                  "inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest",
                  u.status === "ACTIVE" ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"
                )}>
                  {u.status === "ACTIVE" ? <CheckCircle className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                  {u.status}
                </div>
              )
            },
            {
              header: "Tactical",
              accessor: () => (
                <div className="flex items-center gap-2">
                  <Button size="icon" variant="ghost" className="h-8 w-8">
                    <History className="w-4 h-4 text-slate-400" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-8 w-8">
                    <MoreVertical className="w-4 h-4 text-slate-400" />
                  </Button>
                </div>
              )
            }
          ]}
        />
      </Card>

      {/* Create Modal (Simple) */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-[#000b18]/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <Card
            className="w-full max-w-lg shadow-[0_20px_50px_rgba(0,31,63,0.3)] animate-in fade-in zoom-in duration-200"
            title="Provision Identity"
            subtitle="Configure security role and operational boundaries"
          >
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest pl-1">Full Name</label>
                  <input
                    type="text"
                    className="w-full bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/10 rounded-xl px-4 py-2.5 text-sm font-bold outline-none focus:ring-2 focus:ring-[#001F3F]/20"
                    value={createInput.name}
                    onChange={e => setCreateInput({ ...createInput, name: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest pl-1">Access Email</label>
                  <input
                    type="email"
                    className="w-full bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/10 rounded-xl px-4 py-2.5 text-sm font-bold outline-none focus:ring-2 focus:ring-[#001F3F]/20"
                    value={createInput.email}
                    onChange={e => setCreateInput({ ...createInput, email: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest pl-1">Security Role</label>
                <select
                  className="w-full bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/10 rounded-xl px-4 py-2.5 text-sm font-bold outline-none focus:ring-2 focus:ring-[#001F3F]/20"
                  value={createInput.role}
                  onChange={e => setCreateInput({ ...createInput, role: e.target.value as RoleName })}
                >
                  {ROLES.map(r => <option key={r} value={r} className="bg-white dark:bg-[#00162a]">{r}</option>)}
                </select>
              </div>

              <div className="flex gap-4 pt-4">
                <Button variant="ghost" onClick={() => setIsModalOpen(false)} className="flex-1">Discard</Button>
                <Button onClick={handleCreate} className="flex-1">Create Identity</Button>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
