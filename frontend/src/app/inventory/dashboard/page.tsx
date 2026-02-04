"use client";

import { useEffect, useMemo, useState } from "react";

import { GlobalFilterBar } from "@/components/core/GlobalFilterBar";
import { KpiCard } from "@/components/core/KpiCard";
import { PaginatedDataTable } from "@/components/core/PaginatedDataTable";
import { PortalSidebar } from "@/components/core/PortalSidebar";
import { RequireAuth } from "@/components/core/RequireAuth";
import { useAuth } from "@/contexts/AuthContext";
import { getApiClient } from "@/lib/api/client";
import type {
  DashboardFilters,
  InventoryMonthEndSnapshotRowDTO,
  InventoryMovementLedgerRowDTO,
} from "@/lib/api/types";

export default function InventoryDashboardPage() {
  const api = useMemo(() => getApiClient(), []);
  const { state } = useAuth();

  const initialLocation = state.allowedLocations?.[0] || "All Branches";

  const [filters, setFilters] = useState<DashboardFilters>({
    preset: "month",
    location: initialLocation,
  });

  const [loading, setLoading] = useState(false);
  const [kpis, setKpis] = useState<{
    totalInventoryValue: string;
    lowStockItems: string;
    overstockedItems: string;
    recentAdjustments: string;
    pettyCashReceiptsCount: string;
    pettyCashReceiptsValue: string;
  } | null>(null);

  const [snapshotRows, setSnapshotRows] = useState<InventoryMonthEndSnapshotRowDTO[]>([]);
  const [ledgerOpen, setLedgerOpen] = useState(false);
  const [ledger, setLedger] = useState<{
    branch: string;
    month: string;
    item: string;
    rows: InventoryMovementLedgerRowDTO[];
  } | null>(null);

  useEffect(() => {
    if (!state.allowedLocations?.length) return;
    if (filters.location) return;
    setFilters((f) => ({ ...f, location: state.allowedLocations[0] }));
  }, [state.allowedLocations, filters.location]);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      setLoading(true);
      try {
        const [k, snap] = await Promise.all([
          api.inventoryDashboard.getKpis(filters),
          api.inventoryDashboard.getMonthEndSnapshots(filters),
        ]);
        if (cancelled) return;

        setKpis({
          totalInventoryValue: k.kpis.totalInventoryValue.display,
          lowStockItems: k.kpis.lowStockItems.display,
          overstockedItems: k.kpis.overstockedItems.display,
          recentAdjustments: k.kpis.recentAdjustments.display,
          pettyCashReceiptsCount: k.kpis.pettyCashReceiptsCount.display,
          pettyCashReceiptsValue: k.kpis.pettyCashReceiptsValue.display,
        });
        setSnapshotRows(snap.rows);
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
    <RequireAuth>
      <div className="min-h-screen bg-zinc-50">
        <GlobalFilterBar
          filters={filters}
          locations={state.allowedLocations?.length ? state.allowedLocations : ["All Branches"]}
          onChange={setFilters}
        />

        <div className="mx-auto flex max-w-7xl">
          <PortalSidebar />

          <main className="w-full px-6 py-8">
            <div className="flex items-start justify-between gap-6">
              <div>
                <h1 className="text-2xl font-semibold text-zinc-900">Inventory (Super Admin View)</h1>
              </div>
              {loading ? <div className="text-xs text-zinc-500">Refreshing…</div> : null}
            </div>

            <section className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
              <KpiCard title="Total Inventory Value" value={kpis?.totalInventoryValue ?? "—"} />
              <KpiCard title="Low Stock Items" value={kpis?.lowStockItems ?? "—"} tone="warn" />
              <KpiCard title="Overstocked Items" value={kpis?.overstockedItems ?? "—"} />
              <KpiCard title="Recent Adjustments" value={kpis?.recentAdjustments ?? "—"} />
              <KpiCard title="Petty Cash Receipts (Count)" value={kpis?.pettyCashReceiptsCount ?? "—"} />
              <KpiCard title="Petty Cash Receipts (Value)" value={kpis?.pettyCashReceiptsValue ?? "—"} />
            </section>

            <section className="mt-6">
              <PaginatedDataTable
                title="Inventory Month-end Snapshots (Derived)"
                rows={snapshotRows}
                columns={[
                  { key: "branch", header: "Branch", render: (r) => r.branch },
                  { key: "month", header: "Month", render: (r) => r.month },
                  { key: "item", header: "Item", render: (r) => r.item },
                  { key: "opening", header: "Opening", render: (r) => r.opening, className: "text-right" },
                  { key: "received", header: "Received", render: (r) => r.received, className: "text-right" },
                  { key: "issued", header: "Issued", render: (r) => r.issued, className: "text-right" },
                  { key: "systemClosing", header: "System Closing", render: (r) => r.systemClosing, className: "text-right" },
                  {
                    key: "physicalCount",
                    header: "Physical Count",
                    render: (r) => (r.physicalCount === undefined ? "—" : r.physicalCount),
                    className: "text-right",
                  },
                  {
                    key: "variance",
                    header: "Variance",
                    render: (r) => (r.variance === undefined ? "—" : r.variance),
                    className: "text-right",
                  },
                  {
                    key: "varianceReason",
                    header: "Reason",
                    render: (r) => (r.varianceReason === undefined ? "—" : r.varianceReason),
                  },
                  {
                    key: "drill",
                    header: "Drill-down",
                    render: (r) => (
                      <button
                        className="rounded-md border border-zinc-200 bg-white px-2 py-1 text-xs text-zinc-700"
                        onClick={async () => {
                          const led = await api.inventoryDashboard.getMovementLedger(filters, {
                            month: r.month,
                            branch: r.branch,
                            item: r.item,
                          });
                          setLedger({ branch: led.branch, month: led.month, item: r.item, rows: led.rows });
                          setLedgerOpen(true);
                        }}
                      >
                        View Movements
                      </button>
                    ),
                  },
                ]}
                pageSize={8}
              />
            </section>
          </main>
        </div>

        {ledgerOpen && ledger ? (
          <div className="fixed inset-0 z-50 flex items-center justify-end bg-black/30">
            <div className="h-full w-full max-w-2xl overflow-y-auto bg-white p-4 shadow-xl">
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold text-zinc-900">Inventory Movement Ledger</div>
                <button className="text-sm text-zinc-500" onClick={() => setLedgerOpen(false)}>
                  Close
                </button>
              </div>

              <div className="mt-2 text-sm text-zinc-700">
                Branch: {ledger.branch} | Month: {ledger.month} | Item: {ledger.item}
              </div>

              <div className="mt-4 overflow-x-auto">
                <table className="w-full border-separate border-spacing-0">
                  <thead>
                    <tr>
                      {["Date", "Kind", "Qty", "Dept (issued only)", "Source", "Reason"].map((h) => (
                        <th
                          key={h}
                          className="whitespace-nowrap border-b border-zinc-200 px-3 py-2 text-left text-xs font-medium text-zinc-500"
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {ledger.rows.map((r) => (
                      <tr key={r.id} className="hover:bg-zinc-50">
                        <td className="border-b border-zinc-100 px-3 py-2 text-sm text-zinc-800">{r.date}</td>
                        <td className="border-b border-zinc-100 px-3 py-2 text-sm text-zinc-800">{r.kind}</td>
                        <td className="border-b border-zinc-100 px-3 py-2 text-sm text-zinc-800 text-right">{r.quantity}</td>
                        <td className="border-b border-zinc-100 px-3 py-2 text-sm text-zinc-800">{r.dept ?? "—"}</td>
                        <td className="border-b border-zinc-100 px-3 py-2 text-sm text-zinc-800">{r.sourceDocument ?? "—"}</td>
                        <td className="border-b border-zinc-100 px-3 py-2 text-sm text-zinc-800">{r.reason ?? "—"}</td>
                      </tr>
                    ))}
                    {ledger.rows.length === 0 ? (
                      <tr>
                        <td className="px-3 py-10 text-center text-sm text-zinc-500" colSpan={6}>
                          No data for selected filters
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </RequireAuth>
  );
}
