"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { GlobalFilterBar } from "@/components/core/GlobalFilterBar";
import { PaginatedDataTable } from "@/components/core/PaginatedDataTable";
import { useAuth } from "@/contexts/AuthContext";
import { getApiClient } from "@/lib/api/client";
import type {
  DashboardFilters,
  ProcurementLposDTO,
  ProcurementWatchlistGrnsDTO,
} from "@/lib/api/types";

export default function BranchGrnsPage() {
  const { state } = useAuth();
  const router = useRouter();
  const branchName = state.allowedLocations?.[0] ?? "Your Branch";

  const api = useMemo(() => getApiClient(), []);
  const [loading, setLoading] = useState(false);
  const [lpos, setLpos] = useState<ProcurementLposDTO | null>(null);
  const [watchlist, setWatchlist] = useState<ProcurementWatchlistGrnsDTO | null>(null);

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
        const [l, g] = await Promise.all([
          api.procurementDashboard.getLpos(filters),
          api.procurementDashboard.getGrnsAwaitingFinance(filters),
        ]);
        if (cancelled) return;
        setLpos(l);
        setWatchlist(g);
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
          <h1 className="text-2xl font-semibold text-zinc-900">GRNs</h1>
          <div className="mt-1 text-sm text-zinc-600">{branchName}</div>
        </div>
        <div className="flex items-center gap-3">
          {loading ? <div className="text-xs text-zinc-500">Refreshing…</div> : null}
          <button
            type="button"
            className="rounded-lg bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-800"
            onClick={() => router.push("/branch/grns/new")}
          >
            Create GRN
          </button>
        </div>
      </div>

      <section className="mt-6 grid gap-4 lg:grid-cols-2">
        <PaginatedDataTable
          title="LPOs"
          rows={lpos?.rows ?? []}
          columns={[
            { key: "lpoId", header: "LPO ID", render: (r) => r.lpoId },
            { key: "vendor", header: "Vendor", render: (r) => r.vendor },
            { key: "status", header: "Status", render: (r) => r.status },
            { key: "amount", header: "Amount", render: (r) => r.amountDisplay, className: "text-right" },
            { key: "date", header: "Date", render: (r) => r.date },
          ]}
          pageSize={8}
        />

        <PaginatedDataTable
          title="GRNs Awaiting Finance Confirmation"
          rows={watchlist?.rows ?? []}
          columns={[
            { key: "grnId", header: "GRN ID", render: (r) => r.grnId },
            { key: "lpoId", header: "LPO ID", render: (r) => r.lpoId },
            { key: "vendor", header: "Vendor", render: (r) => r.vendor },
            { key: "value", header: "Value", render: (r) => r.valueDisplay, className: "text-right" },
            { key: "date", header: "Date", render: (r) => r.date },
          ]}
          pageSize={8}
        />
      </section>
    </div>
  );
}
