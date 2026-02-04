"use client";

import { useEffect, useMemo, useState } from "react";

import { GlobalFilterBar } from "@/components/core/GlobalFilterBar";
import { PaginatedDataTable } from "@/components/core/PaginatedDataTable";
import { useAuth } from "@/contexts/AuthContext";
import { getApiClient } from "@/lib/api/client";
import type { DashboardFilters, InventoryMonthEndSnapshotsDTO } from "@/lib/api/types";

export default function BranchReportsPage() {
  const { state } = useAuth();
  const branchName = state.allowedLocations?.[0] ?? "Your Branch";

  const api = useMemo(() => getApiClient(), []);
  const [loading, setLoading] = useState(false);
  const [snapshots, setSnapshots] = useState<InventoryMonthEndSnapshotsDTO | null>(null);

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
        const s = await api.inventoryDashboard.getMonthEndSnapshots(filters);
        if (cancelled) return;
        setSnapshots(s);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    run();
    return () => {
      cancelled = true;
    };
  }, [api, filters]);

  return (
    <div>
      <GlobalFilterBar filters={filters} locations={[branchName]} onChange={setFilters} hideLocation />

      <div className="flex items-start justify-between gap-6">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900">Reports</h1>
          <div className="mt-1 text-sm text-zinc-600">{branchName}</div>
        </div>
        {loading ? <div className="text-xs text-zinc-500">Refreshing…</div> : null}
      </div>

      <section className="mt-6">
        <PaginatedDataTable
          title={`Inventory Month-End Snapshot (${snapshots?.month ?? "—"})`}
          rows={snapshots?.rows ?? []}
          columns={[
            { key: "item", header: "Item", render: (r) => r.item },
            { key: "opening", header: "Opening", render: (r) => r.opening, className: "text-right" },
            { key: "received", header: "Received", render: (r) => r.received, className: "text-right" },
            { key: "issued", header: "Issued", render: (r) => r.issued, className: "text-right" },
            { key: "closing", header: "System Closing", render: (r) => r.systemClosing, className: "text-right" },
            { key: "physical", header: "Physical", render: (r) => (r.physicalCount ?? "—") as any, className: "text-right" },
            { key: "variance", header: "Variance", render: (r) => (r.variance ?? "—") as any, className: "text-right" },
          ]}
          pageSize={10}
        />
      </section>
    </div>
  );
}
