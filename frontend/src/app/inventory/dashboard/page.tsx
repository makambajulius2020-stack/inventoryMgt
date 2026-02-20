"use client";

import React, { useEffect, useState } from "react";
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
import { api } from "@/lib/api/client";
import { useAuth } from "@/contexts/AuthContext";
import type { StockLevelRow, StockMovementRow, InventoryKPIs } from "@/lib/api/services/inventory.service";

export default function InventoryDashboard() {
  const { state } = useAuth();
  const [stock, setStock] = useState<StockLevelRow[]>([]);
  const [kpis, setKpis] = useState<InventoryKPIs | null>(null);
  const [movements, setMovements] = useState<StockMovementRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      if (state.user) {
        try {
          const [s, k, m] = await Promise.all([
            api.inventory.getLocationStock(state.user),
            api.inventory.getKPIs(state.user),
            api.inventory.getMovementHistory(state.user),
          ]);
          setStock(s);
          setKpis(k);
          setMovements(m);
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
          <h1 className="text-3xl font-black text-[#001F3F] dark:text-white tracking-tighter uppercase">Inventory Command</h1>
          <p className="text-slate-500 font-medium">Real-time stock valuation and logistics monitoring</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm">
            <ArrowRightLeft className="w-4 h-4 mr-2" /> Stock Transfer
          </Button>
          <Button size="sm">
            <Package className="w-4 h-4 mr-2" /> Record Intake
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StoreKpi label="Total Valuation" value={`UGX ${(kpis.totalValue / 1000000).toFixed(1)}M`} icon={BarChart3} trend={`${kpis.totalItems} SKUs`} isPositive />
        <StoreKpi label="Critical Alerts" value={kpis.outOfStockCount} icon={AlertTriangle} trend="Immediate Action" isAlert />
        <StoreKpi label="Low Stock" value={kpis.lowStockCount} icon={ArrowRightLeft} trend="Needs Reorder" />
        <StoreKpi label="Healthy Items" value={kpis.totalItems - kpis.lowStockCount - kpis.outOfStockCount} icon={History} trend="In Range" isPositive />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Inventory Register */}
        <Card title="Operational Stock Registry" className="lg:col-span-2" noPadding>
          <DataTable
            data={stock}
            columns={[
              { header: "SKU", accessor: "sku", className: "font-mono text-xs" },
              { header: "Item Name", accessor: "itemName", className: "font-black text-[#001F3F] dark:text-white" },
              {
                header: "Stock Level",
                accessor: (i: StockLevelRow) => (
                  <div className="flex items-center gap-2">
                    <span className="font-black">{i.available}</span>
                    <span className="text-[10px] font-bold text-slate-400 uppercase">{i.uom}</span>
                  </div>
                )
              },
              {
                header: "Integrity",
                accessor: (i: StockLevelRow) => (
                  <span className={cn(
                    "px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-widest",
                    i.status === "HEALTHY" ? "bg-emerald-50 text-emerald-600" :
                      i.status === "LOW" ? "bg-amber-50 text-amber-600" : "bg-rose-50 text-rose-600 animate-pulse"
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
          />
        </Card>

        {/* Movements */}
        <Card title="Recent Logistics" subtitle="Live ledger stream of stock entries/exits">
          <div className="space-y-4 mt-4">
            {movements.slice(0, 8).map((move, idx) => (
              <div key={idx} className="flex items-center gap-4 p-4 border border-slate-100 dark:border-white/5 rounded-2xl hover:bg-slate-50 dark:hover:bg-white/5 transition-all">
                <div className={cn(
                  "p-2 rounded-xl",
                  move.type === "PURCHASE_RECEIPT" || move.type === "TRANSFER_IN" || move.type === "OPENING_BALANCE" ? "bg-emerald-100 text-emerald-600" :
                    move.type === "TRANSFER_OUT" || move.type === "DEPARTMENT_ISSUE" ? "bg-sky-100 text-sky-600" : "bg-amber-100 text-amber-600"
                )}>
                  <MoveRight className={cn(
                    "w-4 h-4",
                    move.type === "TRANSFER_OUT" || move.type === "DEPARTMENT_ISSUE" ? "rotate-0" :
                      move.type === "PURCHASE_RECEIPT" || move.type === "TRANSFER_IN" || move.type === "OPENING_BALANCE" ? "rotate-180" : "rotate-90"
                  )} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-[#001F3F] dark:text-white truncate">{move.itemName}</p>
                  <p className="text-[10px] font-bold text-slate-400 uppercase">{move.type} — {move.performedByName}</p>
                </div>
                <div className="text-right">
                  <p className={cn("text-xs font-black", move.quantity > 0 ? "text-emerald-500" : "text-rose-500")}>
                    {move.quantity > 0 ? "+" : ""}{move.quantity}
                  </p>
                  <p className="text-[10px] font-bold text-slate-400 uppercase">{new Date(move.createdAt).toLocaleDateString()}</p>
                </div>
              </div>
            ))}
            <Button variant="ghost" className="w-full text-[10px] font-black uppercase text-slate-400 mt-2">
              Open Comprehensive Ledger
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}

function StoreKpi({ label, value, icon: Icon, trend, isPositive, isAlert }: { label: string; value: string | number; icon: React.ComponentType<{ className?: string }>; trend: string; isPositive?: boolean; isAlert?: boolean }) {
  return (
    <Card className="hover:shadow-lg transition-all border-none ring-1 ring-slate-100 dark:ring-white/10">
      <div className="flex justify-between items-start mb-4">
        <div className="p-3 bg-slate-50 dark:bg-white/5 rounded-2xl">
          <Icon className="w-5 h-5 text-[#001F3F] dark:text-teal-400" />
        </div>
        <div className={cn(
          "px-2 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-widest",
          isAlert ? "bg-rose-50 text-rose-600" :
            isPositive ? "bg-emerald-50 text-emerald-600" : "bg-slate-50 text-slate-500"
        )}>
          {trend}
        </div>
      </div>
      <div>
        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">{label}</p>
        <p className="text-3xl font-black text-[#001F3F] dark:text-white tracking-tighter uppercase">{value}</p>
      </div>
    </Card>
  );
}
