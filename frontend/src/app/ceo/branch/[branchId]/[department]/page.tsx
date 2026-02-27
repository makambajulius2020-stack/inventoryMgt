"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { DollarSign, Package, ShoppingCart, TrendingUp } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { DataTable } from "@/components/ui/DataTable";
import { KpiCard, KpiGrid } from "@/components/dashboard/KpiCard";
import { DashboardEmpty, DashboardError, DashboardLoading } from "@/components/dashboard/DashboardStates";
import { api } from "@/lib/api/client";
import { mockDB } from "@/lib/mock-db";
import { useAuth } from "@/contexts/AuthContext";
import { useGlobalDateFilters } from "@/contexts/GlobalDateFiltersContext";
import type { ExecutiveReports } from "@/lib/api/services/reporting.service";
import type { InvoiceRow } from "@/lib/api/services/finance.service";
import type { LPORow, GRNRow, RequisitionRow } from "@/lib/api/services/procurement.service";

type DepartmentViewData = {
  reports: ExecutiveReports;
  invoices: InvoiceRow[];
  lpos: LPORow[];
  grns: GRNRow[];
  requisitions: RequisitionRow[];
};

const TITLE_BY_DEPARTMENT: Record<string, string> = {
  finance: "Finance",
  procurement: "Procurement",
  "store-manager": "Store Manager",
  "store-controller": "Store Controller",
  "general-manager": "General Manager",
  director: "Director",
  kitchen: "Kitchen",
  bar: "Bar",
  cafe: "Cafe",
  operations: "Operations",
  "front-of-house": "Front of House",
};

export default function CeoBranchDepartmentViewPage() {
  const params = useParams<{ branchId: string; department: string }>();
  const branchId = params.branchId;
  const department = params.department;
  const router = useRouter();

  const { state } = useAuth();
  const { filters } = useGlobalDateFilters();

  const [data, setData] = useState<DepartmentViewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [accessError, setAccessError] = useState<string | null>(null);

  const fromTo = useMemo(() => {
    const from = filters.fromDate ? `${filters.fromDate}T00:00:00Z` : "2026-02-01T00:00:00Z";
    const to = filters.toDate ? `${filters.toDate}T23:59:59Z` : "2026-02-28T23:59:59Z";
    return { from, to };
  }, [filters.fromDate, filters.toDate]);

  const virtualBranch = useMemo(() => {
    if (branchId === "the-maze-bistro") {
      return { displayName: "THE MAZE BISTRO", baseName: "Patiobella" };
    }
    if (branchId === "the-villa") {
      return { displayName: "THE VILLA", baseName: "Eateroo" };
    }
    return null;
  }, [branchId]);

  const baseBranchName = useMemo(() => {
    if (virtualBranch) return virtualBranch.baseName;
    return mockDB.locations.find((l) => l.id === branchId)?.name ?? "Branch";
  }, [virtualBranch, branchId]);

  const baseBranchId = useMemo(() => {
    if (!virtualBranch) return branchId;
    return mockDB.locations.find((l) => l.name === virtualBranch.baseName)?.id ?? branchId;
  }, [virtualBranch, branchId]);

  const displayBranchName = useMemo(() => {
    if (virtualBranch) return virtualBranch.displayName;
    if (baseBranchName.trim().toLowerCase() === "eateroo") return "EATEROO!";
    return baseBranchName;
  }, [virtualBranch, baseBranchName]);

  const departmentTitle = TITLE_BY_DEPARTMENT[department] ?? department;

  useEffect(() => {
    async function load() {
      try {
        setAccessError(null);
        if (!state.user) return;

        const [reports, invoices, lpos, grns, reqs] = await Promise.all([
          api.reporting.getExecutiveReports(state.user, { from: fromTo.from, to: fromTo.to, locationId: baseBranchId }),
          api.finance.getInvoices(state.user),
          api.procurement.getLPOs(state.user),
          api.procurement.getGRNs(state.user),
          api.procurement.getRequisitions(state.user),
        ]);

        setData({ reports, invoices, lpos, grns, requisitions: reqs });
      } catch (e: unknown) {
        setAccessError(e instanceof Error ? e.message : "Access denied");
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [state.user, fromTo.from, fromTo.to, baseBranchId]);

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

  const filteredInvoices = useMemo(() => {
    if (!data) return [];
    const locName = baseBranchName;
    return data.invoices.filter((i) => i.locationName === locName);
  }, [data, baseBranchName]);

  const filteredLpos = useMemo(() => {
    if (!data) return [];
    const locName = baseBranchName;
    return data.lpos.filter((l) => l.locationName === locName);
  }, [data, baseBranchName]);

  const filteredGrns = useMemo(() => {
    if (!data) return [];
    const locName = baseBranchName;
    return data.grns.filter((g) => g.locationName === locName);
  }, [data, baseBranchName]);

  const filteredReqs = useMemo(() => {
    if (!data) return [];
    const locName = baseBranchName;
    return data.requisitions.filter((r) => r.locationName === locName && withinRange(r.createdAt));
  }, [data, baseBranchName, filters.fromDate, filters.toDate]);

  const content = useMemo(() => {
    if (!data) return { kpis: null as React.ReactNode, tables: null as React.ReactNode };

    if (department === "finance") {
      const outstanding = filteredInvoices.filter((i) => i.status !== "PAID").reduce((s, i) => s + i.amount, 0);
      const paid = filteredInvoices.filter((i) => i.status === "PAID").reduce((s, i) => s + i.amount, 0);
      const total = filteredInvoices.reduce((s, i) => s + i.amount, 0);

      return {
        kpis: (
          <KpiGrid className="lg:grid-cols-4">
            <KpiCard title="Outstanding Payables" value={`UGX ${outstanding.toLocaleString()}`} icon={TrendingUp} subtitle="Invoices" tone={outstanding > 0 ? "warn" : "good"} />
            <KpiCard title="Paid" value={`UGX ${paid.toLocaleString()}`} icon={DollarSign} subtitle="Invoices" tone="good" />
            <KpiCard title="Total Invoices" value={filteredInvoices.length} icon={DollarSign} subtitle="Count" tone="default" />
            <KpiCard title="Invoice Volume" value={`UGX ${total.toLocaleString()}`} icon={DollarSign} subtitle="Total" tone="accent" />
          </KpiGrid>
        ),
        tables: (
          <Card title="Invoices" subtitle="Read-only branch invoices" noPadding>
            <DataTable
              data={filteredInvoices}
              columns={[
                { header: "Invoice #", accessor: "id", className: "font-mono font-black" },
                { header: "Vendor", accessor: "vendorName", className: "font-bold" },
                { header: "Amount", accessor: (i: InvoiceRow) => `UGX ${i.amount.toLocaleString()}`, className: "text-right font-mono font-black text-[var(--text-primary)]" },
                { header: "Due", accessor: (i: InvoiceRow) => new Date(i.dueDate).toLocaleDateString(), className: "text-[var(--text-muted)]" },
                { header: "Status", accessor: (i: InvoiceRow) => i.status, className: "font-black" },
              ]}
              emptyMessage="No invoices for this branch"
            />
          </Card>
        ),
      };
    }

    if (department === "procurement") {
      const openLpos = filteredLpos.filter((l) => l.status !== "CLOSED" && l.status !== "CANCELLED").length;
      const pendingGrns = filteredGrns.filter((g) => g.status !== "RECEIVED").length;
      const reqCount = filteredReqs.length;

      return {
        kpis: (
          <KpiGrid className="lg:grid-cols-4">
            <KpiCard title="Open LPOs" value={openLpos} icon={ShoppingCart} subtitle="Active" tone={openLpos > 0 ? "warn" : "good"} />
            <KpiCard title="Pending GRNs" value={pendingGrns} icon={ShoppingCart} subtitle="Inbound" tone={pendingGrns > 0 ? "warn" : "good"} />
            <KpiCard title="Requisitions" value={reqCount} icon={ShoppingCart} subtitle="In range" tone="default" />
            <KpiCard title="Outstanding Payables" value={`UGX ${data.reports.procurementOverview.outstandingPayables.toLocaleString()}`} icon={DollarSign} subtitle="Branch" tone={data.reports.procurementOverview.outstandingPayables > 0 ? "warn" : "good"} />
          </KpiGrid>
        ),
        tables: (
          <div className="space-y-6">
            <Card title="Requisitions" subtitle="Read-only branch requisitions" noPadding>
              <DataTable
                data={filteredReqs}
                columns={[
                  { header: "Date", accessor: (r: RequisitionRow) => new Date(r.createdAt).toLocaleDateString(), className: "text-[var(--text-muted)]" },
                  { header: "Department", accessor: "departmentName", className: "font-black" },
                  { header: "Requested By", accessor: "requestedByName", className: "font-bold" },
                  { header: "Items", accessor: "itemCount", className: "text-right font-mono font-black" },
                  { header: "Total", accessor: (r: RequisitionRow) => `UGX ${r.totalAmount.toLocaleString()}`, className: "text-right font-mono font-black text-[var(--text-primary)]" },
                  { header: "Status", accessor: (r: RequisitionRow) => r.status, className: "font-black" },
                ]}
                emptyMessage="No requisitions for this branch"
              />
            </Card>

            <Card title="Local Purchase Orders" subtitle="Read-only branch LPOs" noPadding>
              <DataTable
                data={filteredLpos}
                columns={[
                  { header: "Issued", accessor: (l: LPORow) => new Date(l.issuedAt).toLocaleDateString(), className: "text-[var(--text-muted)]" },
                  { header: "LPO #", accessor: "id", className: "font-mono font-black" },
                  { header: "Vendor", accessor: "vendorName", className: "font-bold" },
                  { header: "Amount", accessor: (l: LPORow) => `UGX ${l.totalAmount.toLocaleString()}`, className: "text-right font-mono font-black text-[var(--text-primary)]" },
                  { header: "Status", accessor: (l: LPORow) => l.status, className: "font-black" },
                ]}
                emptyMessage="No LPOs for this branch"
              />
            </Card>

            <Card title="Goods Received Notes" subtitle="Read-only branch GRNs" noPadding>
              <DataTable
                data={filteredGrns}
                columns={[
                  { header: "Received", accessor: (g: GRNRow) => new Date(g.receivedAt).toLocaleDateString(), className: "text-[var(--text-muted)]" },
                  { header: "GRN #", accessor: "id", className: "font-mono font-black" },
                  { header: "By", accessor: "receivedByName", className: "font-bold" },
                  { header: "Total", accessor: (g: GRNRow) => `UGX ${g.totalAmount.toLocaleString()}`, className: "text-right font-mono font-black text-[var(--text-primary)]" },
                  { header: "Status", accessor: (g: GRNRow) => g.status, className: "font-black" },
                ]}
                emptyMessage="No GRNs for this branch"
              />
            </Card>
          </div>
        ),
      };
    }

    const stockValue = data.reports.inventoryHealth.totalStockValue;
    const lowStock = data.reports.inventoryHealth.lowStockAlertsCount;

    return {
      kpis: (
        <KpiGrid className="lg:grid-cols-4">
          <KpiCard title="Revenue" value={`UGX ${data.reports.revenueSummary.totalRevenue.toLocaleString()}`} icon={DollarSign} subtitle="Branch" tone="accent" />
          <KpiCard title="Net Profit" value={`UGX ${data.reports.revenueSummary.netProfit.toLocaleString()}`} icon={TrendingUp} subtitle="Branch" tone={data.reports.revenueSummary.netProfit > 0 ? "good" : "danger"} />
          <KpiCard title="Inventory Value" value={`UGX ${stockValue.toLocaleString()}`} icon={Package} subtitle="Branch" tone="default" />
          <KpiCard title="Low Stock Alerts" value={lowStock} icon={Package} subtitle="Branch" tone={lowStock > 0 ? "warn" : "good"} />
        </KpiGrid>
      ),
      tables: (
        <Card title="Department View" subtitle="No department-specific tables are mapped for this view yet." noPadding>
          <div className="p-6 text-sm font-bold text-[var(--text-muted)]">
            This department currently shows branch-level KPIs only.
          </div>
        </Card>
      ),
    };
  }, [data, department, filteredInvoices, filteredLpos, filteredGrns, filteredReqs]);

  if (loading) return <DashboardLoading titleWidthClassName="w-1/3" />;
  if (accessError) return <DashboardError title="Department View" message={accessError} />;
  if (!data) return <DashboardEmpty title="Department View" message="Department data not available." />;

  return (
    <div className="p-8 space-y-8 max-w-[1600px] mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-[var(--text-primary)] tracking-tighter uppercase">{displayBranchName} — {departmentTitle}</h1>
          <p className="text-[var(--text-secondary)] font-medium">Read-only executive view filtered by branch and department.</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => router.back()}
            className="rounded-xl border border-white/10 bg-[var(--surface-raised)] px-4 py-2 text-sm font-black text-[var(--text-primary)] hover:-translate-y-0.5 transition-all"
          >
            Back
          </button>
        </div>
      </div>

      {content.kpis}
      {content.tables}
    </div>
  );
}
