"use client";

import { useEffect, useMemo, useState } from "react";

import { GlobalFilterBar } from "@/components/core/GlobalFilterBar";
import { KpiCard } from "@/components/core/KpiCard";
import { PaginatedDataTable } from "@/components/core/PaginatedDataTable";
import { PortalSidebar } from "@/components/core/PortalSidebar";
import { RequireAuth } from "@/components/core/RequireAuth";
import { StatusBadge } from "@/components/core/StatusBadge";
import { useAuth } from "@/contexts/AuthContext";
import { getApiClient } from "@/lib/api/client";
import type {
  DashboardFilters,
  LpoStatus,
  ProcurementAdjustmentsAuditRowDTO,
  ProcurementLpoRowDTO,
  ProcurementRequisitionRowDTO,
  ProcurementVendorBalanceRowDTO,
  ProcurementWatchlistGrnRowDTO,
  ProcurementWatchlistInvoiceRowDTO,
} from "@/lib/api/types";

function toneForReqStatus(s: string): "neutral" | "good" | "warn" | "bad" {
  if (s === "Approved") return "good";
  if (s === "Pending") return "warn";
  if (s === "Rejected") return "bad";
  return "neutral";
}

export default function ProcurementDashboardPage() {
  const api = useMemo(() => getApiClient(), []);
  const { state } = useAuth();

  const initialLocation = state.allowedLocations?.[0] || "All Branches";

  const [filters, setFilters] = useState<DashboardFilters>({
    preset: "month",
    location: initialLocation,
  });

  const [lpoStatus, setLpoStatus] = useState<LpoStatus | undefined>(undefined);

  const [loading, setLoading] = useState(false);
  const [kpis, setKpis] = useState<{
    totalRequisitions: string;
    pendingApprovals: string;
    activeLpos: string;
    grnsAwaitingFinance: string;
    invoicesWithDiscrepancies: string;
  } | null>(null);
  const [reqRows, setReqRows] = useState<ProcurementRequisitionRowDTO[]>([]);
  const [lpoSummary, setLpoSummary] = useState<Record<LpoStatus, number> | null>(null);
  const [lpoRows, setLpoRows] = useState<ProcurementLpoRowDTO[]>([]);
  const [grnRows, setGrnRows] = useState<ProcurementWatchlistGrnRowDTO[]>([]);
  const [invoiceRows, setInvoiceRows] = useState<ProcurementWatchlistInvoiceRowDTO[]>([]);
  const [vendorRows, setVendorRows] = useState<ProcurementVendorBalanceRowDTO[]>([]);
  const [auditOpen, setAuditOpen] = useState(false);
  const [auditRows, setAuditRows] = useState<ProcurementAdjustmentsAuditRowDTO[]>([]);
  const [auditVendor, setAuditVendor] = useState<string | undefined>(undefined);

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
        const [k, r, s, l, g, inv, vb] = await Promise.all([
          api.procurementDashboard.getKpis(filters),
          api.procurementDashboard.getRequisitionFlow(filters),
          api.procurementDashboard.getLpoStatusSummary(filters),
          api.procurementDashboard.getLpos(filters, { status: lpoStatus }),
          api.procurementDashboard.getGrnsAwaitingFinance(filters),
          api.procurementDashboard.getInvoicesWithDiscrepancies(filters),
          api.procurementDashboard.getVendorBalances(filters),
        ]);
        if (cancelled) return;

        setKpis({
          totalRequisitions: k.kpis.totalRequisitions.display,
          pendingApprovals: k.kpis.pendingApprovals.display,
          activeLpos: k.kpis.activeLpos.display,
          grnsAwaitingFinance: k.kpis.grnsAwaitingFinance.display,
          invoicesWithDiscrepancies: k.kpis.invoicesWithDiscrepancies.display,
        });
        setReqRows(r.rows);
        setLpoSummary(s.summary);
        setLpoRows(l.rows);
        setGrnRows(g.rows);
        setInvoiceRows(inv.rows);
        setVendorRows(vb.rows);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    run();
    return () => {
      cancelled = true;
    };
  }, [api, filters, lpoStatus]);

  return (
    <RequireAuth>
      <div className="min-h-screen bg-zinc-50">
        <GlobalFilterBar
          filters={filters}
          locations={state.allowedLocations?.length ? state.allowedLocations : ["All Branches"]}
          onChange={(next) => {
            setFilters(next);
            setLpoStatus(undefined);
          }}
        />

        <div className="mx-auto flex max-w-7xl">
          <PortalSidebar />

          <main className="w-full px-6 py-8">
            <div className="flex items-start justify-between gap-6">
              <div>
                <h1 className="text-2xl font-semibold text-zinc-900">Procurement (Super Admin View)</h1>
              </div>
              {loading ? <div className="text-xs text-zinc-500">Refreshing…</div> : null}
            </div>

            <section className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              <KpiCard title="Total Requisitions" value={kpis?.totalRequisitions ?? "—"} />
              <KpiCard title="Pending Approvals" value={kpis?.pendingApprovals ?? "—"} tone="warn" />
              <KpiCard title="Active LPOs" value={kpis?.activeLpos ?? "—"} />
              <KpiCard title="GRNs Awaiting Finance" value={kpis?.grnsAwaitingFinance ?? "—"} tone="warn" />
              <KpiCard title="Invoices w/ Discrepancies" value={kpis?.invoicesWithDiscrepancies ?? "—"} tone="warn" />
            </section>

            <section className="mt-6">
              <PaginatedDataTable
                title="Requisition Flow"
                rows={reqRows}
                columns={[
                  { key: "requisitionId", header: "Requisition ID", render: (r) => r.requisitionId },
                  { key: "department", header: "Department", render: (r) => r.department },
                  { key: "branch", header: "Branch", render: (r) => r.branch },
                  {
                    key: "status",
                    header: "Status",
                    render: (r) => <StatusBadge label={r.status} tone={toneForReqStatus(r.status)} />,
                  },
                  { key: "requestedAmount", header: "Requested Amount", render: (r) => r.requestedAmountDisplay, className: "text-right" },
                  { key: "date", header: "Date", render: (r) => r.date },
                ]}
              />
            </section>

            <section className="mt-8 grid gap-4 lg:grid-cols-2">
              <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-semibold text-zinc-900">LPO Status Overview</div>
                  <button
                    type="button"
                    className="text-xs font-medium text-zinc-700 hover:underline"
                    onClick={() => setLpoStatus(undefined)}
                  >
                    Clear
                  </button>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {(["Issued", "Partial", "Completed", "Cancelled"] as LpoStatus[]).map((s) => {
                    const active = lpoStatus === s;
                    const v = lpoSummary?.[s];
                    return (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setLpoStatus((cur) => (cur === s ? undefined : s))}
                        className={`rounded-lg border p-3 text-left ${
                          active ? "border-zinc-900 bg-zinc-900 text-white" : "border-zinc-200 bg-white hover:bg-zinc-50"
                        }`}
                      >
                        <div className={`text-xs font-medium ${active ? "text-zinc-200" : "text-zinc-500"}`}>{s}</div>
                        <div className={`mt-2 text-2xl font-semibold ${active ? "text-white" : "text-zinc-900"}`}>{v ?? "—"}</div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <PaginatedDataTable
                title={`LPOs${lpoStatus ? ` (${lpoStatus})` : ""}`}
                rows={lpoRows}
                columns={[
                  { key: "lpoId", header: "LPO ID", render: (r) => r.lpoId },
                  { key: "vendor", header: "Vendor", render: (r) => r.vendor },
                  { key: "branch", header: "Branch", render: (r) => r.branch },
                  { key: "status", header: "Status", render: (r) => <StatusBadge label={r.status} /> },
                  { key: "amount", header: "Amount", render: (r) => r.amountDisplay, className: "text-right" },
                  { key: "date", header: "Date", render: (r) => r.date },
                ]}
                pageSize={6}
              />
            </section>

            <section className="mt-6 grid gap-4 lg:grid-cols-2">
              <PaginatedDataTable
                title="Vendor Balances (System + Migrated Opening)"
                rows={vendorRows}
                columns={[
                  { key: "vendor", header: "Vendor", render: (r) => r.vendor },
                  { key: "branchScope", header: "Scope", render: (r) => r.branchScope },
                  { key: "totalReceived", header: "Total Received", render: (r) => r.totalReceivedDisplay, className: "text-right" },
                  { key: "totalPaid", header: "Total Paid", render: (r) => r.totalPaidDisplay, className: "text-right" },
                  { key: "migratedOpeningBalance", header: "Migrated Opening", render: (r) => r.migratedOpeningBalanceDisplay, className: "text-right" },
                  { key: "outstanding", header: "Outstanding", render: (r) => r.outstandingDisplay, className: "text-right" },
                  {
                    key: "adjustments",
                    header: "Audit",
                    render: (r) =>
                      r.hasManualAdjustments ? (
                        <button
                          className="rounded-md border border-zinc-200 bg-white px-2 py-1 text-xs text-zinc-700"
                          onClick={async () => {
                            const res = await api.procurementDashboard.getAdjustmentsAudit(filters, { vendor: r.vendor });
                            setAuditRows(res.rows);
                            setAuditVendor(r.vendor);
                            setAuditOpen(true);
                          }}
                        >
                          View Adjustments
                        </button>
                      ) : (
                        <span className="text-xs text-zinc-500">—</span>
                      ),
                  },
                ]}
                pageSize={6}
              />

              <PaginatedDataTable
                title="GRNs Awaiting Finance Confirmation"
                rows={grnRows}
                columns={[
                  { key: "grnId", header: "GRN ID", render: (r) => r.grnId },
                  { key: "lpoId", header: "LPO ID", render: (r) => r.lpoId },
                  { key: "vendor", header: "Vendor", render: (r) => r.vendor },
                  { key: "branch", header: "Branch", render: (r) => r.branch },
                  { key: "value", header: "Value", render: (r) => r.valueDisplay, className: "text-right" },
                  { key: "date", header: "Date", render: (r) => r.date },
                ]}
                pageSize={6}
              />
            </section>

            <section className="mt-6">
              <PaginatedDataTable
                title="Invoices with Mismatches (3-way Match Failures)"
                rows={invoiceRows}
                columns={[
                  { key: "invoiceNumber", header: "Invoice #", render: (r) => r.invoiceNumber },
                  { key: "grnId", header: "GRN", render: (r) => r.grnId },
                  { key: "lpoId", header: "LPO", render: (r) => r.lpoId },
                  { key: "vendor", header: "Vendor", render: (r) => r.vendor },
                  { key: "branch", header: "Branch", render: (r) => r.branch },
                  { key: "issue", header: "Issue", render: (r) => r.issue },
                  { key: "amount", header: "Amount", render: (r) => r.amountDisplay, className: "text-right" },
                  { key: "date", header: "Date", render: (r) => r.date },
                ]}
                pageSize={8}
              />
            </section>
          </main>
        </div>

        {auditOpen ? (
          <div className="fixed inset-0 z-50 flex items-center justify-end bg-black/30">
            <div className="h-full w-full max-w-2xl overflow-y-auto bg-white p-4 shadow-xl">
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold text-zinc-900">Adjustments Audit</div>
                <button className="text-sm text-zinc-500" onClick={() => setAuditOpen(false)}>
                  Close
                </button>
              </div>

              <div className="mt-2 text-sm text-zinc-700">Vendor: {auditVendor ?? "All"}</div>

              <div className="mt-4 overflow-x-auto">
                <table className="w-full border-separate border-spacing-0">
                  <thead>
                    <tr>
                      {["When", "Vendor", "Branch", "Amount", "Reason", "By"].map((h) => (
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
                    {auditRows.map((r) => (
                      <tr key={r.id} className="hover:bg-zinc-50">
                        <td className="border-b border-zinc-100 px-3 py-2 text-sm text-zinc-800">
                          {new Date(r.at).toLocaleString()}
                        </td>
                        <td className="border-b border-zinc-100 px-3 py-2 text-sm text-zinc-800">{r.vendor}</td>
                        <td className="border-b border-zinc-100 px-3 py-2 text-sm text-zinc-800">{r.branch}</td>
                        <td className="border-b border-zinc-100 px-3 py-2 text-sm text-zinc-800 text-right">{r.amountDisplay}</td>
                        <td className="border-b border-zinc-100 px-3 py-2 text-sm text-zinc-800">{r.reason}</td>
                        <td className="border-b border-zinc-100 px-3 py-2 text-sm text-zinc-800">{r.actorName}</td>
                      </tr>
                    ))}
                    {auditRows.length === 0 ? (
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
