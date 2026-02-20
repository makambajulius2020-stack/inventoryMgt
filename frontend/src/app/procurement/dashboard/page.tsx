"use client";

import React, { useEffect, useState } from "react";
import {
  ShoppingCart,
  Users,
  Package,
  PlusCircle,
  TrendingUp,
  FileCheck
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { DataTable } from "@/components/ui/DataTable";
import { StatusBadge } from "@/components/core/StatusBadge";
import { api } from "@/lib/api/client";
import { useAuth } from "@/contexts/AuthContext";
import type { ProcurementKPIs, RequisitionRow, VendorRow } from "@/lib/api/services/procurement.service";

export default function ProcurementDashboard() {
  const { state } = useAuth();
  const [kpis, setKpis] = useState<ProcurementKPIs | null>(null);
  const [reqs, setReqs] = useState<RequisitionRow[]>([]);
  const [vendors, setVendors] = useState<VendorRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      if (state.user) {
        try {
          const [k, r, v] = await Promise.all([
            api.procurement.getKPIs(state.user),
            api.procurement.getRequisitions(state.user),
            api.procurement.getVendors(),
          ]);
          setKpis(k);
          setReqs(r);
          setVendors(v);
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
          <h1 className="text-3xl font-black text-[#001F3F] dark:text-white tracking-tighter uppercase">Procurement Hub</h1>
          <p className="text-slate-500 font-medium">Supply chain and vendor lifecycle management</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm">
            <Users className="w-4 h-4 mr-2" /> Manage Vendors
          </Button>
          <Button size="sm">
            <PlusCircle className="w-4 h-4 mr-2" /> Release LPO
          </Button>
        </div>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <ProcMetric label="Active Requests" value={kpis.activeRequisitions} icon={ShoppingCart} tone="info" />
        <ProcMetric label="Open LPOs" value={kpis.openLPOs} icon={FileCheck} tone="good" />
        <ProcMetric label="Awaiting GRN" value={kpis.pendingGRNs} icon={Package} tone="warn" />
        <ProcMetric label="Strategic Vendors" value={kpis.vendorCount} icon={Users} tone="primary" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Requisition Flow */}
        <Card title="Pending Fulfillment" className="lg:col-span-2" noPadding>
          <DataTable
            data={reqs}
            columns={[
              { header: "REQ ID", accessor: "id", className: "font-mono font-bold" },
              { header: "Dept", accessor: "departmentName", className: "font-bold text-[#001F3F] dark:text-teal-400" },
              {
                header: "Value",
                accessor: (r: RequisitionRow) => `UGX ${r.totalAmount.toLocaleString()}`,
                className: "font-black"
              },
              { header: "Status", accessor: (r: RequisitionRow) => <StatusBadge label={r.status} tone={r.status === "SUBMITTED" ? "warn" : "good"} /> },
              {
                header: "Items",
                accessor: (r: RequisitionRow) => (
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold">{r.itemCount} SKUs</span>
                  </div>
                )
              }
            ]}
          />
        </Card>

        {/* Vendor Scoring */}
        <Card title="Vendor Performance" subtitle="Based on rating and item coverage">
          <div className="space-y-6 mt-6">
            {vendors.slice(0, 5).map(v => (
              <div key={v.id} className="space-y-2">
                <div className="flex justify-between items-center text-xs font-black uppercase tracking-widest">
                  <span className="text-slate-500">{v.name}</span>
                  <span className="text-teal-600">{(v.rating * 20).toFixed(0)}%</span>
                </div>
                <div className="h-2 bg-slate-100 dark:bg-white/5 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#001F3F] dark:bg-teal-500 rounded-full transition-all duration-1000"
                    style={{ width: `${v.rating * 20}%` }}
                  />
                </div>
              </div>
            ))}
            <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2 text-[#001F3F] dark:text-teal-400">
                <TrendingUp className="w-4 h-4" />
                <span className="text-[10px] font-black uppercase tracking-widest">{vendors.length} Active Vendors</span>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}

function ProcMetric({ label, value, icon: Icon, tone }: { label: string; value: number | string; icon: React.ComponentType<{ className?: string }>; tone: "info" | "good" | "warn" | "primary" }) {
  const tones = {
    info: "bg-sky-50 text-sky-600 border-sky-100",
    good: "bg-emerald-50 text-emerald-600 border-emerald-100",
    warn: "bg-amber-50 text-amber-600 border-amber-100",
    primary: "bg-slate-50 text-[#001F3F] border-slate-200",
  };

  return (
    <Card className="hover:shadow-md transition-all">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{label}</p>
          <p className="text-3xl font-black text-[#001F3F] dark:text-white tracking-tighter">{value}</p>
        </div>
        <div className={cn("p-2.5 rounded-2xl border", tones[tone as keyof typeof tones])}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
    </Card>
  );
}
