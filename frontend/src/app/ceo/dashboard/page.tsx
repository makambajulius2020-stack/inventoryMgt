"use client";

import React, { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import {
  TrendingUp,
  AlertTriangle,
  BarChart3,
  Layers,
  MapPin,
  DollarSign,
  Building2,
  Users
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { KpiCard, KpiGrid } from "@/components/dashboard/KpiCard";
import { DashboardEmpty, DashboardError, DashboardLoading } from "@/components/dashboard/DashboardStates";
import { AiInsightsPanel } from "@/components/dashboard/AiInsightsPanel";
import { api } from "@/lib/api/client";
import { useAuth } from "@/contexts/AuthContext";
import { useGlobalDateFilters } from "@/contexts/GlobalDateFiltersContext";
import type { BranchRanking, ExecutiveReports, ExecutiveSummary, RevenueTrendPoint } from "@/lib/api/services/reporting.service";

const RevenueChart = dynamic(() => import("./RevenueChart"), { ssr: false, loading: () => <ChartSkeleton /> });
const BranchChart = dynamic(() => import("./BranchChart"), { ssr: false, loading: () => <ChartSkeleton /> });

function ChartSkeleton() {
  return <div className="h-[300px] bg-[var(--surface-raised)] rounded-[var(--radius-lg)] animate-pulse" />;
}

type CEOAlert = {
  id: string;
  severity: "HIGH" | "MEDIUM" | "LOW";
  message: string;
  locationName: string;
};

type CEODashboardData = {
  summary: ExecutiveSummary;
  branchRanking: BranchRanking[];
  revenueTrend: RevenueTrendPoint[];
  alerts: CEOAlert[];
  reports: ExecutiveReports;
};

export default function CeoDashboard() {
  const { state } = useAuth();
  const { filters } = useGlobalDateFilters();
  const [data, setData] = useState<CEODashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [accessError, setAccessError] = useState<string | null>(null);

  const selectedLocationId = useMemo(() => {
    if (!filters.location || filters.location === "ALL") return undefined;
    return filters.location;
  }, [filters.location]);

  const fromTo = useMemo(() => {
    const from = filters.fromDate ? `${filters.fromDate}T00:00:00Z` : "2026-02-01T00:00:00Z";
    const to = filters.toDate ? `${filters.toDate}T23:59:59Z` : "2026-02-28T23:59:59Z";
    return { from, to };
  }, [filters.fromDate, filters.toDate]);

  useEffect(() => {
    async function load() {
      try {
        setAccessError(null);
        if (!state.user) return;

        const [reports, summary, branchRanking, revenueTrend] = await Promise.all([
          api.reporting.getExecutiveReports(state.user, { from: fromTo.from, to: fromTo.to, locationId: selectedLocationId }),
          api.reporting.getExecutiveSummary(),
          api.reporting.getBranchRanking(),
          api.reporting.getRevenueTrend(state.user, { locationId: selectedLocationId }),
        ]);

        const scopedBranchRanking = selectedLocationId
          ? branchRanking.filter((b) => b.locationId === selectedLocationId)
          : branchRanking;

        const alerts: CEOAlert[] = [];
        if (summary.unpaidInvoices > 3) {
          alerts.push({ id: "alt-inv", severity: "HIGH", message: `${summary.unpaidInvoices} unpaid invoices across locations`, locationName: "System-wide" });
        }
        if (summary.activeRequisitions > 5) {
          alerts.push({ id: "alt-req", severity: "MEDIUM", message: `${summary.activeRequisitions} active requisitions pending`, locationName: "System-wide" });
        }
        for (const branch of scopedBranchRanking) {
          if (branch.profit < 0) {
            alerts.push({ id: `alt-loss-${branch.locationId}`, severity: "HIGH", message: `${branch.locationName} is operating at a loss`, locationName: branch.locationName });
          }
        }

        setData({ summary, branchRanking: scopedBranchRanking, revenueTrend, alerts, reports });
      } catch (e: unknown) {
        setAccessError(e instanceof Error ? e.message : "Access denied");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [state.user, fromTo.from, fromTo.to, selectedLocationId]);

  if (loading) {
    return <DashboardLoading titleWidthClassName="w-1/3" />;
  }

  if (accessError) {
    return <DashboardError title="Executive Command" message={accessError} />;
  }

  if (!data) {
    return <DashboardEmpty title="Executive Command" message="No dashboard data available." />;
  }

  const { summary, branchRanking, revenueTrend, alerts, reports } = data;

  return (
    <div className="p-8 space-y-8 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-[var(--text-primary)] tracking-tighter uppercase">Executive Command</h1>
          <p className="text-[var(--text-secondary)] font-medium">Strategic overview of Enterprise Global Group</p>
        </div>
        <div className="flex items-center gap-3">
          <Button asChild variant="outline" size="sm">
            <Link href="/ceo/reports">Open Reports</Link>
          </Button>
          <Button asChild size="sm">
            <Link href="/ceo/users">Identity Oversight</Link>
          </Button>
          <div className="px-4 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
            <p className="text-[10px] font-black text-emerald-300 uppercase tracking-widest">Global Status</p>
            <p className="text-sm font-bold text-emerald-200 flex items-center gap-1">
              <TrendingUp className="w-4 h-4" /> {summary.locationCount} Locations Active
            </p>
          </div>
        </div>
      </div>

      {/* Primary KPIs */}
      <KpiGrid>
        <KpiCard title="Total Revenue" value={`UGX ${reports.revenueSummary.totalRevenue.toLocaleString()}`} icon={DollarSign} subtitle="Global" tone="accent" />
        <KpiCard title="Total Expenses" value={`UGX ${reports.revenueSummary.totalExpenses.toLocaleString()}`} icon={Layers} subtitle="Global" tone="warn" />
        <KpiCard title="Net Profit" value={`UGX ${reports.revenueSummary.netProfit.toLocaleString()}`} icon={TrendingUp} subtitle={`Margin ${reports.revenueSummary.profitMarginPercent.toFixed(1)}%`} tone={reports.revenueSummary.netProfit > 0 ? "good" : "danger"} />
        <KpiCard title="Cash Position" value={`UGX ${summary.cashBalance.toLocaleString()}`} icon={DollarSign} subtitle="Derived" tone="good" />
      </KpiGrid>

      {/* Secondary KPIs */}
      <KpiGrid className="lg:grid-cols-4">
        <KpiCard title="Outstanding Payables" value={`UGX ${reports.procurementOverview.outstandingPayables.toLocaleString()}`} icon={AlertTriangle} subtitle="Accounts payable" tone={reports.procurementOverview.outstandingPayables > 0 ? "warn" : "good"} />
        <KpiCard title="Outstanding Receivables" value={`UGX ${reports.revenueSummary.totalRevenue.toLocaleString()}`} icon={BarChart3} subtitle="Mapped from service outputs" tone="default" />
        <KpiCard title="Vendor Exposure" value={summary.unpaidInvoices} icon={Building2} subtitle="Unpaid invoice exposure" tone="default" />
        <KpiCard title="Department Performance Summary" value={summary.activeRequisitions} icon={Users} subtitle="Active requisitions summary" tone={summary.activeRequisitions > 0 ? "warn" : "good"} />
      </KpiGrid>

      <AiInsightsPanel />

      {/* Main Insights */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Trend Analysis */}
        <Card title="Revenue vs Expense Trends" className="lg:col-span-2">
          <div className="mt-4">
            <RevenueChart data={revenueTrend} />
          </div>
        </Card>

        {/* Risk Alerts */}
        <Card title="Risk Indicators" subtitle="High priority operational alerts">
          <div className="space-y-4">
            {alerts.length === 0 && (
              <div className="p-8 text-center text-[var(--text-muted)] font-bold">No active alerts</div>
            )}
            {alerts.map(alert => (
              <div key={alert.id} className="p-4 rounded-2xl bg-white/5 border border-white/10">
                <div className="flex items-start gap-3">
                  <div className={cn(
                    "p-2 rounded-xl",
                    alert.severity === "HIGH" ? "bg-rose-500/10 text-rose-300 border border-rose-500/20" : "bg-amber-500/10 text-amber-300 border border-amber-500/20"
                  )}>
                    <AlertTriangle className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-[var(--text-primary)] leading-tight">{alert.message}</p>
                    <p className="text-[10px] font-bold text-[var(--text-muted)] uppercase mt-1 flex items-center gap-1">
                      <MapPin className="w-3 h-3" /> {alert.locationName}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Branch Comparisons */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <Card title="Regional Performance Matrix">
          <div className="mt-4">
            <BranchChart data={branchRanking.map(b => ({ name: b.locationName, revenue: b.revenue, profit: b.profit }))} />
          </div>
        </Card>

        <Card title="Executive Profitability" subtitle="Global vs Target Benchmarks">
          <div className="flex items-center justify-center h-[300px]">
            <div className="text-center">
              <div className="relative inline-flex items-center justify-center p-8 rounded-full border-[12px] border-white/10">
                <div className="text-center">
                  <p className="text-4xl font-black text-[var(--text-primary)] tracking-tighter">UGX {(summary.cashBalance / 1000000).toFixed(0)}M</p>
                  <p className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-widest">Net Cash Flow</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-8 mt-8">
                <div>
                  <p className="text-xl font-black text-emerald-500">{summary.grossMargin.toFixed(1)}%</p>
                  <p className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest leading-none">Gross Margin</p>
                </div>
                <div>
                  <p className="text-xl font-black text-teal-600">{branchRanking.length}</p>
                  <p className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest leading-none">Active Branches</p>
                </div>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
