"use client";

import React, { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  Briefcase,
  ChefHat,
  Coffee,
  DollarSign,
  GlassWater,
  LayoutDashboard,
  Package,
  ShieldCheck,
  ShoppingCart,
  Users,
  UtensilsCrossed,
} from "lucide-react";
import { KpiCard, KpiGrid } from "@/components/dashboard/KpiCard";
import { DashboardEmpty, DashboardError, DashboardLoading } from "@/components/dashboard/DashboardStates";
import { api } from "@/lib/api/client";
import { mockDB } from "@/lib/mock-db";
import { useAuth } from "@/contexts/AuthContext";
import { useGlobalDateFilters } from "@/contexts/GlobalDateFiltersContext";
import type { BranchRanking, ExecutiveReports } from "@/lib/api/services/reporting.service";

type BranchViewData = {
  reports: ExecutiveReports;
  branch: BranchRanking;
};

type DepartmentDef = {
  key: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
};

const DEPARTMENTS: DepartmentDef[] = [
  { key: "finance", label: "Finance", icon: DollarSign },
  { key: "procurement", label: "Procurement", icon: ShoppingCart },
  { key: "store-manager", label: "Store Manager", icon: Package },
  { key: "store-controller", label: "Store Controller", icon: ShieldCheck },
  { key: "general-manager", label: "General Manager", icon: LayoutDashboard },
  { key: "director", label: "Director", icon: Briefcase },
  { key: "kitchen", label: "Kitchen", icon: ChefHat },
  { key: "bar", label: "Bar", icon: GlassWater },
  { key: "cafe", label: "Cafe", icon: Coffee },
  { key: "operations", label: "Operations", icon: UtensilsCrossed },
  { key: "front-of-house", label: "Front of House", icon: Users },
];

export default function CeoBranchViewPage() {
  const params = useParams<{ branchId: string }>();
  const branchId = params.branchId;
  const router = useRouter();

  const { state } = useAuth();
  const { filters } = useGlobalDateFilters();

  const [data, setData] = useState<BranchViewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [accessError, setAccessError] = useState<string | null>(null);

  const fromTo = useMemo(() => {
    const from = filters.fromDate ? `${filters.fromDate}T00:00:00Z` : "2026-02-01T00:00:00Z";
    const to = filters.toDate ? `${filters.toDate}T23:59:59Z` : "2026-02-28T23:59:59Z";
    return { from, to };
  }, [filters.fromDate, filters.toDate]);

  const branch = useMemo(() => {
    if (branchId === "the-maze-bistro") return null;
    if (branchId === "the-villa") return null;
    return mockDB.locations.find((l) => l.id === branchId) ?? null;
  }, [branchId]);

  const virtualBranch = useMemo(() => {
    if (branchId === "the-maze-bistro") {
      return { displayName: "THE MAZE BISTRO", logoSrc: "/TheMazeBistro-logo.jpeg", baseKey: "patiobella" as const };
    }
    if (branchId === "the-villa") {
      return { displayName: "THE VILLA", logoSrc: "/Villa-logo.jpeg", baseKey: "eateroo" as const };
    }
    return null;
  }, [branchId]);

  const baseLocationId = useMemo(() => {
    if (!virtualBranch) return branchId;
    const baseName = virtualBranch.baseKey === "patiobella" ? "Patiobella" : "Eateroo";
    return mockDB.locations.find((l) => l.name === baseName)?.id ?? branchId;
  }, [virtualBranch, branchId]);

  const displayName = useMemo(() => {
    if (virtualBranch) return virtualBranch.displayName;
    const name = branch?.name ?? "";
    if (name.trim().toLowerCase() === "eateroo") return "EATEROO!";
    return name ? name.toUpperCase() : "BRANCH";
  }, [virtualBranch, branch?.name]);

  const logoSrc = useMemo(() => {
    if (virtualBranch) return virtualBranch.logoSrc;
    const byName: Record<string, string> = {
      patiobella: "/Patiobella-logo.jpeg",
      eateroo: "/Eateroo!-logo.jpeg",
    };
    const name = branch?.name?.trim().toLowerCase();
    return name ? byName[name] : undefined;
  }, [branch?.name, virtualBranch]);

  useEffect(() => {
    async function load() {
      try {
        setAccessError(null);
        if (!state.user) return;

        const [reports, ranking] = await Promise.all([
          api.reporting.getExecutiveReports(state.user, { from: fromTo.from, to: fromTo.to, locationId: baseLocationId }),
          api.reporting.getBranchRanking(),
        ]);

        const r = ranking.find((b) => b.locationId === baseLocationId);
        if (!r) {
          setData(null);
          return;
        }

        setData({ reports, branch: r });
      } catch (e: unknown) {
        setAccessError(e instanceof Error ? e.message : "Access denied");
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [state.user, fromTo.from, fromTo.to, baseLocationId]);

  if (loading) return <DashboardLoading titleWidthClassName="w-1/3" />;
  if (accessError) return <DashboardError title="Branch View" message={accessError} />;
  if (!data) return <DashboardEmpty title="Branch View" message="Branch data not available." />;

  return (
    <div className="p-8 space-y-8 max-w-[1600px] mx-auto">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div className="flex items-center gap-5">
          <div className="relative w-24 h-24 rounded-3xl overflow-hidden bg-black/10 border border-white/10">
            {logoSrc ? (
              <Image src={logoSrc} alt={`${displayName} logo`} fill className="object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-sm font-black text-[var(--text-muted)]">
                {displayName.slice(0, 2).toUpperCase()}
              </div>
            )}
          </div>
          <div>
            <h1 className="text-3xl font-black text-[var(--text-primary)] tracking-tighter uppercase">{displayName}</h1>
            <p className="text-[var(--text-secondary)] font-medium">Executive branch view and department drill-down.</p>
          </div>
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

      <KpiGrid className="lg:grid-cols-5">
        <KpiCard title="Total Revenue" value={`UGX ${data.reports.revenueSummary.totalRevenue.toLocaleString()}`} icon={DollarSign} subtitle="Branch" tone="accent" />
        <KpiCard title="Total Expenses" value={`UGX ${data.reports.revenueSummary.totalExpenses.toLocaleString()}`} icon={Package} subtitle="Branch" tone="warn" />
        <KpiCard title="Net Profit" value={`UGX ${data.reports.revenueSummary.netProfit.toLocaleString()}`} icon={LayoutDashboard} subtitle={`Margin ${data.reports.revenueSummary.profitMarginPercent.toFixed(1)}%`} tone={data.reports.revenueSummary.netProfit > 0 ? "good" : "danger"} />
        <KpiCard title="Outstanding Payables" value={`UGX ${data.reports.procurementOverview.outstandingPayables.toLocaleString()}`} icon={ShoppingCart} subtitle="Branch" tone={data.reports.procurementOverview.outstandingPayables > 0 ? "warn" : "good"} />
        <KpiCard title="Inventory Value" value={`UGX ${data.reports.inventoryHealth.totalStockValue.toLocaleString()}`} icon={Package} subtitle="Branch" tone="default" />
      </KpiGrid>

      <div className="space-y-3">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 className="text-xl font-black text-[var(--text-primary)] tracking-tight uppercase">Departments</h2>
            <p className="text-[var(--text-muted)] font-medium">Select a department to view read-only KPIs and tables for this branch.</p>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-5">
          {DEPARTMENTS.map((d) => {
            const Icon = d.icon;
            return (
              <Link
                key={d.key}
                href={`/ceo/branch/${branchId}/${d.key}`}
                className="rounded-2xl border border-white/10 bg-[var(--surface-raised)] p-5 hover:-translate-y-0.5 hover:shadow-[0_10px_30px_rgba(0,0,0,0.35)] transition-all"
              >
                <div className="flex items-center gap-3">
                  <div className="p-3 rounded-2xl bg-white/5 border border-white/10">
                    <Icon className="w-5 h-5 text-[var(--text-primary)]" />
                  </div>
                  <div>
                    <p className="text-sm font-black text-[var(--text-primary)] tracking-tight">{d.label}</p>
                    <p className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-widest">Open view</p>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
