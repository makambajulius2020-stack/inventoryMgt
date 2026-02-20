"use client";

import React, { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import {
  DollarSign,
  BarChart3,
  PieChart,
  Wallet,
  Clock,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { DataTable } from "@/components/ui/DataTable";
import { StatusBadge } from "@/components/core/StatusBadge";
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

  useEffect(() => {
    async function load() {
      if (state.user) {
        try {
          const [k, a, inv] = await Promise.all([
            api.finance.getKPIs(state.user),
            api.finance.getAPAging(state.user),
            api.finance.getInvoices(state.user),
          ]);
          setKpis(k);
          setAging(a);
          setInvoices(inv);
        } finally {
          setLoading(false);
        }
      }
    }
    load();
  }, [state.user]);

  if (loading || !kpis) {
    return <div className="p-8 animate-pulse space-y-8">
      <div className="h-12 w-48 bg-slate-200 dark:bg-slate-800 rounded-xl" />
      <div className="grid grid-cols-4 gap-6">
        {[1, 2, 3, 4].map(i => <div key={i} className="h-32 bg-slate-200 dark:bg-slate-800 rounded-3xl" />)}
      </div>
    </div>;
  }

  return (
    <div className="p-8 space-y-8 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-[#001F3F] dark:text-white tracking-tighter uppercase">Finance Hub</h1>
          <p className="text-slate-500 font-medium">Treasury and accounts payable oversight</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm">
            <PieChart className="w-4 h-4 mr-2" /> P&L Statement
          </Button>
          <Button size="sm">
            <DollarSign className="w-4 h-4 mr-2" /> New Payment
          </Button>
        </div>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <FinanceKpiCard label="Total Payables" value={`UGX ${kpis.totalPayables.toLocaleString()}`} icon={Wallet} trend="Outstanding" />
        <FinanceKpiCard label="Overdue Invoices" value={kpis.overdueInvoices} icon={Clock} trend="High Priority" isAlert />
        <FinanceKpiCard label="Net Cashflow" value={`UGX ${kpis.netCashflow.toLocaleString()}`} icon={BarChart3} trend={kpis.netCashflow >= 0 ? "Positive" : "Negative"} />
        <FinanceKpiCard label="Total Expenses" value={`UGX ${kpis.totalExpenses.toLocaleString()}`} icon={DollarSign} trend="All Locations" />
      </div>

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
            { header: "Vendor Name", accessor: "vendorName", className: "font-black text-[#001F3F] dark:text-white" },
            {
              header: "Amount",
              accessor: (i: InvoiceRow) => `UGX ${i.amount.toLocaleString()}`,
              className: "font-black text-slate-700 dark:text-slate-300"
            },
            { header: "Status", accessor: (i: InvoiceRow) => <StatusBadge label={i.status} tone={i.status === "PAID" ? "good" : "warn"} /> },
            { header: "Due Date", accessor: "dueDate", className: "text-slate-500" },
            {
              header: "Overdue",
              accessor: (i: InvoiceRow) => i.daysOverdue > 0 ? (
                <span className="text-rose-600 font-black text-xs">{i.daysOverdue}d</span>
              ) : (
                <span className="text-emerald-600 font-bold text-xs">Current</span>
              )
            }
          ]}
        />
      </Card>
    </div>
  );
}

function FinanceKpiCard({ label, value, icon: Icon, trend, isAlert }: { label: string; value: string | number; icon: React.ComponentType<{ className?: string }>; trend: string; isAlert?: boolean }) {
  return (
    <Card className="ring-1 ring-slate-100 dark:ring-white/10 hover:shadow-lg transition-all">
      <div className="flex justify-between items-start mb-4">
        <div className="p-3 bg-slate-50 dark:bg-white/5 rounded-2xl">
          <Icon className="w-5 h-5 text-[#001F3F] dark:text-teal-400" />
        </div>
        <div className={cn(
          "px-2 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-wider",
          isAlert ? "bg-rose-50 text-rose-600" : "bg-teal-50 text-teal-600"
        )}>
          {trend}
        </div>
      </div>
      <div>
        <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-1">{label}</p>
        <p className="text-2xl font-black text-[#001F3F] dark:text-white tracking-tighter">{value}</p>
      </div>
    </Card>
  );
}

