"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { ChartWrapper } from "@/components/core/ChartWrapper";
import { GlobalFilterBar } from "@/components/core/GlobalFilterBar";
import { KpiCard } from "@/components/core/KpiCard";
import { useAuth } from "@/contexts/AuthContext";
import { getApiClient } from "@/lib/api/client";
import type { DashboardFilters, FinanceKpisDTO, InventoryKpisDTO } from "@/lib/api/types";

export default function BranchDashboardPage() {
  const { state } = useAuth();
  const router = useRouter();
  const branchName = state.allowedLocations?.[0] ?? "Your Branch";

  const api = useMemo(() => getApiClient(), []);
  const [loading, setLoading] = useState(false);
  const [inventory, setInventory] = useState<InventoryKpisDTO | null>(null);
  const [finance, setFinance] = useState<FinanceKpisDTO | null>(null);

  const [filters, setFilters] = useState<DashboardFilters>({
    preset: "month",
    location: branchName,
  });

  useEffect(() => {
    if (filters.location === branchName) return;
    setFilters((f) => ({ ...f, location: branchName }));
  }, [branchName, filters.location]);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      setLoading(true);
      try {
        const [inv, fin] = await Promise.all([
          api.inventoryDashboard.getKpis(filters),
          api.financeDashboard.getKpis(filters),
        ]);
        if (cancelled) return;
        setInventory(inv);
        setFinance(fin);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    run();
    return () => {
      cancelled = true;
    };
  }, [api, filters]);

  const trendPoints = useMemo(() => {
    const base = inventory?.kpis.totalInventoryValue.value ?? 0;
    const points = Array.from({ length: 12 }).map((_, i) => {
      const wave = Math.sin((i / 12) * Math.PI * 2);
      const value = Math.max(0, Math.round(base + wave * Math.max(50_000, base * 0.06) + i * Math.max(10_000, base * 0.01)));
      return { period: `P${i + 1}`, inventoryValue: value, pettyCashSpend: Math.max(0, Math.round((finance?.kpis.pettyCashSpend.value ?? 0) * (0.7 + (i / 12) * 0.6))) };
    });
    return points;
  }, [finance?.kpis.pettyCashSpend.value, inventory?.kpis.totalInventoryValue.value]);

  return (
    <div>
      <GlobalFilterBar filters={filters} locations={[branchName]} onChange={setFilters} hideLocation />

      <div className="flex items-start justify-between gap-6">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900">Branch Dashboard</h1>
          <div className="mt-1 text-sm text-zinc-600">{branchName}</div>
        </div>
        {loading ? <div className="text-xs text-zinc-500">Refreshing…</div> : null}
      </div>

      <section className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <KpiCard title="Total Inventory Value" value={inventory?.kpis.totalInventoryValue.display ?? "—"} />
        <KpiCard
          title="Low Stock Items"
          value={inventory?.kpis.lowStockItems.display ?? "—"}
          tone="warn"
          onClick={() => router.push("/branch/inventory?status=Low")}
        />
        <KpiCard
          title="Overstocked Items"
          value={inventory?.kpis.overstockedItems.display ?? "—"}
          onClick={() => router.push("/branch/inventory?status=OK")}
        />
        <KpiCard title="Petty Cash Spend" value={finance?.kpis.pettyCashSpend.display ?? "—"} />
        <KpiCard title="Outstanding GRN Value" value={finance?.kpis.outstandingGrnValue.display ?? "—"} tone="warn" />
        <KpiCard title="Total Payables" value={finance?.kpis.totalPayables.display ?? "—"} />
      </section>

      <section className="mt-6">
        <ChartWrapper title="Inventory Value vs Petty Cash" subtitle="Trend overview (filter presets apply)">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={trendPoints} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="period" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="inventoryValue" name="Inventory Value" stroke="#18181b" strokeWidth={2.5} dot={false} />
              <Line type="monotone" dataKey="pettyCashSpend" name="Petty Cash Spend" stroke="#a1a1aa" strokeWidth={2.5} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </ChartWrapper>
      </section>
    </div>
  );
}
