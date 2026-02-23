"use client";

import React, { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import {
  DollarSign,
  BarChart3,
  PieChart,
  Wallet,
  Clock,
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { DataTable } from "@/components/ui/DataTable";
import { StatusBadge } from "@/components/core/StatusBadge";
import { KpiCard, KpiGrid } from "@/components/dashboard/KpiCard";
import { DashboardEmpty, DashboardError, DashboardLoading } from "@/components/dashboard/DashboardStates";
import { AiInsightsPanel } from "@/components/dashboard/AiInsightsPanel";
import { api } from "@/lib/api/client";
import { useAuth } from "@/contexts/AuthContext";
import type { FinanceKPIs, APAgingRow, InvoiceRow } from "@/lib/api/services/finance.service";

const APAgingChart = dynamic(() => import("./APAgingChart"), { ssr: false, loading: () => <ChartSkeleton /> });
const LiabilityPieChart = dynamic(() => import("./LiabilityPieChart"), { ssr: false, loading: () => <ChartSkeleton /> });

function ChartSkeleton() {
  return <div className="h-[300px] bg-[var(--surface-raised)] rounded-[var(--radius-lg)] animate-pulse" />;
}

export default function FinanceDashboard() {
  const { state } = useAuth();
  const [kpis, setKpis] = useState<FinanceKPIs | null>(null);
  const [aging, setAging] = useState<APAgingRow[]>([]);
  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [accessError, setAccessError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      if (state.user) {
        try {
          setAccessError(null);
          const [k, a, inv] = await Promise.all([
            api.finance.getKPIs(state.user),
            api.finance.getAPAging(state.user),
            api.finance.getInvoices(state.user),
          ]);
          setKpis(k);
          setAging(a);
          setInvoices(inv);
        } catch (e: unknown) {
          setAccessError(e instanceof Error ? e.message : "Access denied");
        } finally {
          setLoading(false);
        }
      }
    }
    load();
  }, [state.user]);

  if (loading) {
    return <DashboardLoading titleWidthClassName="w-1/3" />;
  }

  if (accessError) {
    return <DashboardError title="Finance Hub" message={accessError} />;
  }

  if (!kpis) {
    return <DashboardEmpty title="Finance Hub" message="No dashboard data available." />;
  }

  return (
    <div className="p-8 space-y-8 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-[var(--text-primary)] tracking-tighter uppercase">Finance Hub</h1>
          <p className="text-[var(--text-secondary)] font-medium">Treasury and accounts payable oversight</p>
        </div>
        <div className="flex items-center gap-3">
          <Button asChild variant="outline" size="sm">
            <Link href="/finance/reports">
              <PieChart className="w-4 h-4 mr-2" /> P&L Statement
            </Link>
          </Button>
          <Button asChild size="sm">
            <Link href="/finance/ap-aging">
              <DollarSign className="w-4 h-4 mr-2" /> AP Aging View
            </Link>
          </Button>
        </div>
      </div>

      {/* Metrics */}
      <KpiGrid>
        <KpiCard title="Total Payables" value={`UGX ${kpis.totalPayables.toLocaleString()}`} icon={Wallet} subtitle="Outstanding" tone="warn" />
        <KpiCard title="Overdue Invoices" value={kpis.overdueInvoices} icon={Clock} subtitle="High priority" tone={kpis.overdueInvoices > 0 ? "danger" : "good"} />
        <KpiCard title="Net Cashflow" value={`UGX ${kpis.netCashflow.toLocaleString()}`} icon={BarChart3} subtitle={kpis.netCashflow >= 0 ? "Positive" : "Negative"} tone={kpis.netCashflow >= 0 ? "good" : "warn"} />
        <KpiCard title="Total Expenses" value={`UGX ${kpis.totalExpenses.toLocaleString()}`} icon={DollarSign} subtitle="All locations" tone="default" />
      </KpiGrid>

      <AiInsightsPanel />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* AP Aging */}
        <Card title="AP Aging Analysis" className="lg:col-span-2">
          <div className="mt-6">
            <APAgingChart data={aging} />
          </div>
        </Card>

        {/* Allocation */}
        <Card title="Liability Distribution">
          <LiabilityPieChart data={aging} />
        </Card>
      </div>

      {/* Recent Invoices */}
      <Card title="Active Vendor Invoices" noPadding>
        <DataTable
          data={invoices}
          columns={[
            { header: "Invoice ID", accessor: "id", className: "font-mono font-bold" },
            { header: "Vendor Name", accessor: "vendorName", className: "font-black text-[var(--text-primary)]" },
            {
              header: "Amount",
              accessor: (i: InvoiceRow) => `UGX ${i.amount.toLocaleString()}`,
              className: "font-black text-[var(--text-secondary)]"
            },
            { header: "Status", accessor: (i: InvoiceRow) => <StatusBadge label={i.status} tone={i.status === "PAID" ? "good" : "warn"} /> },
            { header: "Due Date", accessor: "dueDate", className: "text-[var(--text-muted)]" },
            {
              header: "Overdue",
              accessor: (i: InvoiceRow) => i.daysOverdue > 0 ? (
                <span className="text-rose-300 font-black text-xs">{i.daysOverdue}d</span>
              ) : (
                <span className="text-emerald-300 font-bold text-xs">Current</span>
              )
            }
          ]}
          emptyMessage="No invoices found"
        />
      </Card>
    </div>
  );
}
