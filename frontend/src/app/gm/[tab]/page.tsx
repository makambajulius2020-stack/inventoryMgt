"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Download, Search } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { DashboardError, DashboardLoading } from "@/components/dashboard/DashboardStates";
import { api } from "@/lib/api/client";
import { useAuth } from "@/contexts/AuthContext";

type TabKey = "department-performance" | "approvals" | "financial-summary" | "procurement-status" | "inventory-status";

const GM_TABS: { href: string; label: string }[] = [
  { href: "/gm/dashboard", label: "Location Overview" },
  { href: "/gm/department-performance", label: "Department Performance" },
  { href: "/gm/approvals", label: "Approvals" },
  { href: "/gm/financial-summary", label: "Financial Summary" },
  { href: "/gm/procurement-status", label: "Procurement Status" },
  { href: "/gm/inventory-status", label: "Inventory Status" },
];

const TAB_META: Record<TabKey, { title: string; subtitle: string }> = {
  "department-performance": { title: "Department Performance", subtitle: "Department KPI oversight shell" },
  approvals: { title: "Approvals", subtitle: "Approval workflow structure" },
  "financial-summary": { title: "Financial Summary", subtitle: "Location finance summary shell" },
  "procurement-status": { title: "Procurement Status", subtitle: "Procurement chain visibility" },
  "inventory-status": { title: "Inventory Status", subtitle: "Inventory health oversight shell" },
};

export default function GmTabPage() {
  const params = useParams<{ tab: string }>();
  const tab = params.tab as TabKey;
  const config = TAB_META[tab];
  const { state } = useAuth();
  const [query, setQuery] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      if (!state.user) return;
      try {
        setLoading(true);
        setError(null);
        await api.gm.getDashboard(state.user!);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Failed to load GM tab");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [state.user, tab, fromDate]);

  if (!config) return <DashboardError title="General Manager" message="Tab not found" />;
  if (loading) return <DashboardLoading titleWidthClassName="w-1/3" />;
  if (error) return <DashboardError title={config.title} message={error} />;

  return (
    <div className="p-8 space-y-8 max-w-[1600px] mx-auto">
      <div className="overflow-x-auto">
        <div className="flex gap-2 min-w-max border-b border-[var(--border-subtle)] pb-2">
          {GM_TABS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={item.href.endsWith(`/${tab}`) ? "px-3 py-2 rounded-xl bg-[var(--surface-raised)] text-[var(--text-primary)] text-xs font-black uppercase tracking-wider" : "px-3 py-2 rounded-xl text-[var(--text-muted)] hover:text-[var(--text-primary)] text-xs font-black uppercase tracking-wider"}
            >
              {item.label}
            </Link>
          ))}
        </div>
      </div>

      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-[var(--text-primary)] tracking-tighter uppercase">{config.title}</h1>
          <p className="text-[var(--text-secondary)] font-medium">{config.subtitle}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input value={fromDate} onChange={(e) => setFromDate(e.target.value)} type="date" className="h-9 px-3 rounded-xl bg-[var(--input)] border border-[var(--input-border)] text-[var(--text-primary)]" />
          <label className="h-9 px-3 rounded-xl bg-[var(--input)] border border-[var(--input-border)] inline-flex items-center gap-2 text-[var(--text-muted)]">
            <Search className="w-4 h-4" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Quick search" className="bg-transparent outline-none text-sm text-[var(--text-primary)]" />
          </label>
          <Button variant="outline" size="sm"><Download className="w-4 h-4 mr-2" />Export</Button>
        </div>
      </div>

      <Card title={config.title}>
        <p className="text-sm text-[var(--text-secondary)]">This role tab is structurally aligned to the GM matrix and remains service-safe.</p>
      </Card>
    </div>
  );
}
