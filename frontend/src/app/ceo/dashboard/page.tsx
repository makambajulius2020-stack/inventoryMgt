"use client";

import { useEffect, useMemo, useState } from "react";

import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { RequireAuth } from "@/components/core/RequireAuth";
import { GlobalFilterBar } from "@/components/core/GlobalFilterBar";
import { KpiCard } from "@/components/core/KpiCard";
import { PortalSidebar } from "@/components/core/PortalSidebar";
import { ChartWrapper } from "@/components/core/ChartWrapper";
import { PaginatedDataTable } from "@/components/core/PaginatedDataTable";
import { StatusBadge } from "@/components/core/StatusBadge";
import { useAuth } from "@/contexts/AuthContext";
import { getApiClient } from "@/lib/api/client";
import type {
  CeoSummaryDTO,
  DashboardFilters,
  PriceVendorAlertRowDTO,
  ProcurementFlowDTO,
  TopVendorRowDTO,
} from "@/lib/api/types";

function toneForSeverity(sev: string): "neutral" | "warn" | "bad" {
  if (sev === "CRITICAL") return "bad";
  if (sev === "HIGH") return "warn";
  return "neutral";
}

function fmtUGX(v: number) {
  return v.toLocaleString(undefined, { style: "currency", currency: "UGX", maximumFractionDigits: 0 });
}

export default function CeoDashboardPage() {
  const api = useMemo(() => getApiClient(), []);
  const { state } = useAuth();

  const initialLocation = state.allowedLocations?.[0] || "All Branches";

  const [filters, setFilters] = useState<DashboardFilters>({
    preset: "month",
    location: initialLocation,
  });

  const [summary, setSummary] = useState<CeoSummaryDTO | null>(null);
  const [salesProc, setSalesProc] = useState<{ points: { period: string; sales: number; procurementSpend: number }[] } | null>(null);
  const [flow, setFlow] = useState<ProcurementFlowDTO | null>(null);
  const [alerts, setAlerts] = useState<PriceVendorAlertRowDTO[]>([]);
  const [vendors, setVendors] = useState<TopVendorRowDTO[]>([]);
  const [loading, setLoading] = useState(false);
  const [alertOpen, setAlertOpen] = useState(false);
  const [selectedAlert, setSelectedAlert] = useState<PriceVendorAlertRowDTO | null>(null);

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
        const [s, sp, pf, a, tv] = await Promise.all([
          api.ceoDashboard.getSummary(filters),
          api.ceoDashboard.getSalesVsProcurement(filters),
          api.ceoDashboard.getProcurementFlow(filters),
          api.ceoDashboard.getPriceAndVendorAlerts(filters),
          api.ceoDashboard.getTopVendors(filters),
        ]);
        if (cancelled) return;
        setSummary(s);
        setSalesProc(sp);
        setFlow(pf);
        setAlerts(a.rows);
        setVendors(tv.rows);
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
                <h1 className="text-2xl font-semibold text-zinc-900">CEO / Executive Dashboard</h1>
              </div>
              {loading ? <div className="text-xs text-zinc-500">Refreshing…</div> : null}
            </div>

            <section className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <KpiCard title="Total Sales" value={summary?.kpis.totalSales.display ?? "—"} />
              <KpiCard title="Total Procurement Spend" value={summary?.kpis.totalProcurementSpend.display ?? "—"} />
              <KpiCard title="Pending Payments" value={summary?.kpis.pendingPayments.display ?? "—"} tone="warn" />
              <KpiCard title="Inventory Value" value={summary?.kpis.inventoryValue.display ?? "—"} />
              <KpiCard title="Gross Margin (%)" value={summary?.kpis.grossMarginPct.display ?? "—"} tone="good" />
              <KpiCard
                title="Active Alerts"
                value={summary?.kpis.activeAlerts.display ?? "—"}
                tone="warn"
                onClick={() => {
                  setSelectedAlert(alerts[0] ?? null);
                  setAlertOpen(true);
                }}
              />
            </section>

            <section className="mt-6">
              <ChartWrapper title="Sales vs Procurement Spend" subtitle="Trend line used for overspending and margin pressure detection">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={salesProc?.points ?? []} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="period" />
                    <YAxis />
                    <Tooltip />
                    <Legend  formatter={(value) => (typeof value === "number" ? fmtUGX(value) : value)}/>
                    <Line type="monotone" dataKey="sales" name="Sales" stroke="#18181b" strokeWidth={2.5} dot={false} />
                    <Line
                      type="monotone"
                      dataKey="procurementSpend"
                      name="Procurement Spend"
                      stroke="#a1a1aa"
                      strokeWidth={2.5}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </ChartWrapper>
            </section>

            <section className="mt-8 grid gap-4 lg:grid-cols-2">
              <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
                <div className="text-sm font-semibold text-zinc-900">Procurement Flow Overview</div>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-lg border border-zinc-200 p-3">
                    <div className="text-xs font-medium text-zinc-500">Requisitions</div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <StatusBadge label={`Pending: ${flow?.requisitions.pending ?? "—"}`} tone="warn" />
                      <StatusBadge label={`Approved: ${flow?.requisitions.approved ?? "—"}`} tone="good" />
                      <StatusBadge label={`Rejected: ${flow?.requisitions.rejected ?? "—"}`} tone="bad" />
                    </div>
                  </div>
                  <div className="rounded-lg border border-zinc-200 p-3">
                    <div className="text-xs font-medium text-zinc-500">LPOs</div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <StatusBadge label={`Issued: ${flow?.lpos.issued ?? "—"}`} />
                      <StatusBadge label={`Partial: ${flow?.lpos.partial ?? "—"}`} tone="warn" />
                      <StatusBadge label={`Complete: ${flow?.lpos.complete ?? "—"}`} tone="good" />
                    </div>
                  </div>
                  <div className="rounded-lg border border-zinc-200 p-3">
                    <div className="text-xs font-medium text-zinc-500">GRNs Awaiting Finance</div>
                    <div className="mt-2 text-2xl font-semibold text-zinc-900">{flow?.grnsAwaitingFinance ?? "—"}</div>
                  </div>
                  <div className="rounded-lg border border-zinc-200 p-3">
                    <div className="text-xs font-medium text-zinc-500">Invoices with Discrepancies</div>
                    <div className="mt-2 text-2xl font-semibold text-zinc-900">{flow?.invoicesWithDiscrepancies ?? "—"}</div>
                  </div>
                </div>
              </div>

              <PaginatedDataTable
                title="Price & Vendor Alerts"
                rows={alerts}
                columns={[
                  {
                    key: "item",
                    header: "Item",
                    render: (r) => (
                      <button
                        type="button"
                        className="text-left text-sm font-medium text-zinc-900 hover:underline"
                        onClick={() => {
                          setSelectedAlert(r);
                          setAlertOpen(true);
                        }}
                      >
                        {r.item}
                      </button>
                    ),
                  },
                  { key: "vendor", header: "Vendor", render: (r) => r.vendor },
                  { key: "branch", header: "Branch", render: (r) => r.branch },
                  { key: "pctChange", header: "Price Change %", render: (r) => `${r.pctChange.toFixed(1)}%`, className: "text-right" },
                  { key: "severity", header: "Severity", render: (r) => <StatusBadge label={r.severity} tone={toneForSeverity(r.severity)} /> },
                ]}
              />
            </section>

            <section className="mt-6">
              <PaginatedDataTable
                title="Top Vendors Summary"
                rows={vendors}
                columns={[
                  { key: "vendorName", header: "Vendor Name", render: (r) => r.vendorName },
                  { key: "totalSpend", header: "Total Spend", render: (r) => r.totalSpendDisplay, className: "text-right" },
                  { key: "outstandingPayments", header: "Outstanding Payments", render: (r) => r.outstandingPaymentsDisplay, className: "text-right" },
                  { key: "avgPriceVariancePct", header: "Avg Price Variance", render: (r) => `${r.avgPriceVariancePct.toFixed(1)}%`, className: "text-right" },
                  { key: "fulfillmentRatePct", header: "Fulfillment Rate", render: (r) => `${r.fulfillmentRatePct.toFixed(1)}%`, className: "text-right" },
                ]}
              />
            </section>
          </main>
        </div>

        {alertOpen ? (
          <div className="fixed inset-0 z-50 flex items-center justify-end bg-black/30">
            <div className="h-full w-full max-w-xl overflow-y-auto bg-white p-4 shadow-xl">
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold text-zinc-900">Alert Details</div>
                <button className="text-sm text-zinc-500" onClick={() => setAlertOpen(false)}>
                  Close
                </button>
              </div>

              {selectedAlert ? (
                <div className="mt-4 space-y-3 text-sm text-zinc-700">
                  <div>
                    <div className="text-xs font-medium text-zinc-500">Item</div>
                    <div className="font-medium text-zinc-900">{selectedAlert.item}</div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <div className="text-xs font-medium text-zinc-500">Vendor</div>
                      <div className="font-medium text-zinc-900">{selectedAlert.vendor}</div>
                    </div>
                    <div>
                      <div className="text-xs font-medium text-zinc-500">Branch</div>
                      <div className="font-medium text-zinc-900">{selectedAlert.branch}</div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <div className="text-xs font-medium text-zinc-500">Price Change</div>
                      <div className="font-medium text-zinc-900">{selectedAlert.pctChange.toFixed(1)}%</div>
                    </div>
                    <div>
                      <div className="text-xs font-medium text-zinc-500">Severity</div>
                      <div className="font-medium text-zinc-900">{selectedAlert.severity}</div>
                    </div>
                  </div>

                  <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-sm text-zinc-700">
                    This alert indicates unusual vendor pricing movement. Review recent invoices/GRNs for this item,
                    verify contract pricing, and confirm if the change is seasonal or vendor-driven.
                  </div>
                </div>
              ) : (
                <div className="mt-4 text-sm text-zinc-500">No alert selected.</div>
              )}
            </div>
          </div>
        ) : null}
      </div>
    </RequireAuth>
  );
}
