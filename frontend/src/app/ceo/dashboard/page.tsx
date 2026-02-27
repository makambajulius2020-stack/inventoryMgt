"use client";

import React, { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { DollarSign, Layers, TrendingUp, Package } from "lucide-react";
import { KpiCard, KpiGrid } from "@/components/dashboard/KpiCard";
import { DashboardEmpty, DashboardError, DashboardLoading } from "@/components/dashboard/DashboardStates";
import { api } from "@/lib/api/client";
import { useAuth } from "@/contexts/AuthContext";
import { useGlobalDateFilters } from "@/contexts/GlobalDateFiltersContext";
import type { BranchRanking, ExecutiveReports, ExecutiveSummary, RevenueTrendPoint } from "@/lib/api/services/reporting.service";

type CEODashboardData = {
  summary: ExecutiveSummary;
  branchRanking: BranchRanking[];
  reports: ExecutiveReports;
};

export default function CeoDashboard() {
  const { state } = useAuth();
  const { filters } = useGlobalDateFilters();
  const [data, setData] = useState<CEODashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [accessError, setAccessError] = useState<string | null>(null);

  const fromTo = useMemo(() => {
    const from = filters.fromDate ? `${filters.fromDate}T00:00:00Z` : "2026-02-01T00:00:00Z";
    const to = filters.toDate ? `${filters.toDate}T23:59:59Z` : "2026-02-28T23:59:59Z";
    return { from, to };
  }, [filters.fromDate, filters.toDate]);

  const logoByBranchName = useMemo(() => {
    return {
      patiobella: "/Patiobella-logo.jpeg",
      eateroo: "/Eateroo!-logo.jpeg",
      "the maze bistro": "/TheMazeBistro-logo.jpeg",
      "the villa": "/Villa-logo.jpeg",
    } as Record<string, string>;
  }, []);

  useEffect(() => {
    async function load() {
      try {
        setAccessError(null);
        if (!state.user) return;

        const [reports, summary, branchRanking] = await Promise.all([
          api.reporting.getExecutiveReports(state.user, { from: fromTo.from, to: fromTo.to }),
          api.reporting.getExecutiveSummary(),
          api.reporting.getBranchRanking(),
        ]);

        setData({ summary, branchRanking, reports });
      } catch (e: unknown) {
        setAccessError(e instanceof Error ? e.message : "Access denied");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [state.user, fromTo.from, fromTo.to]);

  const branchRankingRows = data?.branchRanking ?? [];

  const branches = useMemo(() => {
    const map = new Map<string, BranchRanking>();
    branchRankingRows.forEach((b) => map.set(b.locationName.trim().toLowerCase(), b));

    const pb = map.get("patiobella");
    const ea = map.get("eateroo");
    const rows: { id: string; displayName: string; logoSrc: string; data: BranchRanking | undefined }[] = [];

    if (pb) rows.push({ id: pb.locationId, displayName: "PATIOBELLA", logoSrc: "/Patiobella-logo.jpeg", data: pb });
    if (ea) rows.push({ id: ea.locationId, displayName: "EATEROO!", logoSrc: "/Eateroo!-logo.jpeg", data: ea });

    rows.push({ id: "the-maze-bistro", displayName: "THE MAZE BISTRO", logoSrc: "/TheMazeBistro-logo.jpeg", data: pb ?? ea });
    rows.push({ id: "the-villa", displayName: "THE VILLA", logoSrc: "/Villa-logo.jpeg", data: ea ?? pb });

    return rows.filter((r) => !!r.data);
  }, [branchRankingRows]);

  if (loading) {
    return <DashboardLoading titleWidthClassName="w-1/3" />;
  }

  if (accessError) {
    return <DashboardError title="Executive Command" message={accessError} />;
  }

  if (!data) {
    return <DashboardEmpty title="Executive Command" message="No dashboard data available." />;
  }

  const { summary, branchRanking, reports } = data;

  void branchRanking;

  return (
    <div className="p-8 space-y-8 max-w-[1600px] mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-[var(--text-primary)] tracking-tighter uppercase">Executive Command Center</h1>
          <p className="text-[var(--text-secondary)] font-medium">Select a branch to drill into departments and performance.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="px-4 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
            <p className="text-[10px] font-black text-emerald-300 uppercase tracking-widest">Global Status</p>
            <p className="text-sm font-bold text-emerald-200 flex items-center gap-1">
              <TrendingUp className="w-4 h-4" /> {summary.locationCount} Locations Active
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 className="text-xl font-black text-[var(--text-primary)] tracking-tight uppercase">Branches</h2>
            <p className="text-[var(--text-muted)] font-medium">Click a branch logo to open its executive view.</p>
          </div>
          <p className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-widest">{branches.length} Active</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {branches.map((b) => {
            return (
              <Link
                key={b.id}
                href={`/ceo/branch/${b.id}`}
                className="group rounded-2xl border border-white/10 bg-[var(--surface-raised)] p-6 hover:-translate-y-0.5 hover:shadow-[0_10px_30px_rgba(0,0,0,0.35)] transition-all"
              >
                <div className="flex items-center gap-4">
                  <div className="relative w-16 h-16 rounded-2xl overflow-hidden bg-black/10 border border-white/10">
                    {b.logoSrc ? (
                      <Image src={b.logoSrc} alt={`${b.displayName} logo`} fill className="object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-xs font-black text-[var(--text-muted)]">{b.displayName.slice(0, 2).toUpperCase()}</div>
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-lg font-black text-[var(--text-primary)] tracking-tight truncate">{b.displayName}</p>
                    <p className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-widest">Tap to open branch view</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 mt-6">
                  <div>
                    <p className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest">Revenue</p>
                    <p className="text-xl font-black text-[var(--text-primary)] tracking-tight">UGX {b.data!.revenue.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest">Expenses</p>
                    <p className="text-xl font-black text-[var(--text-primary)] tracking-tight">UGX {b.data!.expenses.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest">Profit</p>
                    <p className={b.data!.profit >= 0 ? "text-xl font-black text-emerald-300 tracking-tight" : "text-xl font-black text-rose-300 tracking-tight"}>
                      UGX {b.data!.profit.toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest">Stock Value</p>
                    <p className="text-xl font-black text-[var(--text-primary)] tracking-tight">UGX {b.data!.stockValue.toLocaleString()}</p>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>

      <KpiGrid>
        <KpiCard title="Total Revenue" value={`UGX ${reports.revenueSummary.totalRevenue.toLocaleString()}`} icon={DollarSign} subtitle="Global" tone="accent" />
        <KpiCard title="Total Expenses" value={`UGX ${reports.revenueSummary.totalExpenses.toLocaleString()}`} icon={Layers} subtitle="Global" tone="warn" />
        <KpiCard title="Net Profit" value={`UGX ${reports.revenueSummary.netProfit.toLocaleString()}`} icon={TrendingUp} subtitle={`Margin ${reports.revenueSummary.profitMarginPercent.toFixed(1)}%`} tone={reports.revenueSummary.netProfit > 0 ? "good" : "danger"} />
        <KpiCard title="Inventory Value" value={`UGX ${reports.inventoryHealth.totalStockValue.toLocaleString()}`} icon={Package} subtitle="Global" tone="default" />
      </KpiGrid>
    </div>
  );
}
