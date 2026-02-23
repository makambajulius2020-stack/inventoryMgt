"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  ShoppingCart,
  Users,
  Package,
  PlusCircle,
  TrendingUp,
  FileCheck
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
import type { ProcurementKPIs, RequisitionRow, VendorRow } from "@/lib/api/services/procurement.service";

export default function ProcurementDashboard() {
  const { state } = useAuth();
  const [kpis, setKpis] = useState<ProcurementKPIs | null>(null);
  const [reqs, setReqs] = useState<RequisitionRow[]>([]);
  const [vendors, setVendors] = useState<VendorRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [accessError, setAccessError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      if (state.user) {
        try {
          setAccessError(null);
          const [k, r, v] = await Promise.all([
            api.procurement.getKPIs(state.user),
            api.procurement.getRequisitions(state.user),
            api.procurement.getVendors(),
          ]);
          setKpis(k);
          setReqs(r);
          setVendors(v);
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
    return <DashboardError title="Procurement Hub" message={accessError} />;
  }

  if (!kpis) {
    return <DashboardEmpty title="Procurement Hub" message="No dashboard data available." />;
  }

  return (
    <div className="p-8 space-y-8 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-[var(--text-primary)] tracking-tighter uppercase">Procurement Hub</h1>
          <p className="text-[var(--text-secondary)] font-medium">Supply chain and vendor lifecycle management</p>
        </div>
        <div className="flex items-center gap-3">
          <Button asChild variant="outline" size="sm">
            <Link href="/procurement/vendors">
              <Users className="w-4 h-4 mr-2" /> Manage Vendors
            </Link>
          </Button>
          <Button asChild size="sm">
            <Link href="/procurement/requisitions">
              <PlusCircle className="w-4 h-4 mr-2" /> Fulfillment Queue
            </Link>
          </Button>
        </div>
      </div>

      {/* Metrics */}
      <KpiGrid>
        <KpiCard title="Active Requests" value={kpis.activeRequisitions} icon={ShoppingCart} subtitle="Open demand" tone={kpis.activeRequisitions > 0 ? "warn" : "good"} />
        <KpiCard title="Open LPOs" value={kpis.openLPOs} icon={FileCheck} subtitle="Issued" tone={kpis.openLPOs > 0 ? "accent" : "default"} />
        <KpiCard title="Awaiting GRN" value={kpis.pendingGRNs} icon={Package} subtitle="Pending receipt" tone={kpis.pendingGRNs > 0 ? "warn" : "good"} />
        <KpiCard title="Strategic Vendors" value={kpis.vendorCount} icon={Users} subtitle="Active registry" tone="default" />
      </KpiGrid>

      <AiInsightsPanel />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Requisition Flow */}
        <Card title="Pending Fulfillment" className="lg:col-span-2" noPadding>
          <DataTable
            data={reqs}
            columns={[
              { header: "REQ ID", accessor: "id", className: "font-mono font-bold" },
              { header: "Dept", accessor: "departmentName", className: "font-bold text-[var(--accent-hover)]" },
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
            emptyMessage="No requisitions found"
          />
        </Card>

        {/* Vendor Scoring */}
        <Card title="Vendor Performance" subtitle="Based on rating and item coverage">
          <div className="space-y-6 mt-6">
            {vendors.slice(0, 5).map(v => (
              <div key={v.id} className="space-y-2">
                <div className="flex justify-between items-center text-xs font-black uppercase tracking-widest">
                  <span className="text-[var(--text-muted)]">{v.name}</span>
                  <span className="text-[var(--accent-hover)]">{(v.rating * 20).toFixed(0)}%</span>
                </div>
                <div className="h-2 bg-white/5 border border-white/5 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-[var(--accent)] to-[var(--accent-hover)] rounded-full transition-all duration-1000"
                    style={{ width: `${v.rating * 20}%` }}
                  />
                </div>
              </div>
            ))}
            <div className="pt-4 border-t border-white/10">
              <div className="flex items-center gap-2 text-[var(--accent-hover)]">
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
