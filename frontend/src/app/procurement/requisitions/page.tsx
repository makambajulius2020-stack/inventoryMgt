"use client";

import React, { useEffect, useState } from "react";
import { Download, Search } from "lucide-react";

import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { DataTable } from "@/components/ui/DataTable";
import { StatusBadge } from "@/components/core/StatusBadge";
import { DashboardEmpty, DashboardError, DashboardLoading } from "@/components/dashboard/DashboardStates";
import { Modal, ModalFooter } from "@/components/ui/Modal";
import { api } from "@/lib/api/client";
import { useAuth } from "@/contexts/AuthContext";
import { useGlobalDateFilters } from "@/contexts/GlobalDateFiltersContext";
import { mockDB } from "@/lib/mock-db";
import type { RequisitionDetail, RequisitionRow } from "@/lib/api/services/procurement.service";

export default function ProcurementRequisitionsPage() {
  const { state } = useAuth();
  const { filters } = useGlobalDateFilters();
  const [data, setData] = useState<RequisitionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [accessError, setAccessError] = useState<string | null>(null);

  const [query, setQuery] = useState("");
  const [transitioningId, setTransitioningId] = useState<string | null>(null);
  const [lpoOpen, setLpoOpen] = useState(false);
  const [lpoReq, setLpoReq] = useState<RequisitionDetail | null>(null);
  const [lpoVendorId, setLpoVendorId] = useState("");
  const [lpoExpectedDelivery, setLpoExpectedDelivery] = useState("");
  const [lpoCreating, setLpoCreating] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        setAccessError(null);
        if (!state.user) return;
        const res = await api.procurement.getRequisitions(state.user);
        setData(res);
      } catch (e: unknown) {
        setAccessError(e instanceof Error ? e.message : "Access denied");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [state.user]);

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

  const filtered = data
    .filter((r) => withinRange(r.createdAt))
    .map((r) => {
      const items = mockDB.requisitionItems.filter((ri) => ri.requisitionId === r.id);
      const totalQty = items.reduce((s, it) => s + it.quantity, 0);
      return { ...r, lines: items.length, totalQty };
    })
    .filter((r) => {
      if (!q) return true;
      return (
        r.id.toLowerCase().includes(q) ||
        r.departmentName.toLowerCase().includes(q) ||
        r.requestedByName.toLowerCase().includes(q) ||
        r.status.toLowerCase().includes(q)
      );
    })
    .slice(0, 300);

  const vendors = mockDB.vendors
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((v) => ({ value: v.id, label: v.name }));

  const transition = async (requisitionId: string, newStatus: "APPROVED" | "REJECTED") => {
    if (!state.user) return;
    try {
      setTransitioningId(requisitionId);
      await api.procurement.transitionRequisition(state.user, requisitionId, newStatus);
      const next = await api.procurement.getRequisitions(state.user);
      setData(next);
    } catch (e: unknown) {
      setAccessError(e instanceof Error ? e.message : "Failed to update requisition");
    } finally {
      setTransitioningId(null);
    }
  };

  const openConvertToLpo = async (row: RequisitionRow) => {
    if (!state.user) return;
    try {
      setAccessError(null);
      const detail = await api.procurement.getRequisitionDetail(state.user, row.id);
      setLpoReq(detail);
      setLpoVendorId("");
      setLpoExpectedDelivery(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10));
      setLpoOpen(true);
    } catch (e: unknown) {
      setAccessError(e instanceof Error ? e.message : "Failed to load requisition detail");
    }
  };

  const createLpo = async () => {
    if (!state.user || !lpoReq) return;
    if (!lpoVendorId) return;
    const reqLocationId = mockDB.requisitions.find((r) => r.id === lpoReq.id)?.locationId;
    const locationId = reqLocationId ?? state.user.scope.locationId;
    if (!locationId) {
      setAccessError("Cannot create LPO: location scope not available");
      return;
    }
    try {
      setLpoCreating(true);
      await api.procurement.createLPO(state.user, {
        requisitionId: lpoReq.id,
        vendorId: lpoVendorId,
        locationId,
        totalAmount: lpoReq.totalAmount,
        expectedDelivery: lpoExpectedDelivery || new Date().toISOString().slice(0, 10),
      });

      const next = await api.procurement.getRequisitions(state.user);
      setData(next);
      setLpoOpen(false);
    } catch (e: unknown) {
      setAccessError(e instanceof Error ? e.message : "Failed to create LPO");
    } finally {
      setLpoCreating(false);
    }
  };

  if (loading) return <DashboardLoading titleWidthClassName="w-1/3" />;
  if (accessError) return <DashboardError title="Procurement Requisitions" message={accessError} />;
  if (!data) return <DashboardEmpty title="Procurement Requisitions" message="No requisitions available." />;

  return (
    <div className="p-8 space-y-8 max-w-[1600px] mx-auto">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-[var(--text-primary)] tracking-tighter uppercase">Requisitions</h1>
          <p className="text-[var(--text-secondary)] font-medium">Incoming from departments</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="h-9 px-3 rounded-xl bg-[var(--input)] border border-[var(--input-border)] inline-flex items-center gap-2 text-[var(--text-muted)]">
            <Search className="w-4 h-4" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Quick search" className="bg-transparent outline-none text-sm text-[var(--text-primary)]" />
          </label>
          <Button variant="outline" size="sm"><Download className="w-4 h-4 mr-2" />Export</Button>
        </div>
      </div>

      <Card title="Requisition Intake" subtitle="Approval + conversion" noPadding>
        <DataTable
          data={filtered}
          columns={[
            { header: "Request #", accessor: "id", className: "font-mono font-bold" },
            { header: "Department", accessor: "departmentName", className: "font-bold text-[var(--text-primary)]" },
            { header: "Requested By", accessor: "requestedByName", className: "text-[var(--text-muted)]" },
            { header: "Lines", accessor: (r: any) => `${r.lines} SKUs`, className: "text-[var(--text-muted)]" },
            { header: "Total Qty", accessor: (r: any) => Number(r.totalQty || 0).toLocaleString(), className: "text-right font-mono font-black" },
            {
              header: "Status",
              accessor: (r: RequisitionRow) => <StatusBadge label={r.status} tone={r.status === "SUBMITTED" ? "warn" : r.status === "APPROVED" ? "good" : "neutral"} />,
            },
            { header: "Created At", accessor: (r: RequisitionRow) => new Date(r.createdAt).toLocaleString(), className: "text-[var(--text-muted)]" },
            {
              header: "Action",
              accessor: (r: RequisitionRow) => (
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    disabled={r.status !== "SUBMITTED"}
                    isLoading={transitioningId === r.id}
                    onClick={() => transition(r.id, "APPROVED")}
                  >
                    Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={r.status !== "SUBMITTED"}
                    isLoading={transitioningId === r.id}
                    onClick={() => transition(r.id, "REJECTED")}
                  >
                    Reject
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={r.status !== "APPROVED"}
                    onClick={() => openConvertToLpo(r)}
                  >
                    Convert to LPO
                  </Button>
                </div>
              ),
            },
          ]}
          emptyMessage="No requisitions available"
        />
      </Card>

      <Modal open={lpoOpen} onClose={() => setLpoOpen(false)} title={lpoReq ? `Convert ${lpoReq.id} to LPO` : undefined} size="lg">
        {lpoReq && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="rounded-xl border border-[var(--border-subtle)] p-3">
                <div className="text-xs text-[var(--text-muted)]">Department</div>
                <div className="font-bold text-[var(--text-primary)]">{lpoReq.departmentName}</div>
              </div>
              <div className="rounded-xl border border-[var(--border-subtle)] p-3">
                <div className="text-xs text-[var(--text-muted)]">Total Amount</div>
                <div className="font-mono font-black text-[var(--text-primary)]">UGX {lpoReq.totalAmount.toLocaleString()}</div>
              </div>
            </div>

            <Card title="Lines" noPadding>
              <DataTable
                data={lpoReq.items.map((it, idx) => ({ id: `${lpoReq.id}_${idx}`, ...it }))}
                columns={[
                  { header: "SKU", accessor: "sku", className: "font-mono" },
                  { header: "Item", accessor: "itemName", className: "font-bold text-[var(--text-primary)]" },
                  { header: "Qty", accessor: (r: any) => Number(r.quantity || 0).toLocaleString(), className: "text-right font-mono font-black" },
                  { header: "Est. Price", accessor: (r: any) => `UGX ${Number(r.estimatedPrice || 0).toLocaleString()}`, className: "text-right font-mono font-black" },
                ]}
                emptyMessage="No lines"
              />
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <label className="space-y-1">
                <div className="text-xs font-bold text-[var(--text-muted)] uppercase">Supplier</div>
                <select value={lpoVendorId} onChange={(e) => setLpoVendorId(e.target.value)} className="h-11 w-full px-3 rounded-xl bg-[var(--input)] border border-[var(--input-border)] text-[var(--text-primary)]">
                  <option value="">Select supplier</option>
                  {vendors.map((v) => (
                    <option key={v.value} value={v.value}>
                      {v.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-1">
                <div className="text-xs font-bold text-[var(--text-muted)] uppercase">Expected Delivery</div>
                <input value={lpoExpectedDelivery} onChange={(e) => setLpoExpectedDelivery(e.target.value)} type="date" className="h-11 w-full px-3 rounded-xl bg-[var(--input)] border border-[var(--input-border)] text-[var(--text-primary)]" />
              </label>
            </div>

            <ModalFooter>
              <Button variant="outline" onClick={() => setLpoOpen(false)}>Cancel</Button>
              <Button disabled={!lpoVendorId} isLoading={lpoCreating} onClick={createLpo}>Create LPO</Button>
            </ModalFooter>
          </div>
        )}
      </Modal>
    </div>
  );
}
