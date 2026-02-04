"use client";

import { useEffect, useMemo, useState } from "react";

import { GlobalFilterBar } from "@/components/core/GlobalFilterBar";
import { PaginatedDataTable } from "@/components/core/PaginatedDataTable";
import { useAuth } from "@/contexts/AuthContext";
import { getApiClient } from "@/lib/api/client";
import type { DashboardFilters, InvoiceAgingDTO } from "@/lib/api/types";

export default function BranchInvoicesPage() {
  const { state } = useAuth();
  const branchName = state.allowedLocations?.[0] ?? "Your Branch";

  const api = useMemo(() => getApiClient(), []);
  const [loading, setLoading] = useState(false);
  const [aging, setAging] = useState<InvoiceAgingDTO | null>(null);

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
        const a = await api.financeDashboard.getInvoiceAging(filters);
        if (cancelled) return;
        setAging(a);
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
          <h1 className="text-2xl font-semibold text-zinc-900">Invoices & AP</h1>
          <div className="mt-1 text-sm text-zinc-600">{branchName}</div>
        </div>
        {loading ? <div className="text-xs text-zinc-500">Refreshing…</div> : null}
      </div>

      <section className="mt-6">
        <PaginatedDataTable
          title="Invoice Aging"
          rows={aging?.rows ?? []}
          columns={[
            { key: "invoice", header: "Invoice #", render: (r) => r.invoiceNumber },
            { key: "vendor", header: "Vendor", render: (r) => r.vendor },
            { key: "status", header: "Status", render: (r) => r.status },
            { key: "bucket", header: "Aging", render: (r) => r.agingBucket },
            { key: "amount", header: "Amount", render: (r) => r.amountDisplay, className: "text-right" },
            { key: "paid", header: "Paid", render: (r) => r.paidDisplay, className: "text-right" },
            { key: "balance", header: "Balance", render: (r) => r.balanceDisplay, className: "text-right" },
            { key: "due", header: "Due", render: (r) => r.dueDate },
          ]}
          pageSize={10}
        />
      </section>
    </div>
  );
}
