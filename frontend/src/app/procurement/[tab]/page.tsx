"use client";

import React, { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Download, Search } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { DataTable } from "@/components/ui/DataTable";
import { DashboardError, DashboardLoading } from "@/components/dashboard/DashboardStates";
import { Modal, ModalFooter } from "@/components/ui/Modal";
import { api } from "@/lib/api/client";
import { useAuth } from "@/contexts/AuthContext";
import { useGlobalDateFilters } from "@/contexts/GlobalDateFiltersContext";
import { mockDB } from "@/lib/mock-db";
import type { GRNRow, LPORow, RequisitionRow, VendorInvoiceRow } from "@/lib/api/services/procurement.service";

type LPOTableRow = LPORow & {
  approvedBy: string;
};

type VendorInvoiceTableRow = VendorInvoiceRow & {
  paymentTerms: string;
  reconStatus: string;
};

type PurchaseReportRow = {
  id: string;
  invoicePurchases: number;
  cashOnly: number;
  totalPaid: number;
  balance: number;
  openingModifications: string;
  reconStatus: string;
  vendor: string;
};

type TabKey =
  | "lpo-management"
  | "grn-management"
  | "vendor-invoices"
  | "vendor-ledger"
  | "purchase-reports"
  | "variance-reconciliation";

const TAB_META: Record<TabKey, { title: string; subtitle: string }> = {
  "lpo-management": { title: "LPO Management", subtitle: "Local purchase order control and approvals" },
  "grn-management": { title: "GRN Management", subtitle: "Goods received notes register" },
  "vendor-invoices": { title: "Vendor Invoices", subtitle: "Vendor invoice register and reconciliation state" },
  "vendor-ledger": { title: "Vendor Ledger", subtitle: "Vendor-level transaction history" },
  "purchase-reports": { title: "Purchase Reports", subtitle: "Procurement purchase report matrix" },
  "variance-reconciliation": { title: "Variance & Reconciliation", subtitle: "Exception and reconciliation dashboard shell" },
};

export default function ProcurementTabPage() {
  const params = useParams<{ tab: string }>();
  const tab = params.tab as TabKey;
  const config = TAB_META[tab];
  const { state } = useAuth();
  const { filters } = useGlobalDateFilters();

  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lpos, setLpos] = useState<LPORow[]>([]);
  const [grns, setGrns] = useState<GRNRow[]>([]);
  const [invoices, setInvoices] = useState<VendorInvoiceRow[]>([]);
  const [reqs, setReqs] = useState<RequisitionRow[]>([]);

  const [selectedLpo, setSelectedLpo] = useState<LPORow | null>(null);
  const [selectedGrn, setSelectedGrn] = useState<GRNRow | null>(null);
  const [transitioningLpoId, setTransitioningLpoId] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      if (!state.user) return;
      try {
        setLoading(true);
        setError(null);
        const [lpoRows, grnRows, invoiceRows, requisitions] = await Promise.all([
          api.procurement.getLPOs(state.user!),
          api.procurement.getGRNs(state.user!),
          api.procurement.getVendorInvoices(state.user!),
          api.procurement.getRequisitions(state.user!),
        ]);
        setLpos(lpoRows);
        setGrns(grnRows);
        setInvoices(invoiceRows);
        setReqs(requisitions);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Failed to load procurement tab");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [state.user, tab]);

  if (!config) return <DashboardError title="Procurement" message="Tab not found" />;
  if (loading) return <DashboardLoading titleWidthClassName="w-1/3" />;
  if (error) return <DashboardError title={config.title} message={error} />;

  const withinRange = (raw: string | undefined) => {
    if (!raw) return false;
    const t = new Date(raw).getTime();
    if (Number.isNaN(t)) return false;
    const fromTs = filters.fromDate ? new Date(filters.fromDate).getTime() : undefined;
    const toTs = filters.toDate ? new Date(filters.toDate).getTime() : undefined;
    if (fromTs !== undefined && t < fromTs) return false;
    if (toTs !== undefined && t > toTs) return false;
    return true;
  };

  const q = query.trim().toLowerCase();

  const filteredInvoices = invoices
    .filter((i) => {
      if (!q) return true;
      return i.id.toLowerCase().includes(q) || i.vendorName.toLowerCase().includes(q) || i.status.toLowerCase().includes(q);
    })
    .filter((i) => withinRange(i.dueDate));

  const filteredLpos = lpos
    .filter((l) => withinRange(l.issuedAt))
    .filter((l) => {
      if (!q) return true;
      return l.id.toLowerCase().includes(q) || l.vendorName.toLowerCase().includes(q) || l.status.toLowerCase().includes(q);
    });

  const filteredGrns = grns
    .filter((g) => withinRange(g.receivedAt))
    .filter((g) => {
      if (!q) return true;
      return g.id.toLowerCase().includes(q) || g.lpoId.toLowerCase().includes(q) || g.locationName.toLowerCase().includes(q) || g.status.toLowerCase().includes(q);
    });

  const lpoRows: Array<LPORow & { lines: number; totalQty: number }> = filteredLpos.map((l) => {
    const items = mockDB.requisitionItems.filter((ri) => ri.requisitionId === l.requisitionId);
    const totalQty = items.reduce((s, it) => s + it.quantity, 0);
    return { ...l, lines: items.length, totalQty };
  });

  const transitionLpo = async (lpoId: string, newStatus: "ISSUED" | "CANCELLED") => {
    if (!state.user) return;
    try {
      setTransitioningLpoId(lpoId);
      await api.procurement.transitionLPO(state.user, lpoId, newStatus);
      const [lpoRowsNext, grnRowsNext] = await Promise.all([
        api.procurement.getLPOs(state.user),
        api.procurement.getGRNs(state.user),
      ]);
      setLpos(lpoRowsNext);
      setGrns(grnRowsNext);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to update LPO");
    } finally {
      setTransitioningLpoId(null);
    }
  };

  const reportRows: PurchaseReportRow[] = filteredInvoices.map((inv) => {
    const paid = inv.status === "PAID" ? inv.amount : 0;
    return {
      id: inv.id,
      invoicePurchases: inv.amount,
      cashOnly: inv.status === "PAID" ? inv.amount : 0,
      totalPaid: paid,
      balance: inv.amount - paid,
      openingModifications: "Opening",
      reconStatus: inv.status === "PAID" ? "Reconciled" : "Pending",
      vendor: inv.vendorName,
    };
  });

  return (
    <div className="p-8 space-y-8 max-w-[1600px] mx-auto">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-[var(--text-primary)] tracking-tighter uppercase">{config.title}</h1>
          <p className="text-[var(--text-secondary)] font-medium">{config.subtitle}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="h-9 px-3 rounded-xl bg-[var(--input)] border border-[var(--input-border)] inline-flex items-center gap-2 text-[var(--text-muted)]">
            <Search className="w-4 h-4" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Quick search" className="bg-transparent outline-none text-sm text-[var(--text-primary)]" />
          </label>
          <Button variant="outline" size="sm"><Download className="w-4 h-4 mr-2" />Export</Button>
        </div>
      </div>

      {tab === "lpo-management" && (
        <Card title="LPO Management" subtitle="Issue control" noPadding>
          <DataTable
            data={lpoRows}
            columns={[
              { header: "LPO #", accessor: "id", className: "font-mono font-bold" },
              { header: "Supplier", accessor: "vendorName", className: "font-bold text-[var(--text-primary)]" },
              { header: "Lines", accessor: (l: { lines: number }) => `${l.lines} SKUs`, className: "text-[var(--text-muted)]" },
              { header: "Total Amount", accessor: (l: LPORow) => `UGX ${l.totalAmount.toLocaleString()}`, className: "text-right font-mono font-black text-[var(--text-primary)]" },
              { header: "Status", accessor: "status", className: "text-[var(--text-muted)]" },
              { header: "Issued At", accessor: (l: LPORow) => new Date(l.issuedAt).toLocaleString(), className: "text-[var(--text-muted)]" },
              {
                header: "Action",
                accessor: (l: LPORow & { lines: number }) => (
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      disabled={l.status !== "DRAFT"}
                      isLoading={transitioningLpoId === l.id}
                      onClick={() => transitionLpo(l.id, "ISSUED")}
                    >
                      Issue
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={!(l.status === "DRAFT" || l.status === "ISSUED")}
                      isLoading={transitioningLpoId === l.id}
                      onClick={() => transitionLpo(l.id, "CANCELLED")}
                    >
                      Cancel
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setSelectedLpo(l)}>
                      View
                    </Button>
                  </div>
                ),
              },
            ]}
            emptyMessage="No LPOs available"
          />
        </Card>
      )}

      {tab === "grn-management" && (
        <Card title="GRN Register" subtitle="View only" noPadding>
          <DataTable
            data={filteredGrns}
            columns={[
              { header: "GRN #", accessor: "id", className: "font-mono font-bold" },
              { header: "LPO #", accessor: "lpoId", className: "font-mono" },
              { header: "Location", accessor: "locationName", className: "text-[var(--text-muted)]" },
              { header: "Lines", accessor: (g: GRNRow) => `${g.items.length} SKUs`, className: "text-[var(--text-muted)]" },
              { header: "Amount", accessor: (g: GRNRow) => `UGX ${g.totalAmount.toLocaleString()}`, className: "text-right font-mono font-black text-[var(--text-primary)]" },
              { header: "Status", accessor: "status", className: "text-[var(--text-muted)]" },
              { header: "Received At", accessor: (g: GRNRow) => new Date(g.receivedAt).toLocaleString(), className: "text-[var(--text-muted)]" },
              {
                header: "Action",
                accessor: (g: GRNRow) => (
                  <Button size="sm" variant="outline" onClick={() => setSelectedGrn(g)}>
                    View
                  </Button>
                ),
              },
            ]}
            emptyMessage="No GRNs available"
          />
        </Card>
      )}

      {tab === "vendor-invoices" && (
        <Card title="Vendor Invoice Table" noPadding>
          <DataTable<VendorInvoiceTableRow>
            data={filteredInvoices.map((i) => ({ ...i, paymentTerms: "30 DAYS", reconStatus: i.status === "PAID" ? "Reconciled" : "Open" }))}
            columns={[
              { header: "Invoice #", accessor: "id", className: "font-mono font-bold" },
              { header: "Vendor", accessor: "vendorName" },
              { header: "GRN #", accessor: "grnId", className: "font-mono" },
              { header: "Amount", accessor: (i: VendorInvoiceRow) => `UGX ${i.amount.toLocaleString()}`, className: "text-right font-mono font-black text-[var(--text-primary)]" },
              { header: "Due Date", accessor: (i: VendorInvoiceRow) => new Date(i.dueDate).toLocaleDateString() },
              { header: "Payment Terms", accessor: "paymentTerms" },
              { header: "Status", accessor: "status" },
              { header: "Recon Status", accessor: "reconStatus" },
            ]}
          />
        </Card>
      )}

      {tab === "vendor-ledger" && (
        <Card title="Vendor Ledger" noPadding>
          <DataTable
            data={filteredInvoices}
            columns={[
              { header: "Vendor", accessor: "vendorName" },
              { header: "Invoice #", accessor: "id", className: "font-mono" },
              { header: "Amount", accessor: (i: VendorInvoiceRow) => `UGX ${i.amount.toLocaleString()}`, className: "text-right font-mono font-black text-[var(--text-primary)]" },
              { header: "Due Date", accessor: (i: VendorInvoiceRow) => new Date(i.dueDate).toLocaleDateString() },
              { header: "Status", accessor: "status" },
            ]}
          />
        </Card>
      )}

      {tab === "purchase-reports" && (
        <div className="space-y-6">
          <Card title="Purchase Reports Filters">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <input readOnly value={filters.fromDate || ""} placeholder="Use global date" className="h-11 px-3 rounded-xl bg-[var(--input)] border border-[var(--input-border)] text-[var(--text-primary)]" />
              <input type="text" placeholder="Vendor Name" className="h-11 px-3 rounded-xl bg-[var(--input)] border border-[var(--input-border)] text-[var(--text-primary)]" />
            </div>
          </Card>
          <Card title="Purchase Report Matrix" noPadding>
            <DataTable<PurchaseReportRow>
              data={reportRows}
              columns={[
                { header: "Vendor Name", accessor: "vendor" },
                { header: "All Time Invoice Purchases", accessor: (r) => `UGX ${r.invoicePurchases.toLocaleString()}`, className: "text-right font-mono font-black text-[var(--text-primary)]" },
                { header: "Total Purchases Cash Only", accessor: (r) => `UGX ${r.cashOnly.toLocaleString()}`, className: "text-right font-mono font-black" },
                { header: "Total Paid So Far", accessor: (r) => `UGX ${r.totalPaid.toLocaleString()}`, className: "text-right font-mono font-black" },
                { header: "Balance", accessor: (r) => `UGX ${r.balance.toLocaleString()}`, className: "text-right font-mono font-black text-amber-300" },
                { header: "Opening/Modifications", accessor: "openingModifications" },
                { header: "Recon Status", accessor: "reconStatus" },
              ]}
            />
          </Card>
        </div>
      )}

      {tab === "variance-reconciliation" && (
        <Card title="Variance & Reconciliation" subtitle="Procurement variance shell aligned to role matrix">
          <div />
        </Card>
      )}

      {reqs.length === 0 && (
        <Card title="Requisition Source" subtitle="No requisitions in current scope">
          <div />
        </Card>
      )}

      <Modal open={!!selectedLpo} onClose={() => setSelectedLpo(null)} title={selectedLpo ? `LPO ${selectedLpo.id}` : undefined} size="lg">
        {selectedLpo && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="rounded-xl border border-[var(--border-subtle)] p-3">
                <div className="text-xs text-[var(--text-muted)]">Supplier</div>
                <div className="font-bold text-[var(--text-primary)]">{selectedLpo.vendorName}</div>
              </div>
              <div className="rounded-xl border border-[var(--border-subtle)] p-3">
                <div className="text-xs text-[var(--text-muted)]">Status</div>
                <div className="font-bold text-[var(--text-primary)]">{selectedLpo.status}</div>
              </div>
              <div className="rounded-xl border border-[var(--border-subtle)] p-3">
                <div className="text-xs text-[var(--text-muted)]">Total Amount</div>
                <div className="font-mono font-black text-[var(--text-primary)]">UGX {selectedLpo.totalAmount.toLocaleString()}</div>
              </div>
            </div>

            <Card title="Requisition Lines" noPadding>
              <DataTable
                data={mockDB.requisitionItems.filter((ri) => ri.requisitionId === selectedLpo.requisitionId).map((ri) => {
                  const item = mockDB.inventoryItems.find((i) => i.id === ri.itemId);
                  return {
                    id: ri.id,
                    sku: item?.sku ?? ri.itemId,
                    itemName: item?.name ?? ri.itemId,
                    quantity: ri.quantity,
                    estimatedPrice: ri.estimatedPrice,
                  };
                })}
                columns={[
                  { header: "SKU", accessor: "sku", className: "font-mono" },
                  { header: "Item", accessor: "itemName", className: "font-bold text-[var(--text-primary)]" },
                  { header: "Qty", accessor: (r: any) => r.quantity.toLocaleString(), className: "text-right font-mono font-black" },
                  { header: "Est. Price", accessor: (r: any) => `UGX ${Number(r.estimatedPrice || 0).toLocaleString()}`, className: "text-right font-mono font-black" },
                ]}
                emptyMessage="No requisition lines"
              />
            </Card>

            <ModalFooter>
              <Button variant="outline" onClick={() => setSelectedLpo(null)}>Close</Button>
            </ModalFooter>
          </div>
        )}
      </Modal>

      <Modal open={!!selectedGrn} onClose={() => setSelectedGrn(null)} title={selectedGrn ? `GRN ${selectedGrn.id}` : undefined} size="lg">
        {selectedGrn && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="rounded-xl border border-[var(--border-subtle)] p-3">
                <div className="text-xs text-[var(--text-muted)]">Location</div>
                <div className="font-bold text-[var(--text-primary)]">{selectedGrn.locationName}</div>
              </div>
              <div className="rounded-xl border border-[var(--border-subtle)] p-3">
                <div className="text-xs text-[var(--text-muted)]">Status</div>
                <div className="font-bold text-[var(--text-primary)]">{selectedGrn.status}</div>
              </div>
              <div className="rounded-xl border border-[var(--border-subtle)] p-3">
                <div className="text-xs text-[var(--text-muted)]">Amount</div>
                <div className="font-mono font-black text-[var(--text-primary)]">UGX {selectedGrn.totalAmount.toLocaleString()}</div>
              </div>
            </div>

            <Card title="Lines" noPadding>
              <DataTable
                data={selectedGrn.items.map((it, idx) => ({ id: `${selectedGrn.id}_${idx}`, ...it }))}
                columns={[
                  { header: "Item", accessor: "itemName", className: "font-bold text-[var(--text-primary)]" },
                  { header: "Qty", accessor: (r: any) => Number(r.quantity || 0).toLocaleString(), className: "text-right font-mono font-black" },
                  { header: "Unit Cost", accessor: (r: any) => `UGX ${Number(r.vendorPrice || 0).toLocaleString()}`, className: "text-right font-mono font-black" },
                ]}
                emptyMessage="No GRN lines"
              />
            </Card>

            <ModalFooter>
              <Button variant="outline" onClick={() => setSelectedGrn(null)}>Close</Button>
            </ModalFooter>
          </div>
        )}
      </Modal>
    </div>
  );
}
