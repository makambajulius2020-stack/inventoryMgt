"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  Package,
  BarChart3,
  ArrowRightLeft,
  AlertTriangle,
  MoveRight,
  History
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { DataTable } from "@/components/ui/DataTable";
import { KpiCard, KpiGrid } from "@/components/dashboard/KpiCard";
import { DashboardEmpty, DashboardError, DashboardLoading } from "@/components/dashboard/DashboardStates";
import { AiInsightsPanel } from "@/components/dashboard/AiInsightsPanel";
import { api } from "@/lib/api/client";
import { useAuth } from "@/contexts/AuthContext";
import type { StockLevelRow, StockMovementRow, InventoryKPIs } from "@/lib/api/services/inventory.service";

export default function InventoryDashboard() {
  const { state } = useAuth();
  const [stock, setStock] = useState<StockLevelRow[]>([]);
  const [kpis, setKpis] = useState<InventoryKPIs | null>(null);
  const [movements, setMovements] = useState<StockMovementRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [accessError, setAccessError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      if (state.user) {
        try {
          setAccessError(null);
          const [s, k, m] = await Promise.all([
            api.inventory.getLocationStock(state.user),
            api.inventory.getKPIs(state.user),
            api.inventory.getMovementHistory(state.user),
          ]);
          setStock(s);
          setKpis(k);
          setMovements(m);
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
    return <DashboardError title="Inventory Command" message={accessError} />;
  }

  if (!kpis) {
    return <DashboardEmpty title="Inventory Command" message="No dashboard data available." />;
  }

  return (
    <div className="p-8 space-y-8 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-[var(--text-primary)] tracking-tighter uppercase">Inventory Command</h1>
          <p className="text-[var(--text-secondary)] font-medium">Real-time stock valuation and logistics monitoring</p>
        </div>
        <div className="flex items-center gap-3">
          <Button asChild variant="outline" size="sm">
            <Link href="/inventory/stock">
              <ArrowRightLeft className="w-4 h-4 mr-2" /> Stock Register
            </Link>
          </Button>
          <Button asChild size="sm">
            <Link href="/inventory/movements">
              <Package className="w-4 h-4 mr-2" /> Movement Ledger
            </Link>
          </Button>
        </div>
      </div>

      {/* Stats */}
      <KpiGrid>
        <KpiCard title="Total Valuation" value={`UGX ${(kpis.totalValue / 1000000).toFixed(1)}M`} icon={BarChart3} subtitle={`${kpis.totalItems} SKUs`} tone="accent" />
        <KpiCard title="Critical Alerts" value={kpis.outOfStockCount} icon={AlertTriangle} subtitle="Immediate action" tone={kpis.outOfStockCount > 0 ? "danger" : "good"} />
        <KpiCard title="Low Stock" value={kpis.lowStockCount} icon={ArrowRightLeft} subtitle="Needs reorder" tone={kpis.lowStockCount > 0 ? "warn" : "good"} />
        <KpiCard title="Healthy Items" value={kpis.totalItems - kpis.lowStockCount - kpis.outOfStockCount} icon={History} subtitle="In range" tone="good" />
      </KpiGrid>

      <AiInsightsPanel />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Inventory Register */}
        <Card title="Operational Stock Registry" className="lg:col-span-2" noPadding>
          <DataTable
            data={stock}
            columns={[
              { header: "SKU", accessor: "sku", className: "font-mono text-xs" },
              { header: "Item Name", accessor: "itemName", className: "font-black text-[var(--text-primary)]" },
              {
                header: "Stock Level",
                accessor: (i: StockLevelRow) => (
                  <div className="flex items-center gap-2">
                    <span className="font-black">{i.available}</span>
                    <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase">{i.uom}</span>
                  </div>
                )
              },
              {
                header: "Integrity",
                accessor: (i: StockLevelRow) => (
                  <span className={cn(
                    "px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-widest",
                    i.status === "HEALTHY" ? "bg-emerald-500/10 text-emerald-300 border border-emerald-500/20" :
                      i.status === "LOW" ? "bg-amber-500/10 text-amber-300 border border-amber-500/20" : "bg-rose-500/10 text-rose-300 border border-rose-500/20 animate-pulse"
                  )}>
                    {i.status}
                  </span>
                )
              },
              {
                header: "Value",
                accessor: (i: StockLevelRow) => <span className="font-bold">UGX {i.totalValue.toLocaleString()}</span>
              }
            ]}
            emptyMessage="No stock records found"
          />
        </Card>

        {/* Movements */}
        <Card title="Recent Logistics" subtitle="Live ledger stream of stock entries/exits">
          <div className="space-y-4 mt-4">
            {movements.slice(0, 8).map((move, idx) => (
              <div key={idx} className="flex items-center gap-4 p-4 border border-white/10 bg-white/5 rounded-2xl hover:bg-white/10 transition-all">
                <div className={cn(
                  "p-2 rounded-xl",
                  move.type === "PURCHASE_RECEIPT" || move.type === "TRANSFER_IN" || move.type === "OPENING_BALANCE" ? "bg-emerald-500/10 text-emerald-300 border border-emerald-500/20" :
                    move.type === "TRANSFER_OUT" || move.type === "DEPARTMENT_ISSUE" ? "bg-sky-500/10 text-sky-300 border border-sky-500/20" : "bg-amber-500/10 text-amber-300 border border-amber-500/20"
                )}>
                  <MoveRight className={cn(
                    "w-4 h-4",
                    move.type === "TRANSFER_OUT" || move.type === "DEPARTMENT_ISSUE" ? "rotate-0" :
                      move.type === "PURCHASE_RECEIPT" || move.type === "TRANSFER_IN" || move.type === "OPENING_BALANCE" ? "rotate-180" : "rotate-90"
                  )} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-[var(--text-primary)] truncate">{move.itemName}</p>
                  <p className="text-[10px] font-bold text-[var(--text-muted)] uppercase">{move.type} — {move.performedByName}</p>
                </div>
                <div className="text-right">
                  <p className={cn("text-xs font-black", move.quantity > 0 ? "text-emerald-500" : "text-rose-500")}>
                    {move.quantity > 0 ? "+" : ""}{move.quantity}
                  </p>
                  <p className="text-[10px] font-bold text-[var(--text-muted)] uppercase">{new Date(move.createdAt).toLocaleDateString()}</p>
                </div>
              </div>
            ))}
            <Button asChild variant="ghost" className="w-full text-[10px] font-black uppercase text-[var(--text-muted)] mt-2">
              <Link href="/inventory/movements">Open Comprehensive Ledger</Link>
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
