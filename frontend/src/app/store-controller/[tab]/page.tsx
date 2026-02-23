"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { Download, Search } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { DataTable } from "@/components/ui/DataTable";
import { DashboardEmpty, DashboardError, DashboardLoading } from "@/components/dashboard/DashboardStates";
import { api } from "@/lib/api/client";
import { useAuth } from "@/contexts/AuthContext";
import { useGlobalDateFilters } from "@/contexts/GlobalDateFiltersContext";
import type { GRNRow, LPORow, VendorInvoiceRow } from "@/lib/api/services/procurement.service";
import type { StockMovementRow, StockLevelRow } from "@/lib/api/services/inventory.service";

type TabKey = "inventory-integrity" | "procurement-flow" | "department-stock";

const TAB_META: Record<TabKey, { title: string; subtitle: string }> = {
  "inventory-integrity": { title: "Inventory Integrity", subtitle: "Variance summary, monthly stock count, high movement items" },
  "procurement-flow": { title: "Procurement Flow Monitoring", subtitle: "3-way status alignment across the procurement chain" },
  "department-stock": { title: "Department Stock Overview", subtitle: "Department-level visibility: value, variance, pending operational items" },
};

type IntegrityRow = {
  id: string;
  itemName: string;
  sku: string;
  onHand: number;
  totalValue: number;
  lastUpdated: string;
};

type FlowRow = {
  id: string;
  lpo: string;
  grn: string;
  invoice: string;
  threeWayStatus: string;
  vendor: string;
  status: string;
};

type DepartmentStockRow = {
  id: string;
  department: string;
  totalStockValue: number;
  variance: number;
  pendingRequests: number;
  transfers: number;
};

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

export default function StoreControllerTabPage() {
  const params = useParams<{ tab: string }>();
  const tab = params.tab as TabKey;
  const config = TAB_META[tab];

  const { state } = useAuth();
  const { filters } = useGlobalDateFilters();

  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [stock, setStock] = useState<StockLevelRow[]>([]);
  const [movements, setMovements] = useState<StockMovementRow[]>([]);
  const [lpos, setLpos] = useState<LPORow[]>([]);
  const [grns, setGrns] = useState<GRNRow[]>([]);
  const [invoices, setInvoices] = useState<VendorInvoiceRow[]>([]);

  useEffect(() => {
    async function load() {
      if (!state.user) return;
      try {
        setLoading(true);
        setError(null);

        const [s, m, l, g, inv] = await Promise.all([
          api.inventory.getLocationStock(state.user),
          api.inventory.getMovementHistory(state.user),
          api.procurement.getLPOs(state.user),
          api.procurement.getGRNs(state.user),
          api.procurement.getVendorInvoices(state.user),
        ]);

        setStock(s);
        setMovements(m);
        setLpos(l);
        setGrns(g);
        setInvoices(inv);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Failed to load store controller view");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [state.user, filters.fromDate, filters.toDate, filters.location, tab]);

  const q = query.trim().toLowerCase();

  const integrityRows: IntegrityRow[] = useMemo(() => {
    const filtered = stock.filter((r) => {
      if (!q) return true;
      return r.itemName.toLowerCase().includes(q) || r.sku.toLowerCase().includes(q) || r.categoryName.toLowerCase().includes(q);
    });

    return filtered.map((r) => ({
      id: r.id,
      itemName: r.itemName,
      sku: r.sku,
      onHand: r.onHand,
      totalValue: r.totalValue,
      lastUpdated: new Date().toISOString(),
    }));
  }, [filters.fromDate, filters.toDate, q, stock]);

  const flowRows: FlowRow[] = useMemo(() => {
    const invoiceByGrn = new Map<string, VendorInvoiceRow>();
    for (const inv of invoices) {
      if (inv.grnId) invoiceByGrn.set(inv.grnId, inv);
    }

    const grnByLpo = new Map<string, GRNRow[]>();
    for (const g of grns) {
      const key = g.lpoId ?? "";
      if (!key) continue;
      const arr = grnByLpo.get(key) ?? [];
      arr.push(g);
      grnByLpo.set(key, arr);
    }

    const rows: FlowRow[] = [];

    const filteredLpos = lpos
      .filter((l) => withinRange({ from: filters.fromDate, to: filters.toDate, raw: l.issuedAt }))
      .filter((l) => {
        if (!q) return true;
        return (
          l.id.toLowerCase().includes(q) ||
          (l.vendorName ?? "").toLowerCase().includes(q) ||
          l.status.toLowerCase().includes(q)
        );
      })
      .slice(0, 100);

    for (const l of filteredLpos) {
      const gs = grnByLpo.get(l.id) ?? [];
      if (gs.length === 0) {
        rows.push({
          id: l.id,
          lpo: l.id,
          grn: "—",
          invoice: "—",
          vendor: l.vendorName ?? "—",
          threeWayStatus: "LPO_ONLY",
          status: String(l.status),
        });
        continue;
      }

      for (const g of gs) {
        const inv = invoiceByGrn.get(g.id);
        const threeWayStatus = inv ? (inv.status === "PAID" ? "MATCHED_PAID" : "MATCHED_PENDING") : "LPO_GRN_ONLY";
        rows.push({
          id: `${l.id}_${g.id}`,
          lpo: l.id,
          grn: g.id,
          invoice: inv?.id ?? "—",
          vendor: l.vendorName ?? "—",
          threeWayStatus,
          status: String(inv?.status ?? g.status),
        });
      }
    }

    return rows;
  }, [filters.fromDate, filters.toDate, grns, invoices, lpos, q]);

  const deptRows: DepartmentStockRow[] = useMemo(() => {
    const deptMap = new Map<string, { total: number; count: number }>();
    for (const move of movements) {
      if (!withinRange({ from: filters.fromDate, to: filters.toDate, raw: move.createdAt })) continue;
      const dept = move.referenceType ?? "UNKNOWN";
      const row = deptMap.get(dept) ?? { total: 0, count: 0 };
      row.total += Math.abs(move.quantity) * move.unitCost;
      row.count += 1;
      deptMap.set(dept, row);
    }

    const rows = Array.from(deptMap.entries()).map(([dept, v]) => ({
      id: dept,
      department: dept,
      totalStockValue: Math.round(v.total),
      variance: 0,
      pendingRequests: 0,
      transfers: 0,
    }));

    return rows
      .filter((r) => {
        if (!q) return true;
        return r.department.toLowerCase().includes(q);
      })
      .slice(0, 100);
  }, [filters.fromDate, filters.toDate, movements, q]);

  if (!config) return <DashboardError title="Store Controller" message="Tab not found" />;
  if (loading) return <DashboardLoading titleWidthClassName="w-1/3" />;
  if (error) return <DashboardError title={config.title} message={error} />;

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
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search" className="bg-transparent outline-none text-sm text-[var(--text-primary)]" />
          </label>
          <Button variant="outline" size="sm">
            <Download className="w-4 h-4 mr-2" />Export
          </Button>
        </div>
      </div>

      {tab === "inventory-integrity" && (
        <Card title="Inventory Integrity" subtitle="Read-only integrity view" noPadding>
          <DataTable
            data={integrityRows}
            columns={[
              { header: "Item", accessor: "itemName", className: "font-black text-[var(--text-primary)]" },
              { header: "SKU", accessor: "sku", className: "font-mono text-xs" },
              { header: "On Hand", accessor: (r: IntegrityRow) => r.onHand.toLocaleString(), className: "text-right font-mono font-black" },
              { header: "Valuation", accessor: (r: IntegrityRow) => `UGX ${r.totalValue.toLocaleString()}`, className: "text-right font-mono font-black" },
              { header: "Last Updated", accessor: (r: IntegrityRow) => new Date(r.lastUpdated).toLocaleDateString(), className: "text-right" },
            ]}
            emptyMessage="No inventory integrity rows"
          />
        </Card>
      )}

      {tab === "procurement-flow" && (
        <Card title="Procurement Flow Monitoring" subtitle="Read-only 3-way alignment" noPadding>
          <DataTable
            data={flowRows}
            columns={[
              { header: "LPO", accessor: "lpo", className: "font-mono text-xs" },
              { header: "GRN", accessor: "grn", className: "font-mono text-xs" },
              { header: "Invoice", accessor: "invoice", className: "font-mono text-xs" },
              { header: "3-Way Status", accessor: "threeWayStatus", className: "font-black text-[var(--text-primary)]" },
              { header: "Vendor", accessor: "vendor" },
              { header: "Status", accessor: "status", className: "font-black" },
            ]}
            emptyMessage="No procurement flow rows"
          />
        </Card>
      )}

      {tab === "department-stock" && (
        <Card title="Department Stock Overview" subtitle="Read-only overview" noPadding>
          <DataTable
            data={deptRows}
            columns={[
              { header: "Department", accessor: "department", className: "font-black text-[var(--text-primary)]" },
              { header: "Total Stock Value", accessor: (r: DepartmentStockRow) => `UGX ${r.totalStockValue.toLocaleString()}`, className: "text-right font-mono font-black" },
              { header: "Variance", accessor: (r: DepartmentStockRow) => `UGX ${r.variance.toLocaleString()}`, className: "text-right font-mono font-black" },
              { header: "Pending Requests", accessor: (r: DepartmentStockRow) => r.pendingRequests.toLocaleString(), className: "text-right font-mono font-black" },
              { header: "Transfers", accessor: (r: DepartmentStockRow) => r.transfers.toLocaleString(), className: "text-right font-mono font-black" },
            ]}
            emptyMessage="No department stock rows"
          />
        </Card>
      )}
    </div>
  );
}
