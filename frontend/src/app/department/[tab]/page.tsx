"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Download, Search } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { DataTable } from "@/components/ui/DataTable";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Modal, ModalFooter } from "@/components/ui/Modal";
import { DashboardError, DashboardLoading } from "@/components/dashboard/DashboardStates";
import { StatusBadge } from "@/components/core/StatusBadge";
import { api } from "@/lib/api/client";
import { useAuth } from "@/contexts/AuthContext";
import { useGlobalDateFilters } from "@/contexts/GlobalDateFiltersContext";
import { mockDB } from "@/lib/mock-db";
import type { RequisitionRow } from "@/lib/api/services/procurement.service";
import type { StockTransferRow } from "@/lib/api/services/inventory.service";

type TabKey = "stock-requests" | "transfers" | "performance";

const DEPT_TABS: { href: string; label: string }[] = [
  { href: "/department/dashboard", label: "Department Dashboard" },
  { href: "/department/requisitions", label: "Requisitions" },
  { href: "/department/stock-requests", label: "Stock Requests" },
  { href: "/department/transfers", label: "Transfers" },
  { href: "/department/performance", label: "Performance" },
];

const TAB_META: Record<TabKey, { title: string; subtitle: string }> = {
  "stock-requests": { title: "Stock Requests", subtitle: "Department requisitions and stock demand" },
  transfers: { title: "Transfers", subtitle: "Inter-location transfer tracking" },
  performance: { title: "Performance", subtitle: "Operational performance overview" },
};

type StockRequestRow = RequisitionRow;

function withinRange(params: { from?: string; to?: string; raw?: string }) {
  const { from, to, raw } = params;
  if (!from && !to) return true;
  if (!raw) return false;
  const t = new Date(raw).getTime();
  if (Number.isNaN(t)) return false;
  const fromT = from ? new Date(from).getTime() : undefined;
  const toT = to ? new Date(to).getTime() : undefined;
  if (fromT !== undefined && t < fromT) return false;
  if (toT !== undefined && t > toT) return false;
  return true;
}

export default function DepartmentTabPage() {
  const params = useParams<{ tab: string }>();
  const tab = params.tab as TabKey;
  const config = TAB_META[tab];
  const { state } = useAuth();
  const { filters } = useGlobalDateFilters();
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [requests, setRequests] = useState<StockRequestRow[]>([]);
  const [transfers, setTransfers] = useState<StockTransferRow[]>([]);

  const [createOpen, setCreateOpen] = useState(false);
  const [createItemId, setCreateItemId] = useState("");
  const [createQty, setCreateQty] = useState("1");
  const [createEstimatedPrice, setCreateEstimatedPrice] = useState("0");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      if (!state.user) return;
      try {
        setError(null);
        setLoading(true);
        if (tab === "stock-requests") {
          const res = await api.procurement.getRequisitions(state.user);
          setRequests(res);
        } else if (tab === "transfers") {
          const res = await api.inventory.getStockTransfers(state.user);
          setTransfers(res);
        } else {
          await api.department.getDashboard(state.user);
        }
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Failed to load department tab");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [state.user, tab]);

  const q = query.trim().toLowerCase();

  const requestRows = useMemo(() => {
    return requests
      .filter((r) => withinRange({ from: filters.fromDate, to: filters.toDate, raw: r.createdAt }))
      .filter((r) => {
        if (!q) return true;
        return (
          r.id.toLowerCase().includes(q) ||
          r.departmentName.toLowerCase().includes(q) ||
          r.requestedByName.toLowerCase().includes(q) ||
          String(r.status).toLowerCase().includes(q)
        );
      })
      .slice(0, 200);
  }, [filters.fromDate, filters.toDate, q, requests]);

  const transferRows = useMemo(() => {
    return transfers
      .filter((t) => withinRange({ from: filters.fromDate, to: filters.toDate, raw: t.requestedAt }))
      .filter((t) => {
        if (!q) return true;
        return (
          t.id.toLowerCase().includes(q) ||
          t.sourceLocationName.toLowerCase().includes(q) ||
          t.destinationLocationName.toLowerCase().includes(q) ||
          t.itemName.toLowerCase().includes(q) ||
          String(t.status).toLowerCase().includes(q)
        );
      })
      .slice(0, 200);
  }, [filters.fromDate, filters.toDate, q, transfers]);

  const inventoryOptions = useMemo(() => {
    return mockDB.inventoryItems
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((i) => ({ value: i.id, label: `${i.name} (${i.sku})` }));
  }, []);

  async function submitCreateStockRequest() {
    if (!state.user) return;
    setCreateError(null);
    setCreating(true);
    try {
      const qty = Number(createQty);
      const est = Number(createEstimatedPrice);
      if (!createItemId) throw new Error("Select an item");
      if (!Number.isFinite(qty) || qty <= 0) throw new Error("Quantity must be greater than 0");
      if (!Number.isFinite(est) || est < 0) throw new Error("Estimated price must be 0 or greater");

      await api.department.createRequisition(state.user, {
        items: [{ itemId: createItemId, quantity: qty, estimatedPrice: est }],
      });

      const res = await api.procurement.getRequisitions(state.user);
      setRequests(res);
      setCreateOpen(false);
      setCreateItemId("");
      setCreateQty("1");
      setCreateEstimatedPrice("0");
    } catch (e: unknown) {
      setCreateError(e instanceof Error ? e.message : "Failed to create stock request");
    } finally {
      setCreating(false);
    }
  }

  if (!config) return <DashboardError title="Department" message="Tab not found" />;
  if (loading) return <DashboardLoading titleWidthClassName="w-1/3" />;
  if (error) return <DashboardError title={config.title} message={error} />;

  return (
    <div className="p-8 space-y-8 max-w-[1600px] mx-auto">
      <div className="overflow-x-auto">
        <div className="flex gap-2 min-w-max border-b border-[var(--border-subtle)] pb-2">
          {DEPT_TABS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={item.href.endsWith(`/${tab}`) ? "px-3 py-2 rounded-xl bg-[var(--surface-raised)] text-[var(--text-primary)] text-xs font-black uppercase tracking-wider" : "px-3 py-2 rounded-xl text-[var(--text-muted)] hover:text-[var(--text-primary)] text-xs font-black uppercase tracking-wider"}
            >
              {item.label}
            </Link>
          ))}
        </div>
      </div>

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
          {tab === "stock-requests" && (
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              New Stock Request
            </Button>
          )}
          <Button variant="outline" size="sm"><Download className="w-4 h-4 mr-2" />Export</Button>
        </div>
      </div>

      {tab === "stock-requests" && (
        <Card title="Stock Requests" subtitle="Department requisitions" noPadding>
          <DataTable<StockRequestRow>
            data={requestRows}
            columns={[
              { header: "Request ID", accessor: "id", className: "font-mono font-bold" },
              { header: "Department", accessor: "departmentName", className: "font-bold text-[var(--text-primary)]" },
              { header: "Created By", accessor: "requestedByName", className: "text-[var(--text-muted)]" },
              { header: "Location", accessor: "locationName", className: "text-[var(--text-muted)]" },
              { header: "Items", accessor: (r: StockRequestRow) => `${r.itemCount} SKUs`, className: "text-[var(--text-muted)]" },
              {
                header: "Value",
                accessor: (r: StockRequestRow) => `UGX ${r.totalAmount.toLocaleString()}`,
                className: "font-black text-right",
              },
              {
                header: "Status",
                accessor: (r: StockRequestRow) => (
                  <StatusBadge
                    label={String(r.status)}
                    tone={r.status === "SUBMITTED" ? "warn" : r.status === "APPROVED" ? "good" : "neutral"}
                  />
                ),
              },
              { header: "Created At", accessor: (r: StockRequestRow) => new Date(r.createdAt).toLocaleString(), className: "text-[var(--text-muted)]" },
              {
                header: "Action",
                accessor: (r: StockRequestRow) => (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setQuery(r.id);
                    }}
                  >
                    Focus
                  </Button>
                ),
              },
            ]}
            emptyMessage="No stock requests found"
          />
        </Card>
      )}

      {tab === "transfers" && (
        <Card title="Transfers" subtitle="Stock transfers involving your location" noPadding>
          <DataTable<StockTransferRow>
            data={transferRows}
            columns={[
              { header: "Transfer ID", accessor: "id", className: "font-mono font-bold" },
              { header: "From", accessor: "sourceLocationName", className: "text-[var(--text-muted)]" },
              { header: "To", accessor: "destinationLocationName", className: "text-[var(--text-muted)]" },
              { header: "Item", accessor: "itemName", className: "font-bold text-[var(--text-primary)]" },
              { header: "Qty", accessor: (t: StockTransferRow) => t.quantity.toLocaleString(), className: "font-black text-right" },
              { header: "Status", accessor: "status", className: "text-[var(--text-muted)]" },
              { header: "Requested", accessor: (t: StockTransferRow) => new Date(t.requestedAt).toLocaleString(), className: "text-[var(--text-muted)]" },
              { header: "Completed", accessor: (t: StockTransferRow) => (t.completedAt ? new Date(t.completedAt).toLocaleString() : "—"), className: "text-[var(--text-muted)]" },
            ]}
            emptyMessage="No transfers found"
          />
        </Card>
      )}

      {tab === "performance" && (
        <Card title="Performance" subtitle="Department overview" noPadding>
          <div className="p-6 text-sm text-[var(--text-secondary)]">No performance records found.</div>
        </Card>
      )}

      <Modal
        open={createOpen}
        onClose={() => {
          if (creating) return;
          setCreateOpen(false);
          setCreateError(null);
        }}
        title="New Stock Request"
        description="Create a department requisition"
        size="lg"
      >
        <div className="space-y-4">
          <Select
            label="Item"
            value={createItemId}
            onChange={(e) => setCreateItemId(e.target.value)}
            options={inventoryOptions}
            placeholder="Select item"
          />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input label="Quantity" value={createQty} onChange={(e) => setCreateQty(e.target.value)} inputMode="numeric" />
            <Input label="Estimated Price" value={createEstimatedPrice} onChange={(e) => setCreateEstimatedPrice(e.target.value)} inputMode="numeric" />
          </div>
          {createError && <div className="text-sm text-rose-300">{createError}</div>}
          <ModalFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)} disabled={creating}>
              Cancel
            </Button>
            <Button onClick={submitCreateStockRequest} isLoading={creating}>
              Create
            </Button>
          </ModalFooter>
        </div>
      </Modal>
    </div>
  );
}
