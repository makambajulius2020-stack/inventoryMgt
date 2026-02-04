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
import type { DashboardFilters, InvoiceAgingRowDTO, PaymentsLogRowDTO, PettyCashSummaryRowDTO } from "@/lib/api/types";

function toneForAgingBucket(b: string): "neutral" | "good" | "warn" | "bad" {
  if (b === "0-30") return "good";
  if (b === "31-60") return "warn";
  if (b === "60+") return "bad";
  return "neutral";
}

export default function FinanceDashboardPage() {
  const api = useMemo(() => getApiClient(), []);
  const { state } = useAuth();

  const initialLocation = state.allowedLocations?.[0] || "All Branches";

  const [filters, setFilters] = useState<DashboardFilters>({
    preset: "month",
    location: initialLocation,
  });

  const [loading, setLoading] = useState(false);
  const [kpis, setKpis] = useState<{
    totalPayables: string;
    overdueInvoices: string;
    paymentsMade: string;
    pettyCashSpend: string;
    outstandingGrnValue: string;
  } | null>(null);
  const [agingRows, setAgingRows] = useState<InvoiceAgingRowDTO[]>([]);
  const [paymentRows, setPaymentRows] = useState<PaymentsLogRowDTO[]>([]);
  const [pettyRows, setPettyRows] = useState<PettyCashSummaryRowDTO[]>([]);
  const [pettyOpen, setPettyOpen] = useState(false);
  const [pettyLedger, setPettyLedger] = useState<{
    branch: string;
    month: string;
    opening: string;
    totalIn: string;
    totalOut: string;
    closing: string;
    rows: {
      date: string;
      pvNumber: string;
      expenseType: string;
      expenseAccount: string;
      direction: string;
      amountDisplay: string;
      linkedDocument?: string;
    }[];
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
        const [k, a, p, pc] = await Promise.all([
          api.financeDashboard.getKpis(filters),
          api.financeDashboard.getInvoiceAging(filters),
          api.financeDashboard.getPaymentsLog(filters),
          api.financeDashboard.getPettyCashSummary(filters),
        ]);
        if (cancelled) return;

        setKpis({
          totalPayables: k.kpis.totalPayables.display,
          overdueInvoices: k.kpis.overdueInvoices.display,
          paymentsMade: k.kpis.paymentsMade.display,
          pettyCashSpend: k.kpis.pettyCashSpend.display,
          outstandingGrnValue: k.kpis.outstandingGrnValue.display,
        });
        setAgingRows(a.rows);
        setPaymentRows(p.rows);
        setPettyRows(pc.rows);
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
                <h1 className="text-2xl font-semibold text-zinc-900">Finance (Super Admin View)</h1>
              </div>
              {loading ? <div className="text-xs text-zinc-500">Refreshing…</div> : null}
            </div>

            <section className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              <KpiCard title="Total Payables" value={kpis?.totalPayables ?? "—"} tone="warn" />
              <KpiCard title="Overdue Invoices" value={kpis?.overdueInvoices ?? "—"} tone="warn" />
              <KpiCard title="Payments Made (Period)" value={kpis?.paymentsMade ?? "—"} />
              <KpiCard title="Petty Cash Spend" value={kpis?.pettyCashSpend ?? "—"} />
              <KpiCard title="Outstanding GRN Value" value={kpis?.outstandingGrnValue ?? "—"} tone="warn" />
            </section>

            <section className="mt-6">
              <PaginatedDataTable
                title="Invoice Aging"
                rows={agingRows}
                columns={[
                  { key: "invoiceNumber", header: "Invoice #", render: (r) => r.invoiceNumber },
                  { key: "vendor", header: "Vendor", render: (r) => r.vendor },
                  { key: "branch", header: "Branch", render: (r) => r.branch },
                  { key: "grnId", header: "GRN", render: (r) => r.grnId },
                  { key: "lpoId", header: "LPO", render: (r) => r.lpoId },
                  { key: "dueDate", header: "Due Date", render: (r) => r.dueDate },
                  { key: "agingDays", header: "Aging Days", render: (r) => r.agingDays, className: "text-right" },
                  { key: "amount", header: "Amount", render: (r) => r.amountDisplay, className: "text-right" },
                  { key: "paid", header: "Paid", render: (r) => r.paidDisplay, className: "text-right" },
                  { key: "balance", header: "Balance", render: (r) => r.balanceDisplay, className: "text-right" },
                  {
                    key: "agingBucket",
                    header: "Aging Bucket",
                    render: (r) => <StatusBadge label={r.agingBucket} tone={toneForAgingBucket(r.agingBucket)} />,
                  },
                  { key: "status", header: "Status", render: (r) => r.status },
                ]}
              />
            </section>

            <section className="mt-6">
              <PaginatedDataTable
                title="Petty Cash Summary (Ledger-derived)"
                rows={pettyRows}
                columns={[
                  { key: "branch", header: "Branch", render: (r) => r.branch },
                  { key: "month", header: "Month", render: (r) => r.month },
                  { key: "openingBalance", header: "Opening", render: (r) => r.openingBalanceDisplay, className: "text-right" },
                  { key: "totalIn", header: "Total In", render: (r) => r.totalInDisplay, className: "text-right" },
                  { key: "totalOut", header: "Total Out", render: (r) => r.totalOutDisplay, className: "text-right" },
                  { key: "closingBalance", header: "Closing", render: (r) => r.closingBalanceDisplay, className: "text-right" },
                  {
                    key: "drill",
                    header: "Drill-down",
                    render: (r) => (
                      <button
                        className="rounded-md border border-zinc-200 bg-white px-2 py-1 text-xs text-zinc-700"
                        onClick={async () => {
                          const ledger = await api.financeDashboard.getPettyCashLedger(filters, { branch: r.branch, month: r.month });
                          setPettyLedger({
                            branch: ledger.branch,
                            month: ledger.month,
                            opening: ledger.openingBalanceDisplay,
                            totalIn: ledger.totalInDisplay,
                            totalOut: ledger.totalOutDisplay,
                            closing: ledger.closingBalanceDisplay,
                            rows: ledger.rows.map((x) => ({
                              date: x.date,
                              pvNumber: x.pvNumber,
                              expenseType: x.expenseType,
                              expenseAccount: x.expenseAccount,
                              direction: x.direction,
                              amountDisplay: x.amountDisplay,
                              linkedDocument: x.linkedDocument,
                            })),
                          });
                          setPettyOpen(true);
                        }}
                      >
                        View Ledger
                      </button>
                    ),
                  },
                ]}
                pageSize={6}
              />
            </section>

            <section className="mt-6">
              <PaginatedDataTable
                title="Payments Log"
                rows={paymentRows}
                columns={[
                  { key: "paymentDate", header: "Payment Date", render: (r) => r.paymentDate },
                  { key: "vendor", header: "Vendor", render: (r) => r.vendor },
                  { key: "amount", header: "Amount", render: (r) => r.amountDisplay, className: "text-right" },
                  { key: "method", header: "Method", render: (r) => r.method },
                  { key: "linkedInvoiceNumber", header: "Invoice #", render: (r) => r.linkedInvoiceNumber },
                  { key: "grnId", header: "GRN", render: (r) => r.grnId },
                  { key: "lpoId", header: "LPO", render: (r) => r.lpoId },
                  { key: "branch", header: "Branch", render: (r) => r.branch },
                ]}
                pageSize={10}
              />
            </section>
          </main>
        </div>

        {pettyOpen && pettyLedger ? (
          <div className="fixed inset-0 z-50 flex items-center justify-end bg-black/30">
            <div className="h-full w-full max-w-2xl overflow-y-auto bg-white p-4 shadow-xl">
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold text-zinc-900">Petty Cash Ledger</div>
                <button className="text-sm text-zinc-500" onClick={() => setPettyOpen(false)}>
                  Close
                </button>
              </div>

              <div className="mt-2 text-sm text-zinc-700">
                Branch: {pettyLedger.branch} | Month: {pettyLedger.month}
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
                <div className="rounded-lg border border-zinc-200 bg-white p-2">
                  <div className="text-xs text-zinc-500">Opening</div>
                  <div className="font-semibold text-zinc-900">{pettyLedger.opening}</div>
                </div>
                <div className="rounded-lg border border-zinc-200 bg-white p-2">
                  <div className="text-xs text-zinc-500">Closing</div>
                  <div className="font-semibold text-zinc-900">{pettyLedger.closing}</div>
                </div>
              </div>

              <div className="mt-4 overflow-x-auto">
                <table className="w-full border-separate border-spacing-0">
                  <thead>
                    <tr>
                      {["Date", "PV", "Type", "Account", "In/Out", "Amount", "Linked Doc"].map((h) => (
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
                    {pettyLedger.rows.map((r) => (
                      <tr key={r.date + r.pvNumber} className="hover:bg-zinc-50">
                        <td className="border-b border-zinc-100 px-3 py-2 text-sm text-zinc-800">{r.date}</td>
                        <td className="border-b border-zinc-100 px-3 py-2 text-sm text-zinc-800">{r.pvNumber}</td>
                        <td className="border-b border-zinc-100 px-3 py-2 text-sm text-zinc-800">{r.expenseType}</td>
                        <td className="border-b border-zinc-100 px-3 py-2 text-sm text-zinc-800">{r.expenseAccount}</td>
                        <td className="border-b border-zinc-100 px-3 py-2 text-sm text-zinc-800">{r.direction}</td>
                        <td className="border-b border-zinc-100 px-3 py-2 text-sm text-zinc-800 text-right">{r.amountDisplay}</td>
                        <td className="border-b border-zinc-100 px-3 py-2 text-sm text-zinc-800">{r.linkedDocument ?? "—"}</td>
                      </tr>
                    ))}
                    {pettyLedger.rows.length === 0 ? (
                      <tr>
                        <td className="px-3 py-10 text-center text-sm text-zinc-500" colSpan={7}>
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
