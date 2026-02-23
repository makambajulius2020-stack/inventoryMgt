"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Download, Search } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { DataTable } from "@/components/ui/DataTable";
import { DashboardError, DashboardLoading } from "@/components/dashboard/DashboardStates";
import { api } from "@/lib/api/client";
import { useGlobalDateFilters } from "@/contexts/GlobalDateFiltersContext";
import type { AuditTrailEntry, CrossLocationVariance } from "@/lib/api/services/reporting.service";

type TabKey = "financial-audit" | "stock-movement-audit" | "user-activity" | "cross-location-reports";

const AUDITOR_TABS: { href: string; label: string }[] = [
  { href: "/auditor/dashboard", label: "System Logs" },
  { href: "/auditor/financial-audit", label: "Financial Audit" },
  { href: "/auditor/stock-movement-audit", label: "Stock Movement Audit" },
  { href: "/auditor/user-activity", label: "User Activity" },
  { href: "/auditor/cross-location-reports", label: "Cross Location Reports" },
];

const TAB_META: Record<TabKey, { title: string; subtitle: string }> = {
  "financial-audit": { title: "Financial Audit", subtitle: "Read-only financial inspection shell" },
  "stock-movement-audit": { title: "Stock Movement Audit", subtitle: "Read-only stock chain audit shell" },
  "user-activity": { title: "User Activity", subtitle: "Read-only user activity audit shell" },
  "cross-location-reports": { title: "Cross Location Reports", subtitle: "Cross-branch variance reporting shell" },
};

export default function AuditorTabPage() {
  const params = useParams<{ tab: string }>();
  const tab = params.tab as TabKey;
  const config = TAB_META[tab];

  const { filters } = useGlobalDateFilters();

  const [query, setQuery] = useState("");
  const [logs, setLogs] = useState<AuditTrailEntry[]>([]);
  const [variance, setVariance] = useState<CrossLocationVariance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        setError(null);
        setLoading(true);
        const [trail, v] = await Promise.all([api.auditor.getFullAuditTrail(), api.auditor.getCrossLocationVariance()]);
        setLogs(trail);
        setVariance(v);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Failed to load auditor tab");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [tab]);

  if (!config) return <DashboardError title="Auditor" message="Tab not found" />;
  if (loading) return <DashboardLoading titleWidthClassName="w-1/3" />;
  if (error) return <DashboardError title={config.title} message={error} />;

  const withinRange = (raw: string) => {
    const t = new Date(raw).getTime();
    if (Number.isNaN(t)) return false;
    const fromTs = filters.fromDate ? new Date(filters.fromDate).getTime() : undefined;
    const toTs = filters.toDate ? new Date(filters.toDate).getTime() : undefined;
    if (fromTs !== undefined && t < fromTs) return false;
    if (toTs !== undefined && t > toTs) return false;
    return true;
  };

  const q = query.trim().toLowerCase();

  const exportCsv = (filename: string, headers: string[], rows: (string | number)[][]) => {
    const esc = (v: string | number) => {
      const s = String(v ?? "");
      const needsQuotes = /[\n\r,\"]/g.test(s);
      const safe = s.replace(/\"/g, '""');
      return needsQuotes ? `"${safe}"` : safe;
    };
    const csv = [headers.map(esc).join(","), ...rows.map((r) => r.map(esc).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const locationMatch = (locationName: string) => {
    if (filters.location === "ALL") return true;
    return locationName === filters.location;
  };

  const baseFilteredLogs = logs
    .filter((l) => withinRange(l.timestamp))
    .filter((l) => locationMatch(l.locationName))
    .filter((l) => {
      if (!q) return true;
      return (
        l.entityId.toLowerCase().includes(q) ||
        l.entityType.toLowerCase().includes(q) ||
        l.action.toLowerCase().includes(q) ||
        l.userName.toLowerCase().includes(q) ||
        l.userRole.toLowerCase().includes(q)
      );
    })
    .slice(0, 400);

  const tabLogs = baseFilteredLogs.filter((l) => {
    if (tab === "financial-audit") {
      return ["SUPPLIER_INVOICE", "PAYMENT", "EXPENSE", "LEDGER_ENTRY"].includes(l.entityType);
    }
    if (tab === "stock-movement-audit") {
      return ["STOCK_MOVEMENT", "STOCK_TRANSFER", "GRN"].includes(l.entityType);
    }
    if (tab === "user-activity") {
      return ["AUTH", "USER", "SESSION"].includes(l.entityType) || l.entityType.includes("USER");
    }
    return true;
  });

  const varianceRows = variance
    .map((v) => ({ ...v, id: v.metric }))
    .filter((v) => {
      if (!q) return true;
      return v.metric.toLowerCase().includes(q);
    });

  const handleExport = () => {
    const stamp = new Date().toISOString().slice(0, 10);
    if (tab === "cross-location-reports") {
      exportCsv(
        `cross_location_reports_${stamp}.csv`,
        ["metric", "average", "maxVariance"],
        varianceRows.map((v) => [v.metric, v.average, v.maxVariance])
      );
      return;
    }

    exportCsv(
      `${tab}_${stamp}.csv`,
      ["timestamp", "userName", "userRole", "action", "entityType", "entityId", "location"],
      tabLogs.map((l) => [l.timestamp, l.userName, l.userRole, l.action, l.entityType, l.entityId, l.locationName])
    );
  };

  return (
    <div className="p-8 space-y-8 max-w-[1600px] mx-auto">
      <div className="overflow-x-auto">
        <div className="flex gap-2 min-w-max border-b border-[var(--border-subtle)] pb-2">
          {AUDITOR_TABS.map((item) => (
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
          <label className="h-9 px-3 rounded-xl bg-[var(--input)] border border-[var(--input-border)] inline-flex items-center gap-2 text-[var(--text-muted)]">
            <Search className="w-4 h-4" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Quick search" className="bg-transparent outline-none text-sm text-[var(--text-primary)]" />
          </label>
          <Button variant="outline" size="sm" onClick={handleExport}><Download className="w-4 h-4 mr-2" />Export</Button>
        </div>
      </div>

      {tab !== "cross-location-reports" && (
        <Card title={config.title} subtitle="Read-only audit table" noPadding>
          <DataTable
            loading={loading}
            data={tabLogs}
            columns={[
              { header: "Timestamp", accessor: (l) => <span className="text-[var(--text-primary)] font-bold">{new Date(l.timestamp).toLocaleString()}</span> },
              { header: "Actor", accessor: (l) => <span className="text-[var(--text-primary)] font-black">{l.userName}</span> },
              { header: "Role", accessor: (l) => <span className="text-[var(--text-primary)] font-bold">{l.userRole}</span> },
              { header: "Action", accessor: (l) => <span className="px-2 py-1 rounded bg-white/10 border border-white/15 text-[10px] font-black uppercase text-[var(--text-primary)]">{l.action}</span> },
              { header: "Entity", accessor: (l) => <span className="text-[var(--text-primary)] font-bold">{l.entityType}</span> },
              { header: "Entity ID", accessor: (l) => <span className="font-mono text-xs text-[var(--text-primary)] font-bold">{l.entityId}</span> },
              { header: "Location", accessor: (l) => <span className="text-[var(--text-primary)] font-bold">{l.locationName}</span> },
            ]}
            emptyMessage="No audit records found"
          />
        </Card>
      )}

      {tab === "cross-location-reports" && (
        <Card title={config.title} subtitle="Cross-branch variance" noPadding>
          <DataTable
            loading={loading}
            data={varianceRows}
            columns={[
              { header: "Metric", accessor: (r: any) => <span className="text-[var(--text-primary)] font-black">{r.metric}</span> },
              { header: "Average", accessor: (r: any) => <span className="text-right font-mono font-black text-[var(--text-primary)]">{Number(r.average).toLocaleString()}</span>, className: "text-right" },
              { header: "Max Variance", accessor: (r: any) => <span className="text-right font-mono font-black text-[var(--text-primary)]">{Number(r.maxVariance).toLocaleString()}</span>, className: "text-right" },
            ]}
            emptyMessage="No variance data available"
          />
        </Card>
      )}
    </div>
  );
}
