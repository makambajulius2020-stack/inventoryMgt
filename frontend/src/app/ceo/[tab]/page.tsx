"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Download, Search } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { DataTable } from "@/components/ui/DataTable";
import { KpiCard, KpiGrid } from "@/components/dashboard/KpiCard";
import { DashboardError, DashboardLoading } from "@/components/dashboard/DashboardStates";
import { api } from "@/lib/api/client";
import { useAuth } from "@/contexts/AuthContext";
import { useGlobalDateFilters } from "@/contexts/GlobalDateFiltersContext";
import { mockDB } from "@/lib/mock-db";
import type { APAgingRow, InvoiceRow } from "@/lib/api/services/finance.service";

type TabConfig = { label: string; title: string; subtitle: string };

const TAB_MAP: Record<string, TabConfig> = {
  "financial-intelligence": {
    label: "Financial Intelligence",
    title: "Financial Intelligence",
    subtitle: "Accounts payable analysis and settlement intelligence",
  },
  "operational-overview": {
    label: "Operational Overview",
    title: "Operational Overview",
    subtitle: "Cross-functional execution overview",
  },
  "procurement-overview": {
    label: "Procurement Overview",
    title: "Procurement Overview",
    subtitle: "Procurement lifecycle status across locations",
  },
  "inventory-status": {
    label: "Inventory Status",
    title: "Inventory Status",
    subtitle: "Inventory exposure and movement posture",
  },
  "sales-analytics": {
    label: "Sales Analytics",
    title: "Sales Analytics",
    subtitle: "Sales performance and conversion trend view",
  },
  "audit-controls": {
    label: "Audit & Controls",
    title: "Audit & Controls",
    subtitle: "Control health and compliance posture",
  },
};

type APAgingSummaryRow = {
  id: string;
  current: number;
  b1_30: number;
  b31_60: number;
  b61_90: number;
  b90: number;
  totalOutstanding: number;
  totalAccountsPayable: number;
};

type CeoMockRow = {
  id: string;
  name: string;
  status: string;
  metric: string;
  owner: string;
};

function FinancialIntelligenceView({ aging, invoices }: { aging: APAgingRow[]; invoices: InvoiceRow[] }) {
  const agingMap = useMemo(() => {
    const map = new Map<string, APAgingRow>();
    aging.forEach((row) => map.set(row.bucket, row));
    return map;
  }, [aging]);

  const totalOutstanding = invoices.filter((i) => i.status !== "PAID").reduce((sum, i) => sum + i.amount, 0);
  const totalAccountsPayable = invoices.reduce((sum, i) => sum + i.amount, 0);

  const summaryRows: APAgingSummaryRow[] = [
    {
      id: "ap-summary",
      current: agingMap.get("0-30")?.amount ?? 0,
      b1_30: agingMap.get("0-30")?.amount ?? 0,
      b31_60: agingMap.get("31-60")?.amount ?? 0,
      b61_90: agingMap.get("61-90")?.amount ?? 0,
      b90: agingMap.get("90+")?.amount ?? 0,
      totalOutstanding,
      totalAccountsPayable,
    },
  ];

  return (
    <div className="space-y-6">
      <Card title="Accounts Payable Aging Summary" noPadding>
        <DataTable<APAgingSummaryRow>
          data={summaryRows}
          columns={[
            { header: "Current", accessor: (r) => `UGX ${r.current.toLocaleString()}`, className: "text-right font-mono font-black text-[var(--text-primary)]" },
            { header: "1-30", accessor: (r) => `UGX ${r.b1_30.toLocaleString()}`, className: "text-right font-mono font-black" },
            { header: "31-60", accessor: (r) => `UGX ${r.b31_60.toLocaleString()}`, className: "text-right font-mono font-black" },
            { header: "61-90", accessor: (r) => `UGX ${r.b61_90.toLocaleString()}`, className: "text-right font-mono font-black" },
            { header: "90+", accessor: (r) => `UGX ${r.b90.toLocaleString()}`, className: "text-right font-mono font-black" },
            { header: "Total Outstanding", accessor: (r) => `UGX ${r.totalOutstanding.toLocaleString()}`, className: "text-right font-mono font-black text-amber-300" },
            { header: "Total Accounts Payable", accessor: (r) => `UGX ${r.totalAccountsPayable.toLocaleString()}`, className: "text-right font-mono font-black text-emerald-300" },
          ]}
        />
      </Card>

      <Card title="Detailed AP Table" noPadding>
        <DataTable
          data={invoices}
          columns={[
            { header: "Date", accessor: () => new Date().toLocaleDateString() },
            { header: "Invoice #", accessor: "id", className: "font-mono font-bold" },
            { header: "Expense Account", accessor: () => "Accounts Payable" },
            { header: "Expense Type", accessor: () => "Vendor Invoice" },
            { header: "Description", accessor: (i: InvoiceRow) => `Supplier invoice for ${i.vendorName}` },
            { header: "Vendor", accessor: "vendorName" },
            { header: "Due Date", accessor: (i: InvoiceRow) => new Date(i.dueDate).toLocaleDateString() },
            { header: "Payment Date", accessor: (i: InvoiceRow) => (i.status === "PAID" ? new Date(i.dueDate).toLocaleDateString() : "-") },
            { header: "Amount Due", accessor: (i: InvoiceRow) => `UGX ${i.amount.toLocaleString()}`, className: "text-right font-mono font-black text-[var(--text-primary)]" },
            { header: "Total Paid", accessor: (i: InvoiceRow) => (i.status === "PAID" ? `UGX ${i.amount.toLocaleString()}` : "UGX 0"), className: "text-right font-mono" },
            { header: "MOP", accessor: () => "-" },
            { header: "GRN Number", accessor: () => "-" },
            { header: "Outstanding", accessor: (i: InvoiceRow) => (i.status === "PAID" ? "UGX 0" : `UGX ${i.amount.toLocaleString()}`), className: "text-right font-mono font-black text-amber-300" },
            { header: "Status", accessor: (i: InvoiceRow) => i.status },
            { header: "Bank PV", accessor: () => "-" },
            { header: "Aging (Days)", accessor: (i: InvoiceRow) => i.daysOverdue, className: "text-right font-mono font-black" },
          ]}
          emptyMessage="No payable invoice records available"
        />
      </Card>
    </div>
  );
}

export default function CeoTabPage() {
  const params = useParams<{ tab: string }>();
  const tab = params.tab;
  const config = TAB_MAP[tab];
  const { state } = useAuth();
  const { filters } = useGlobalDateFilters();
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(tab === "financial-intelligence");
  const [error, setError] = useState<string | null>(null);
  const [aging, setAging] = useState<APAgingRow[]>([]);
  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);

  const mockRows: CeoMockRow[] = useMemo(() => {
    const base: CeoMockRow[] = [
      { id: "row-1", name: "Patiobella", status: "ON TRACK", metric: "UGX 48,250,000", owner: "GM" },
      { id: "row-2", name: "Eateroo", status: "ATTENTION", metric: "UGX 31,900,000", owner: "GM" },
      { id: "row-3", name: "Central Warehouse", status: "STABLE", metric: "UGX 12,000,000", owner: "Ops" },
    ];

    if (tab === "inventory-status") {
      return [
        { id: "inv-1", name: "Low Stock Alerts", status: "ATTENTION", metric: "18 items", owner: "Inventory" },
        { id: "inv-2", name: "Dead Stock Exposure", status: "REVIEW", metric: "UGX 6,450,000", owner: "Inventory" },
        { id: "inv-3", name: "Transfers Pending", status: "ON TRACK", metric: "4 transfers", owner: "Logistics" },
      ];
    }

    if (tab === "procurement-overview") {
      return [
        { id: "proc-1", name: "Open LPOs", status: "OPEN", metric: "7", owner: "Procurement" },
        { id: "proc-2", name: "Pending GRNs", status: "PENDING", metric: "3", owner: "Stores" },
        { id: "proc-3", name: "Payables Exposure", status: "ATTENTION", metric: "UGX 92,400,000", owner: "Finance" },
      ];
    }

    if (tab === "audit-controls") {
      return [
        { id: "ctl-1", name: "Segregation of Duties", status: "PASS", metric: "No conflicts", owner: "Auditor" },
        { id: "ctl-2", name: "Override Events", status: "REVIEW", metric: "2 events", owner: "Auditor" },
        { id: "ctl-3", name: "Late Approvals", status: "ATTENTION", metric: "5 approvals", owner: "Audit" },
      ];
    }

    if (tab === "sales-analytics") {
      return [
        { id: "sale-1", name: "Revenue Trend", status: "UP", metric: "+8.2%", owner: "Sales" },
        { id: "sale-2", name: "Average Ticket", status: "STABLE", metric: "UGX 68,000", owner: "Sales" },
        { id: "sale-3", name: "Void Rate", status: "REVIEW", metric: "1.1%", owner: "Ops" },
      ];
    }

    return base;
  }, [tab]);

  const filteredMockRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return mockRows;
    return mockRows.filter((r) => r.name.toLowerCase().includes(q) || r.status.toLowerCase().includes(q) || r.metric.toLowerCase().includes(q) || r.owner.toLowerCase().includes(q));
  }, [mockRows, query]);

  useEffect(() => {
    if (tab !== "financial-intelligence" || !state.user) return;
    async function load() {
      try {
        setError(null);
        setLoading(true);
        const [agingRows, invoiceRows] = await Promise.all([
          api.finance.getAPAging(state.user!),
          api.finance.getInvoices(state.user!),
        ]);
        setAging(agingRows);
        setInvoices(invoiceRows);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Failed to load financial intelligence");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [tab, state.user]);

  const withinRange = (raw: string | undefined) => {
    if (!raw) return false;
    const t = new Date(raw).getTime();
    if (Number.isNaN(t)) return false;
    const fromTs = filters.fromDate ? new Date(filters.fromDate).getTime() : undefined;
    const toTs = filters.toDate ? new Date(filters.toDate).getTime() : undefined;
    if (fromTs !== undefined && t < fromTs) return false;
    if (toTs !== undefined && t > toTs) return false;
    return true;
  };

  const selectedLocationName = useMemo(() => {
    if (!filters.location || filters.location === "ALL") return "All Branches";
    return mockDB.locations.find((l) => l.id === filters.location)?.name ?? filters.location;
  }, [filters.location]);

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

  const filteredInvoices = invoices
    .filter((i) => withinRange(i.dueDate))
    .filter((i) => {
      if (filters.location === "ALL") return true;
      return i.locationName === selectedLocationName;
    })
    .filter((i) => {
      const q = query.toLowerCase().trim();
      if (!q) return true;
      return (
        i.id.toLowerCase().includes(q) ||
        i.vendorName.toLowerCase().includes(q) ||
        i.status.toLowerCase().includes(q) ||
        i.locationName.toLowerCase().includes(q)
      );
    })
    .slice(0, 400);

  const fiKpis = useMemo(() => {
    const totalAp = filteredInvoices.reduce((s, i) => s + i.amount, 0);
    const totalOutstanding = filteredInvoices.filter((i) => i.status !== "PAID").reduce((s, i) => s + i.amount, 0);
    const pendingCount = filteredInvoices.filter((i) => i.status === "PENDING").length;
    const approvedCount = filteredInvoices.filter((i) => i.status === "APPROVED").length;
    const paidCount = filteredInvoices.filter((i) => i.status === "PAID").length;
    return { totalAp, totalOutstanding, pendingCount, approvedCount, paidCount };
  }, [filteredInvoices]);

  const handleExport = () => {
    const stamp = new Date().toISOString().slice(0, 10);
    if (tab === "financial-intelligence") {
      exportCsv(
        `ceo_ap_register_${stamp}.csv`,
        ["invoiceId", "vendor", "location", "amount", "dueDate", "status", "daysOverdue"],
        filteredInvoices.map((i) => [i.id, i.vendorName, i.locationName, i.amount, i.dueDate, i.status, i.daysOverdue])
      );
      return;
    }

    exportCsv(
      `ceo_${tab}_${stamp}.csv`,
      ["name", "status", "metric", "owner", "branch"],
      filteredMockRows.map((r) => [r.name, r.status, r.metric, r.owner, selectedLocationName])
    );
  };

  return (
    <div className="p-8 space-y-8 max-w-[1600px] mx-auto">
      {config && !loading && !error && (
        <>
          <div className="flex items-center justify-between gap-4 flex-wrap">
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

          {tab === "financial-intelligence" ? (
            <>
              <KpiGrid className="lg:grid-cols-5">
                <KpiCard title="Branch" value={selectedLocationName} subtitle="Scope" tone="default" />
                <KpiCard title="Total AP" value={`UGX ${fiKpis.totalAp.toLocaleString()}`} subtitle="Register" tone="accent" />
                <KpiCard title="Outstanding" value={`UGX ${fiKpis.totalOutstanding.toLocaleString()}`} subtitle="Unpaid" tone={fiKpis.totalOutstanding > 0 ? "warn" : "good"} />
                <KpiCard title="Pending" value={fiKpis.pendingCount} subtitle="Awaiting approval" tone={fiKpis.pendingCount > 0 ? "warn" : "good"} />
                <KpiCard title="Approved / Paid" value={`${fiKpis.approvedCount} / ${fiKpis.paidCount}`} subtitle="Lifecycle" tone="default" />
              </KpiGrid>
              <FinancialIntelligenceView aging={aging} invoices={filteredInvoices} />
            </>
          ) : (
            <>
              <KpiGrid>
                <KpiCard title="Branch" value={selectedLocationName} subtitle="Scope" tone="default" />
                <KpiCard title="Total Revenue" value="UGX 0" subtitle="Service mapped" tone="accent" />
                <KpiCard title="Total Expenses" value="UGX 0" subtitle="Service mapped" tone="warn" />
                <KpiCard title="Net Profit" value="UGX 0" subtitle="Service mapped" tone="good" />
              </KpiGrid>
              <Card title={config.label} subtitle="Structured shell aligned to role matrix" noPadding>
                <DataTable<CeoMockRow>
                  data={filteredMockRows}
                  columns={[
                    { header: "Name", accessor: "name", className: "font-bold" },
                    { header: "Status", accessor: "status" },
                    { header: "Metric", accessor: "metric", className: "text-right font-mono font-black text-[var(--text-primary)]" },
                    { header: "Owner", accessor: "owner" },
                    { header: "Branch", accessor: () => selectedLocationName, className: "font-bold text-[var(--text-primary)]" },
                  ]}
                  emptyMessage="No rows match your search"
                />
              </Card>
            </>
          )}
        </>
      )}
    </div>
  );
}
