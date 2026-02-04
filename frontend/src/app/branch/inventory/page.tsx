"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

import { GlobalFilterBar } from "@/components/core/GlobalFilterBar";
import { PaginatedDataTable } from "@/components/core/PaginatedDataTable";
import { useAuth } from "@/contexts/AuthContext";
import { getApiClient } from "@/lib/api/client";
import type { DashboardFilters, InventoryMovementsDTO, InventoryStockDTO } from "@/lib/api/types";

export default function BranchInventoryPage() {
  const { state } = useAuth();
  const branchName = state.allowedLocations?.[0] ?? "Your Branch";
  const searchParams = useSearchParams();
  const statusFilter = searchParams.get("status");

  const api = useMemo(() => getApiClient(), []);
  const [loading, setLoading] = useState(false);
  const [stock, setStock] = useState<InventoryStockDTO | null>(null);
  const [movements, setMovements] = useState<InventoryMovementsDTO | null>(null);

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
        const [s, m] = await Promise.all([
          api.inventoryDashboard.getStock(filters),
          api.inventoryDashboard.getMovements(filters),
        ]);
        if (cancelled) return;
        setStock(s);
        setMovements(m);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    run();
    return () => {
      cancelled = true;
    };
  }, [api, filters]);

  const [selectedItem, setSelectedItem] = useState<InventoryStockDTO["rows"][number] | null>(null);

  const filteredStockRows = useMemo(() => {
    const rows = stock?.rows ?? [];
    if (!statusFilter) return rows;
    return rows.filter((r) => r.status.toLowerCase() === statusFilter.toLowerCase());
  }, [statusFilter, stock?.rows]);

  return (
    <div>
      <GlobalFilterBar filters={filters} locations={[branchName]} onChange={setFilters} hideLocation />

      <div className="flex items-start justify-between gap-6">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900">Inventory</h1>
          <div className="mt-1 text-sm text-zinc-600">{branchName}</div>
        </div>
        {loading ? <div className="text-xs text-zinc-500">Refreshing…</div> : null}
      </div>

      <section className="mt-6 grid gap-4 lg:grid-cols-3">
        <PaginatedDataTable
          title="Stock (On-hand)"
          rows={filteredStockRows}
          columns={[
            { key: "item", header: "Item", render: (r) => r.item },
            { key: "category", header: "Category", render: (r) => r.category },
            { key: "onHand", header: "On Hand", render: (r) => r.onHand, className: "text-right" },
            { key: "available", header: "Available", render: (r) => r.available, className: "text-right" },
            { key: "value", header: "Value", render: (r) => r.valueDisplay, className: "text-right" },
            {
              key: "status",
              header: "Status",
              render: (r) => (
                <button
                  type="button"
                  className="rounded-md border border-zinc-200 bg-white px-2 py-1 text-xs text-zinc-700 hover:bg-zinc-50"
                  onClick={() => setSelectedItem(r)}
                >
                  {r.status}
                </button>
              ),
            },
          ]}
          pageSize={8}
        />

        <PaginatedDataTable
          title="Recent Movements"
          rows={movements?.rows ?? []}
          columns={[
            { key: "date", header: "Date", render: (r) => r.date },
            { key: "item", header: "Item", render: (r) => r.item },
            { key: "movementType", header: "Type", render: (r) => r.movementType },
            { key: "quantity", header: "Qty", render: (r) => r.quantity, className: "text-right" },
            { key: "source", header: "Source", render: (r) => r.sourceDocument },
          ]}
          pageSize={8}
        />

        <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
          <div className="text-sm font-semibold text-zinc-900">Item Details</div>
          {selectedItem ? (
            <div className="mt-3 space-y-2 text-sm text-zinc-700">
              <div>
                <div className="text-xs font-medium text-zinc-500">Item</div>
                <div className="font-medium text-zinc-900">{selectedItem.item}</div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="text-xs font-medium text-zinc-500">On Hand</div>
                  <div className="font-medium text-zinc-900">{selectedItem.onHand}</div>
                </div>
                <div>
                  <div className="text-xs font-medium text-zinc-500">Available</div>
                  <div className="font-medium text-zinc-900">{selectedItem.available}</div>
                </div>
              </div>
              <div>
                <div className="text-xs font-medium text-zinc-500">Status</div>
                <div className="font-medium text-zinc-900">{selectedItem.status}</div>
              </div>

              <div className="pt-2">
                <div className="text-xs font-medium text-zinc-500">Allocate / Action</div>
                <div className="mt-2 grid gap-2">
                  <input
                    type="number"
                    min={0}
                    className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-zinc-400"
                    placeholder="Quantity"
                  />
                  <button
                    type="button"
                    className="w-full rounded-lg bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-800"
                  >
                    Allocate
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="mt-3 text-sm text-zinc-500">Select an item status to view details.</div>
          )}
        </div>
      </section>
    </div>
  );
}
