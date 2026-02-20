"use client";

import React, { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import {
  TrendingUp,
  AlertTriangle,
  BarChart3,
  Layers,
  MapPin,
  DollarSign,
  ArrowUpRight,
  ArrowDownRight,
  Building2,
  Users
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/Card";
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
          api.reporting.getExecutiveReports(state.user, { from: fromTo.from, to: fromTo.to }),
          api.reporting.getExecutiveSummary(),
          api.reporting.getBranchRanking(),
          api.reporting.getRevenueTrend(),
        ]);

        const alerts: CEOAlert[] = [];
        if (summary.unpaidInvoices > 3) {
          alerts.push({ id: "alt-inv", severity: "HIGH", message: `${summary.unpaidInvoices} unpaid invoices across locations`, locationName: "System-wide" });
        }
        if (summary.activeRequisitions > 5) {
          alerts.push({ id: "alt-req", severity: "MEDIUM", message: `${summary.activeRequisitions} active requisitions pending`, locationName: "System-wide" });
        }
        for (const branch of branchRanking) {
          if (branch.profit < 0) {
            alerts.push({ id: `alt-loss-${branch.locationId}`, severity: "HIGH", message: `${branch.locationName} is operating at a loss`, locationName: branch.locationName });
          }
        }

        setData({ summary, branchRanking, revenueTrend, alerts, reports });
      } catch (e: unknown) {
        setAccessError(e instanceof Error ? e.message : "Access denied");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [state.user, fromTo.from, fromTo.to]);

  if (loading || !data) {
    return (
      <div className="p-8 space-y-8 animate-pulse">
        <div className="h-12 w-64 bg-slate-200 dark:bg-slate-800 rounded-xl" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map(i => <div key={i} className="h-32 bg-slate-200 dark:bg-slate-800 rounded-3xl" />)}
        </div>
      </div>
    );
  }

  if (accessError) {
    return (
      <div className="p-8 space-y-6 max-w-[1600px] mx-auto">
        <Card title="Executive Command" subtitle="Overview">
          <div className="p-6 text-sm font-bold text-rose-600">{accessError}</div>
        </Card>
      </div>
    );
  }

  const { summary, branchRanking, revenueTrend, alerts, reports } = data;

  return (
    <div className="p-8 space-y-8 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-[#001F3F] dark:text-white tracking-tighter uppercase">Executive Command</h1>
          <p className="text-slate-500 font-medium">Strategic overview of Enterprise Global Group</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="px-4 py-2 bg-teal-50 dark:bg-teal-900/20 border border-teal-100 dark:border-teal-900/50 rounded-xl">
            <p className="text-[10px] font-black text-teal-600 uppercase tracking-widest">Global Status</p>
            <p className="text-sm font-bold text-teal-700 dark:text-teal-400 flex items-center gap-1">
              <TrendingUp className="w-4 h-4" /> {summary.locationCount} Locations Active
            </p>
          </div>
        </div>
      </div>

      {/* Primary KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <KpiCard label="Consolidated Revenue" value={reports.revenueSummary.totalRevenue} icon={DollarSign} isPositive />
        <KpiCard label="Operating Spend" value={reports.revenueSummary.totalExpenses} icon={Layers} isPositive={false} />
        <KpiCard label="Inventory Valuation" value={reports.inventoryHealth.totalStockValue} icon={BarChart3} isPositive />
        <KpiCard label="Net Profit" value={reports.revenueSummary.netProfit} icon={TrendingUp} isPositive={reports.revenueSummary.netProfit > 0} />
      </div>

      {/* Secondary KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <MiniKpi label="Cash Balance" value={`UGX ${summary.cashBalance.toLocaleString()}`} icon={DollarSign} />
        <MiniKpi label="Active Users" value={summary.userCount} icon={Users} />
        <MiniKpi label="Pending Requisitions" value={summary.activeRequisitions} icon={Building2} />
        <MiniKpi label="Outstanding Payables" value={`UGX ${reports.procurementOverview.outstandingPayables.toLocaleString()}`} icon={AlertTriangle} />
      </div>

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
              <div className="p-8 text-center text-slate-400 font-bold">No active alerts</div>
            )}
            {alerts.map(alert => (
              <div key={alert.id} className="p-4 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/10">
                <div className="flex items-start gap-3">
                  <div className={cn(
                    "p-2 rounded-xl",
                    alert.severity === "HIGH" ? "bg-rose-100 text-rose-600" : "bg-amber-100 text-amber-600"
                  )}>
                    <AlertTriangle className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-800 dark:text-white leading-tight">{alert.message}</p>
                    <p className="text-[10px] font-bold text-slate-400 uppercase mt-1 flex items-center gap-1">
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
              <div className="relative inline-flex items-center justify-center p-8 rounded-full border-[12px] border-[#001F3F]/10">
                <div className="text-center">
                  <p className="text-4xl font-black text-[#001F3F] dark:text-white tracking-tighter">UGX {(summary.cashBalance / 1000000).toFixed(0)}M</p>
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Net Cash Flow</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-8 mt-8">
                <div>
                  <p className="text-xl font-black text-emerald-500">{summary.grossMargin.toFixed(1)}%</p>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Gross Margin</p>
                </div>
                <div>
                  <p className="text-xl font-black text-teal-600">{branchRanking.length}</p>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Active Branches</p>
                </div>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}

function KpiCard({ label, value, isPositive, icon: Icon }: { label: string; value: number | string; isPositive: boolean; icon: React.ComponentType<{ className?: string }> }) {
  const displayValue = typeof value === "number" ? `UGX ${value.toLocaleString()}` : value;

  return (
    <Card className="hover:shadow-lg transition-shadow border-none ring-1 ring-slate-200 dark:ring-slate-800">
      <div className="flex justify-between items-start mb-4">
        <div className="p-3 bg-slate-50 dark:bg-white/5 rounded-2xl">
          <Icon className="w-5 h-5 text-[#001F3F] dark:text-teal-400" />
        </div>
        <div className={cn(
          "flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider",
          isPositive ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"
        )}>
          {isPositive ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
          {isPositive ? "Positive" : "Monitor"}
        </div>
      </div>
      <div>
        <p className="text-[11px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1">{label}</p>
        <p className="text-2xl font-black text-[#001F3F] dark:text-white tracking-tight">{displayValue}</p>
      </div>
    </Card>
  );
}

function MiniKpi({ label, value, icon: Icon }: { label: string; value: number | string; icon: React.ComponentType<{ className?: string }> }) {
  return (
    <div className="flex items-center gap-3 p-4 bg-white dark:bg-[#00162a] rounded-2xl border border-slate-200 dark:border-slate-800">
      <Icon className="w-4 h-4 text-slate-400" />
      <div>
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{label}</p>
        <p className="text-lg font-black text-[#001F3F] dark:text-white tracking-tight">{typeof value === "number" ? value.toLocaleString() : value}</p>
      </div>
    </div>
  );
}

