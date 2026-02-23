"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ShieldCheck, ShoppingCart, Package, ArrowRight } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { KpiCard, KpiGrid } from "@/components/dashboard/KpiCard";
import { DashboardEmpty, DashboardError, DashboardLoading } from "@/components/dashboard/DashboardStates";
import { api } from "@/lib/api/client";
import { useAuth } from "@/contexts/AuthContext";

export default function StoreControllerDashboard() {
  const { state } = useAuth();
  const [loading, setLoading] = useState(true);
  const [accessError, setAccessError] = useState<string | null>(null);

  const [inventoryKpis, setInventoryKpis] = useState<{ totalValue: number; lowStockCount: number } | null>(null);
  const [openLpos, setOpenLpos] = useState<number>(0);
  const [pendingGrns, setPendingGrns] = useState<number>(0);

  useEffect(() => {
    async function load() {
      if (!state.user) return;
      try {
        setLoading(true);
        setAccessError(null);

        const [invKpis, lpos, grns] = await Promise.all([
          api.inventory.getKPIs(state.user),
          api.procurement.getLPOs(state.user),
          api.procurement.getGRNs(state.user),
        ]);

        setInventoryKpis({ totalValue: invKpis.totalValue, lowStockCount: invKpis.lowStockCount });
        setOpenLpos(lpos.filter((l) => l.status !== "CLOSED" && l.status !== "CANCELLED").length);
        setPendingGrns(grns.filter((g) => g.status !== "RECEIVED" && g.status !== "REJECTED").length);
      } catch (e: unknown) {
        setAccessError(e instanceof Error ? e.message : "Access denied");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [state.user]);

  const kpiTotalStock = inventoryKpis?.totalValue ?? 0;
  const kpiLowStock = inventoryKpis?.lowStockCount ?? 0;

  const locationLabel = useMemo(() => {
    if (state.user?.scope.allLocations) return "All Locations";
    return "Location Scoped";
  }, [state.user?.scope.allLocations]);

  if (loading) return <DashboardLoading titleWidthClassName="w-1/3" />;
  if (accessError) return <DashboardError title="Store Controller" message={accessError} />;
  if (!inventoryKpis) return <DashboardEmpty title="Store Controller" message="No oversight data available." />;

  return (
    <div className="p-8 space-y-8 max-w-[1600px] mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-[var(--text-primary)] tracking-tighter uppercase">Store Controller</h1>
          <p className="text-[var(--text-secondary)] font-medium">{locationLabel}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href="/store-controller/inventory-integrity">Inventory Integrity</Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href="/store-controller/procurement-flow">Procurement Flow</Link>
          </Button>
          <Button asChild size="sm">
            <Link href="/store-controller/department-stock">Department Stock</Link>
          </Button>
        </div>
      </div>

      <KpiGrid>
        <KpiCard title="Total Stock Value" value={`UGX ${kpiTotalStock.toLocaleString()}`} icon={Package} subtitle="Location inventory valuation" tone="accent" />
        <KpiCard title="Low Stock Alerts" value={kpiLowStock} icon={ShieldCheck} subtitle="Reorder integrity" tone={kpiLowStock > 0 ? "warn" : "good"} />
        <KpiCard title="Open LPOs" value={openLpos} icon={ShoppingCart} subtitle="Procurement pipeline" tone={openLpos > 0 ? "warn" : "good"} />
        <KpiCard title="Pending GRNs" value={pendingGrns} icon={ArrowRight} subtitle="Inbound verification" tone={pendingGrns > 0 ? "warn" : "good"} />
      </KpiGrid>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card title="Inventory Integrity" subtitle="Variance summary, monthly stock count, high movement" className="md:col-span-1">
          <Button asChild variant="ghost" className="w-full justify-between">
            <Link href="/store-controller/inventory-integrity">
              Open Inventory Integrity
              <ArrowRight className="w-4 h-4" />
            </Link>
          </Button>
        </Card>

        <Card title="Procurement Flow Monitoring" subtitle="LPO → GRN → Invoice status alignment" className="md:col-span-1">
          <Button asChild variant="ghost" className="w-full justify-between">
            <Link href="/store-controller/procurement-flow">
              Open Procurement Flow
              <ArrowRight className="w-4 h-4" />
            </Link>
          </Button>
        </Card>

        <Card title="Department Stock Overview" subtitle="Department stock value, variance, pending requests" className="md:col-span-1">
          <Button asChild variant="ghost" className="w-full justify-between">
            <Link href="/store-controller/department-stock">
              Open Department Stock
              <ArrowRight className="w-4 h-4" />
            </Link>
          </Button>
        </Card>
      </div>
    </div>
  );
}
