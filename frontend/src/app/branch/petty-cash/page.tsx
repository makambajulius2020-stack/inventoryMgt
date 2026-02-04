"use client";

import { useEffect, useMemo, useState } from "react";

import { GlobalFilterBar } from "@/components/core/GlobalFilterBar";
import { KpiCard } from "@/components/core/KpiCard";
import { PaginatedDataTable } from "@/components/core/PaginatedDataTable";
import { useAuth } from "@/contexts/AuthContext";
import { getApiClient } from "@/lib/api/client";
import type { DashboardFilters, PettyCashLedgerDTO, PettyCashSummaryDTO } from "@/lib/api/types";

export default function BranchPettyCashPage() {
  const { state } = useAuth();
  const branchName = state.allowedLocations?.[0] ?? "Your Branch";

  const api = useMemo(() => getApiClient(), []);
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<PettyCashSummaryDTO | null>(null);
  const [ledger, setLedger] = useState<PettyCashLedgerDTO | null>(null);

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
        const s = await api.financeDashboard.getPettyCashSummary(filters);
        if (cancelled) return;
        setSummary(s);

        const month = s.month;
        const l = await api.financeDashboard.getPettyCashLedger(filters, { branch: branchName, month });
        if (cancelled) return;
        setLedger(l);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    run();
    return () => {
      cancelled = true;
    };
  }, [api, filters, branchName]);

  return (
    <div>
      <GlobalFilterBar filters={filters} locations={[branchName]} onChange={setFilters} hideLocation />

      <div className="flex items-start justify-between gap-6">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900">Petty Cash</h1>
          <div className="mt-1 text-sm text-zinc-600">{branchName}</div>
        </div>
        {loading ? <div className="text-xs text-zinc-500">Refreshing…</div> : null}
      </div>

      <section className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard title="Opening Balance" value={ledger?.openingBalanceDisplay ?? "—"} />
        <KpiCard title="Total In" value={ledger?.totalInDisplay ?? "—"} />
        <KpiCard title="Total Out" value={ledger?.totalOutDisplay ?? "—"} tone="warn" />
        <KpiCard title="Closing Balance" value={ledger?.closingBalanceDisplay ?? "—"} />
      </section>

      <section className="mt-6">
        <PaginatedDataTable
          title={`Ledger (${summary?.month ?? "—"})`}
          rows={ledger?.rows ?? []}
          columns={[
            { key: "date", header: "Date", render: (r) => r.date },
            { key: "pv", header: "PV #", render: (r) => r.pvNumber },
            { key: "type", header: "Expense Type", render: (r) => r.expenseType },
            { key: "account", header: "Account", render: (r) => r.expenseAccount },
            { key: "dir", header: "Dir", render: (r) => r.direction },
            { key: "amount", header: "Amount", render: (r) => r.amountDisplay, className: "text-right" },
            { key: "doc", header: "Linked Doc", render: (r) => r.linkedDocument ?? "—" },
          ]}
          pageSize={10}
        />
      </section>
    </div>
  );
}
