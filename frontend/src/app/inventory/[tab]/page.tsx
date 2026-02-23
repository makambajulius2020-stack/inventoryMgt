"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { Download, Search } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { DataTable } from "@/components/ui/DataTable";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Modal, ModalFooter } from "@/components/ui/Modal";
import { DashboardError, DashboardLoading } from "@/components/dashboard/DashboardStates";
import { api } from "@/lib/api/client";
import { useAuth } from "@/contexts/AuthContext";
import { useGlobalDateFilters } from "@/contexts/GlobalDateFiltersContext";
import { mockDB } from "@/lib/mock-db";
import type { DepartmentStockRow, StockLevelRow, StockMovementRow, StockTransferRow } from "@/lib/api/services/inventory.service";
import type { GRNRow, LPORow, RequisitionDetail, RequisitionRow } from "@/lib/api/services/procurement.service";

type TabKey =
  | "grn-stock-entry"
  | "department-stock-requests"
  | "department-stock"
  | "location-inventory"
  | "stock-transfers"
  | "adjustments"
  | "monthly-stock-count"
  | "inventory-valuation"
  | "reports";

const TAB_META: Record<TabKey, { title: string; subtitle: string }> = {
  "grn-stock-entry": { title: "GRN Stock Entry", subtitle: "Goods received notes intake" },
  "department-stock-requests": { title: "Department Stock Requests", subtitle: "Approval and fulfillment" },
  "department-stock": { title: "Department Stock", subtitle: "Departmental issue balances" },
  "location-inventory": { title: "Location Inventory", subtitle: "Ledger-derived visibility" },
  "stock-transfers": { title: "Stock Transfers", subtitle: "Inter-location transfer register" },
  adjustments: { title: "Adjustments", subtitle: "Manual stock adjustment register" },
  "monthly-stock-count": { title: "Monthly Stock Count", subtitle: "Month-end count and variance" },
  "inventory-valuation": { title: "Inventory Valuation", subtitle: "Category-level valuation structure" },
  reports: { title: "Reports", subtitle: "Inventory report exports" },
};

type StockRequestStatusLabel = "PENDING" | "APPROVED" | "REJECTED" | "FULFILLED" | "CANCELLED" | "DRAFT";

type TransferStatusLabel = "PENDING" | "APPROVED" | "REJECTED" | "COMPLETED";

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

type MonthlyCountRow = {
  id: string;
  category: string;
  item: string;
  uom: string;
  packaging: string;
  fetched: number;
  received: number;
  taken: number;
  department: string;
  closing: number;
  endOfMonthCount: number;
  variance: number;
  reason: string;
};

type InventoryValuationRow = {
  id: string;
  categoryName: string;
  itemCount: number;
  totalValue: number;
};

type LocationInventoryRow = {
  id: string;
  locationName: string;
  itemName: string;
  categoryName: string;
  uom: string;
  opening: number;
  received: number;
  issued: number;
  transferIn: number;
  transferOut: number;
  adjustments: number;
  closing: number;
  lastMovementAt?: string;
};

export default function InventoryTabPage() {
  const params = useParams<{ tab: string }>();
  const tab = params.tab as TabKey;
  const config = TAB_META[tab];
  const { state } = useAuth();
  const { filters } = useGlobalDateFilters();

  const [query, setQuery] = useState("");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [locationStock, setLocationStock] = useState<StockLevelRow[]>([]);
  const [departmentStock, setDepartmentStock] = useState<DepartmentStockRow[]>([]);
  const [movements, setMovements] = useState<StockMovementRow[]>([]);
  const [transfers, setTransfers] = useState<StockTransferRow[]>([]);
  const [valuation, setValuation] = useState<{ categoryName: string; totalValue: number; itemCount: number }[]>([]);

  const [lpos, setLpos] = useState<LPORow[]>([]);
  const [grns, setGrns] = useState<GRNRow[]>([]);

  const [reqs, setReqs] = useState<RequisitionRow[]>([]);
  const [viewOpen, setViewOpen] = useState(false);
  const [viewId, setViewId] = useState<string | null>(null);
  const [viewLoading, setViewLoading] = useState(false);
  const [viewDetail, setViewDetail] = useState<RequisitionDetail | null>(null);
  const [actionId, setActionId] = useState<string | null>(null);

  const [transferCreateOpen, setTransferCreateOpen] = useState(false);
  const [transferDestinationId, setTransferDestinationId] = useState("");
  const [transferItems, setTransferItems] = useState<Array<{ itemId: string; quantity: string }>>([
    { itemId: "", quantity: "1" },
  ]);
  const [transferCreating, setTransferCreating] = useState(false);
  const [transferCreateError, setTransferCreateError] = useState<string | null>(null);

  const [transferActionId, setTransferActionId] = useState<string | null>(null);
  const [transferViewOpen, setTransferViewOpen] = useState(false);
  const [transferViewId, setTransferViewId] = useState<string | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [createLpoId, setCreateLpoId] = useState("");
  const [createItems, setCreateItems] = useState<Array<{ itemId: string; quantity: string; vendorPrice: string }>>([
    { itemId: "", quantity: "1", vendorPrice: "0" },
  ]);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [receivingId, setReceivingId] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      if (!state.user) return;
      try {
        setLoading(true);
        setError(null);
        const [stockRows, deptRows, movementRows, transferRows, valuationRows] = await Promise.all([
          api.inventory.getLocationStock(state.user!),
          api.inventory.getDepartmentStock(state.user!),
          api.inventory.getMovementHistory(state.user!),
          api.inventory.getStockTransfers(state.user!),
          api.inventory.getStockValuation(state.user!),
        ]);
        setLocationStock(stockRows);
        setDepartmentStock(deptRows);
        setMovements(movementRows);
        setTransfers(transferRows);
        setValuation(valuationRows);

        if (tab === "grn-stock-entry") {
          const [lpoRows, grnRows] = await Promise.all([
            api.procurement.getLPOs(state.user),
            api.procurement.getGRNs(state.user),
          ]);
          setLpos(lpoRows);
          setGrns(grnRows);
        }

        if (tab === "department-stock-requests") {
          const requisitions = await api.procurement.getRequisitions(state.user);
          setReqs(requisitions);
        }
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Failed to load inventory tab");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [state.user, tab]);

  const q = query.trim().toLowerCase();

  const filteredDepartmentStock = useMemo(() => {
    return departmentStock
      .filter((d) => {
        if (!q) return true;
        return (
          d.departmentName.toLowerCase().includes(q) ||
          d.itemName.toLowerCase().includes(q) ||
          d.sku.toLowerCase().includes(q)
        );
      })
      .slice(0, 200);
  }, [departmentStock, q]);

  const filteredTransfers = useMemo(() => {
    return transfers
      .filter((t) => withinRange({ from: filters.fromDate, to: filters.toDate, raw: t.completedAt ?? t.requestedAt }))
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

  const transferRows = useMemo(() => {
    const byTransferId = new Map<string, typeof mockDB.stockTransfers[number]>();
    for (const t of mockDB.stockTransfers) byTransferId.set(t.id, t);

    return filteredTransfers
      .map((t) => {
        const raw = byTransferId.get(t.id);
        const requestedByName = raw?.requestedById
          ? mockDB.users.find((u) => u.id === raw.requestedById)?.name ?? "System"
          : "System";

        const lines = mockDB.stockTransferItems.filter((i) => i.stockTransferId === t.id);
        const lineCount = lines.length > 0 ? lines.length : 1;
        const totalQty = lines.length > 0 ? lines.reduce((s, i) => s + i.quantity, 0) : t.quantity;

        const statusLabel: TransferStatusLabel = t.completedAt
          ? "COMPLETED"
          : String(t.status).toUpperCase() === "REJECTED"
            ? "REJECTED"
            : String(t.status).toUpperCase() === "PENDING"
              ? "PENDING"
              : "APPROVED";

        return {
          ...t,
          requestedByName,
          lineCount,
          totalQty,
          statusLabel,
        };
      })
      .slice(0, 200);
  }, [filteredTransfers]);

  const locationInventoryRows = useMemo((): LocationInventoryRow[] => {
    const user = state.user;
    if (!user) return [];

    const from = filters.fromDate;
    const to = filters.toDate;
    const fromTs = from ? new Date(from).getTime() : undefined;
    const toTs = to ? new Date(to).getTime() : undefined;

    // Respect scope
    const scopeMovements = mockDB.stockMovements.filter((m) => {
      if (user.scope.allLocations) return true;
      return m.locationId === user.scope.locationId;
    });

    const beforeRange = scopeMovements.filter((m) => {
      if (fromTs === undefined) return false;
      const t = new Date(m.createdAt).getTime();
      return !Number.isNaN(t) && t < fromTs;
    });

    const inRange = scopeMovements.filter((m) => {
      const t = new Date(m.createdAt).getTime();
      if (Number.isNaN(t)) return false;
      if (fromTs !== undefined && t < fromTs) return false;
      if (toTs !== undefined && t > toTs) return false;
      return true;
    });

    type Agg = {
      locationId: string;
      itemId: string;
      opening: number;
      received: number;
      issued: number;
      transferIn: number;
      transferOut: number;
      adjustments: number;
      lastMovementAt?: string;
    };

    const byKey = new Map<string, Agg>();
    const ensure = (locationId: string, itemId: string) => {
      const key = `${locationId}::${itemId}`;
      const curr = byKey.get(key);
      if (curr) return curr;
      const fresh: Agg = {
        locationId,
        itemId,
        opening: 0,
        received: 0,
        issued: 0,
        transferIn: 0,
        transferOut: 0,
        adjustments: 0,
        lastMovementAt: undefined,
      };
      byKey.set(key, fresh);
      return fresh;
    };

    // Compute opening balance at range start by netting all movements before range
    for (const m of beforeRange) {
      const a = ensure(m.locationId, m.inventoryItemId);
      const type = m.type;
      if (type === "OPENING_BALANCE") a.opening += m.quantity;
      else if (type === "PURCHASE_RECEIPT") a.opening += m.quantity;
      else if (type === "TRANSFER_IN") a.opening += m.quantity;
      else if (type === "TRANSFER_OUT") a.opening -= m.quantity;
      else if (type === "DEPARTMENT_ISSUE") a.opening -= m.quantity;
      else if (type === "ADJUSTMENT") a.opening += m.quantity;
    }

    // Aggregate movements within range
    for (const m of inRange) {
      const a = ensure(m.locationId, m.inventoryItemId);
      const type = m.type;
      if (type === "OPENING_BALANCE") {
        // Treat as opening event inside range (counts as opening)
        a.opening += m.quantity;
      } else if (type === "PURCHASE_RECEIPT") a.received += m.quantity;
      else if (type === "TRANSFER_IN") a.transferIn += m.quantity;
      else if (type === "TRANSFER_OUT") a.transferOut += m.quantity;
      else if (type === "DEPARTMENT_ISSUE") a.issued += m.quantity;
      else if (type === "ADJUSTMENT") a.adjustments += m.quantity;

      if (!a.lastMovementAt || new Date(m.createdAt).getTime() > new Date(a.lastMovementAt).getTime()) {
        a.lastMovementAt = m.createdAt;
      }
    }

    const qLocal = q;

    const rows: LocationInventoryRow[] = [];
    for (const a of byKey.values()) {
      const loc = mockDB.locations.find((l) => l.id === a.locationId);
      const item = mockDB.inventoryItems.find((i) => i.id === a.itemId);
      const categoryName = item ? (mockDB.categories.find((c) => c.id === item.categoryId)?.name ?? "Uncategorized") : "Uncategorized";

      const closing =
        a.opening +
        a.received +
        a.transferIn -
        a.issued -
        a.transferOut +
        a.adjustments;

      const row: LocationInventoryRow = {
        id: `linv_${a.locationId}_${a.itemId}`,
        locationName: loc?.name ?? a.locationId,
        itemName: item?.name ?? a.itemId,
        categoryName,
        uom: item?.uom ?? "",
        opening: a.opening,
        received: a.received,
        issued: a.issued,
        transferIn: a.transferIn,
        transferOut: a.transferOut,
        adjustments: a.adjustments,
        closing,
        lastMovementAt: a.lastMovementAt,
      };

      if (qLocal) {
        const hay = `${row.locationName} ${row.itemName} ${row.categoryName}`.toLowerCase();
        if (!hay.includes(qLocal)) continue;
      }

      // Hide fully-zero rows in-range unless they have any movement recorded
      const hasActivity = row.received !== 0 || row.issued !== 0 || row.transferIn !== 0 || row.transferOut !== 0 || row.adjustments !== 0;
      if (!hasActivity && fromTs !== undefined) {
        // If user filtered by date, only show rows with activity in that range
        continue;
      }

      rows.push(row);
    }

    // Sort: location then item
    rows.sort((a, b) => {
      const lc = a.locationName.localeCompare(b.locationName);
      if (lc !== 0) return lc;
      return a.itemName.localeCompare(b.itemName);
    });

    return rows.slice(0, 500);
  }, [filters.fromDate, filters.toDate, q, state.user]);

  const locationOptions = useMemo(() => {
    const sourceId = state.user?.scope.locationId;
    return mockDB.locations
      .filter((l) => l.status === "ACTIVE")
      .filter((l) => !sourceId || l.id !== sourceId)
      .map((l) => ({ value: l.id, label: `${l.name} (${l.code})` }));
  }, [state.user?.scope.locationId]);

  async function refreshTransfersAndInventory() {
    if (!state.user) return;
    const [transferRows, stockRows, movementRows] = await Promise.all([
      api.inventory.getStockTransfers(state.user),
      api.inventory.getLocationStock(state.user),
      api.inventory.getMovementHistory(state.user),
    ]);
    setTransfers(transferRows);
    setLocationStock(stockRows);
    setMovements(movementRows);
  }

  async function submitRequestTransfer() {
    if (!state.user) return;
    setTransferCreateError(null);
    setTransferCreating(true);
    try {
      const sourceLocationId = state.user.scope.locationId;
      if (!sourceLocationId) throw new Error("User has no source location assigned");
      if (!transferDestinationId) throw new Error("Select a destination location");

      const items = transferItems.map((it, idx) => {
        const qty = Number(it.quantity);
        if (!it.itemId) throw new Error(`Line ${idx + 1}: select an item`);
        if (!Number.isFinite(qty) || qty <= 0) throw new Error(`Line ${idx + 1}: quantity must be > 0`);
        return { itemId: it.itemId, quantity: qty };
      });

      await api.inventory.requestStockTransfer(state.user, {
        sourceLocationId,
        destinationLocationId: transferDestinationId,
        items,
      });

      const transferRows = await api.inventory.getStockTransfers(state.user);
      setTransfers(transferRows);
      setTransferCreateOpen(false);
      setTransferDestinationId("");
      setTransferItems([{ itemId: "", quantity: "1" }]);
    } catch (e: unknown) {
      setTransferCreateError(e instanceof Error ? e.message : "Failed to request transfer");
    } finally {
      setTransferCreating(false);
    }
  }

  async function approveTransfer(id: string) {
    if (!state.user) return;
    setTransferActionId(id);
    try {
      await api.inventory.approveStockTransfer(state.user, id);
      await refreshTransfersAndInventory();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to approve transfer");
    } finally {
      setTransferActionId(null);
    }
  }

  async function rejectTransfer(id: string) {
    if (!state.user) return;
    setTransferActionId(id);
    try {
      await api.inventory.rejectStockTransfer(state.user, id);
      await refreshTransfersAndInventory();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to reject transfer");
    } finally {
      setTransferActionId(null);
    }
  }

  async function completeTransfer(id: string) {
    if (!state.user) return;
    setTransferActionId(id);
    try {
      await api.inventory.completeStockTransfer(state.user, id);
      await refreshTransfersAndInventory();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to complete transfer");
    } finally {
      setTransferActionId(null);
    }
  }

  function openTransferView(id: string) {
    setTransferViewId(id);
    setTransferViewOpen(true);
  }

  const filteredGrns = useMemo(() => {
    return grns
      .filter((g) => withinRange({ from: filters.fromDate, to: filters.toDate, raw: g.receivedAt }))
      .filter((g) => {
        if (!q) return true;
        return (
          g.id.toLowerCase().includes(q) ||
          g.lpoId.toLowerCase().includes(q) ||
          g.locationName.toLowerCase().includes(q) ||
          g.receivedByName.toLowerCase().includes(q) ||
          String(g.status).toLowerCase().includes(q)
        );
      })
      .slice(0, 200);
  }, [filters.fromDate, filters.toDate, grns, q]);

  const requestRows = useMemo(() => {
    const fulfilledIds = new Set(
      mockDB.stockMovements
        .filter((m) => m.type === "DEPARTMENT_ISSUE" && m.referenceId)
        .map((m) => String(m.referenceId))
    );

    return reqs
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
      .map((r) => {
        const base = String(r.status) as StockRequestStatusLabel | string;
        const label: StockRequestStatusLabel =
          base === "SUBMITTED"
            ? "PENDING"
            : base === "APPROVED" && fulfilledIds.has(r.id)
              ? "FULFILLED"
              : (base as StockRequestStatusLabel);

        const items = mockDB.requisitionItems.filter((ri) => ri.requisitionId === r.id);
        const totalQty = items.reduce((s, i) => s + i.quantity, 0);

        return {
          ...r,
          statusLabel: label,
          totalQty,
        };
      })
      .slice(0, 200);
  }, [filters.fromDate, filters.toDate, q, reqs]);

  async function refreshRequestsAndInventory() {
    if (!state.user) return;
    const [requisitions, stockRows, movementRows] = await Promise.all([
      api.procurement.getRequisitions(state.user),
      api.inventory.getLocationStock(state.user),
      api.inventory.getMovementHistory(state.user),
    ]);
    setReqs(requisitions);
    setLocationStock(stockRows);
    setMovements(movementRows);
  }

  async function approveRequest(id: string) {
    if (!state.user) return;
    setActionId(id);
    try {
      await api.procurement.transitionRequisition(state.user, id, "APPROVED");
      await refreshRequestsAndInventory();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to approve");
    } finally {
      setActionId(null);
    }
  }

  async function rejectRequest(id: string) {
    if (!state.user) return;
    setActionId(id);
    try {
      await api.procurement.transitionRequisition(state.user, id, "REJECTED");
      await refreshRequestsAndInventory();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to reject");
    } finally {
      setActionId(null);
    }
  }

  async function fulfillRequest(id: string) {
    if (!state.user) return;
    setActionId(id);
    try {
      const req = mockDB.requisitions.find((r) => r.id === id);
      if (!req) throw new Error("Requisition not found");
      if (!req.departmentId) throw new Error("Requisition has no department assigned");

      const items = mockDB.requisitionItems.filter((ri) => ri.requisitionId === id);
      if (items.length === 0) throw new Error("Requisition has no items");

      for (const ri of items) {
        await api.inventory.issueToDepartment(state.user, {
          locationId: req.locationId,
          departmentId: req.departmentId,
          itemId: ri.itemId,
          quantity: ri.quantity,
          referenceId: req.id,
        });
      }

      await refreshRequestsAndInventory();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to fulfill");
    } finally {
      setActionId(null);
    }
  }

  async function openView(id: string) {
    if (!state.user) return;
    setViewOpen(true);
    setViewId(id);
    setViewLoading(true);
    setViewDetail(null);
    try {
      const detail = await api.procurement.getRequisitionDetail(state.user, id);
      setViewDetail(detail);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load request detail");
    } finally {
      setViewLoading(false);
    }
  }

  const issuedLpoOptions = useMemo(() => {
    return lpos
      .filter((l) => l.status === "ISSUED")
      .sort((a, b) => new Date(b.issuedAt).getTime() - new Date(a.issuedAt).getTime())
      .map((l) => ({ value: l.id, label: `${l.id} • ${l.vendorName} • UGX ${l.totalAmount.toLocaleString()}` }));
  }, [lpos]);

  const inventoryOptions = useMemo(() => {
    return mockDB.inventoryItems
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((i) => ({ value: i.id, label: `${i.name} (${i.sku})` }));
  }, []);

  async function submitCreateGrn() {
    if (!state.user) return;
    setCreateError(null);
    setCreating(true);
    try {
      const locationId = state.user.scope.locationId;
      if (!locationId) throw new Error("User has no location assigned");
      if (!createLpoId) throw new Error("Select an LPO");

      const items = createItems
        .map((it, idx) => {
          const quantity = Number(it.quantity);
          const vendorPrice = Number(it.vendorPrice);
          if (!it.itemId) throw new Error(`Line ${idx + 1}: select an item`);
          if (!Number.isFinite(quantity) || quantity <= 0) throw new Error(`Line ${idx + 1}: quantity must be > 0`);
          if (!Number.isFinite(vendorPrice) || vendorPrice < 0) throw new Error(`Line ${idx + 1}: unit price must be >= 0`);
          return { itemId: it.itemId, quantity, vendorPrice };
        });

      if (items.length === 0) throw new Error("Add at least one line item");

      await api.procurement.createGRN(state.user, {
        lpoId: createLpoId,
        locationId,
        items,
      });

      const grnRows = await api.procurement.getGRNs(state.user);
      setGrns(grnRows);
      setCreateOpen(false);
      setCreateLpoId("");
      setCreateItems([{ itemId: "", quantity: "1", vendorPrice: "0" }]);
    } catch (e: unknown) {
      setCreateError(e instanceof Error ? e.message : "Failed to create GRN");
    } finally {
      setCreating(false);
    }
  }

  async function receiveGrn(grnId: string) {
    if (!state.user) return;
    setReceivingId(grnId);
    try {
      await api.procurement.markGRNReceived(state.user, grnId);
      const [grnRows, stockRows, movementRows] = await Promise.all([
        api.procurement.getGRNs(state.user),
        api.inventory.getLocationStock(state.user),
        api.inventory.getMovementHistory(state.user),
      ]);
      setGrns(grnRows);
      setLocationStock(stockRows);
      setMovements(movementRows);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to receive GRN");
    } finally {
      setReceivingId(null);
    }
  }

  const filteredAdjustments = useMemo(() => {
    return movements
      .filter((m) => m.type === "ADJUSTMENT")
      .filter((m) => withinRange({ from: filters.fromDate, to: filters.toDate, raw: m.createdAt }))
      .filter((m) => {
        if (!q) return true;
        return (
          m.itemName.toLowerCase().includes(q) ||
          String(m.referenceId ?? "").toLowerCase().includes(q) ||
          m.performedByName.toLowerCase().includes(q)
        );
      })
      .slice(0, 200);
  }, [filters.fromDate, filters.toDate, movements, q]);

  if (!config) return <DashboardError title="Inventory" message="Tab not found" />;
  if (loading) return <DashboardLoading titleWidthClassName="w-1/3" />;
  if (error) return <DashboardError title={config.title} message={error} />;

  const monthlyRows: MonthlyCountRow[] = locationStock.map((row, index) => {
    const fetched = Math.max(0, Math.round(row.onHand * 0.15));
    const received = Math.max(0, Math.round(row.onHand * 0.2));
    const taken = Math.max(0, Math.round(row.onHand * 0.1));
    const endOfMonthCount = Math.max(0, row.onHand + (index % 2 === 0 ? 2 : -2));
    return {
      id: row.id,
      category: row.categoryName,
      item: row.itemName,
      uom: row.uom,
      packaging: "Standard",
      fetched,
      received,
      taken,
      department: departmentStock[index % Math.max(1, departmentStock.length)]?.departmentName ?? "General",
      closing: row.onHand,
      endOfMonthCount,
      variance: endOfMonthCount - row.onHand,
      reason: endOfMonthCount - row.onHand === 0 ? "-" : "Count variance review",
    };
  });

  const filteredMonthlyRows = monthlyRows
    .filter((r) => {
      if (!q) return true;
      return r.item.toLowerCase().includes(q) || r.category.toLowerCase().includes(q) || r.department.toLowerCase().includes(q);
    })
    .slice(0, 300);

  const valuationRows: InventoryValuationRow[] = valuation.map((v) => ({
    id: v.categoryName,
    categoryName: v.categoryName,
    itemCount: v.itemCount,
    totalValue: v.totalValue,
  }));

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
          {tab === "grn-stock-entry" && (
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              New GRN
            </Button>
          )}
          <Button variant="outline" size="sm"><Download className="w-4 h-4 mr-2" />Export</Button>
        </div>
      </div>

      {tab === "location-inventory" && (
        <Card title="Location Inventory" subtitle="Ledger-derived" noPadding>
          <DataTable<LocationInventoryRow>
            data={locationInventoryRows}
            columns={[
              { header: "Location", accessor: "locationName", className: "text-[var(--text-muted)]" },
              { header: "Item", accessor: "itemName", className: "font-bold text-[var(--text-primary)]" },
              { header: "UOM", accessor: "uom", className: "text-[var(--text-muted)]" },
              { header: "Opening", accessor: (r) => r.opening.toLocaleString(), className: "text-right font-mono font-black" },
              { header: "Received", accessor: (r) => r.received.toLocaleString(), className: "text-right font-mono font-black" },
              { header: "Issued", accessor: (r) => r.issued.toLocaleString(), className: "text-right font-mono font-black" },
              { header: "Transfer In", accessor: (r) => r.transferIn.toLocaleString(), className: "text-right font-mono font-black" },
              { header: "Transfer Out", accessor: (r) => r.transferOut.toLocaleString(), className: "text-right font-mono font-black" },
              { header: "Adjustments", accessor: (r) => r.adjustments.toLocaleString(), className: "text-right font-mono font-black" },
              { header: "System Closing", accessor: (r) => r.closing.toLocaleString(), className: "text-right font-mono font-black text-[var(--text-primary)]" },
              { header: "Last Movement", accessor: (r) => (r.lastMovementAt ? new Date(r.lastMovementAt).toLocaleString() : "—"), className: "text-[var(--text-muted)]" },
            ]}
            emptyMessage="No inventory data available"
          />
        </Card>
      )}

      {tab === "grn-stock-entry" && (
        <Card title="GRN Register" subtitle="Goods received notes" noPadding>
          <DataTable<GRNRow>
            data={filteredGrns}
            columns={[
              { header: "GRN #", accessor: "id", className: "font-mono font-bold" },
              { header: "LPO #", accessor: "lpoId", className: "font-mono" },
              { header: "Location", accessor: "locationName", className: "text-[var(--text-muted)]" },
              { header: "Received By", accessor: "receivedByName", className: "text-[var(--text-muted)]" },
              { header: "Lines", accessor: (g: GRNRow) => `${g.items.length} SKUs`, className: "text-[var(--text-muted)]" },
              { header: "Amount", accessor: (g: GRNRow) => `UGX ${g.totalAmount.toLocaleString()}`, className: "text-right font-mono font-black text-[var(--text-primary)]" },
              { header: "Status", accessor: "status", className: "text-[var(--text-muted)]" },
              { header: "Received At", accessor: (g: GRNRow) => new Date(g.receivedAt).toLocaleString(), className: "text-[var(--text-muted)]" },
              {
                header: "Action",
                accessor: (g: GRNRow) => (
                  <Button
                    size="sm"
                    variant={g.status === "PENDING" ? "primary" : "outline"}
                    disabled={g.status !== "PENDING"}
                    isLoading={receivingId === g.id}
                    onClick={() => receiveGrn(g.id)}
                  >
                    Receive
                  </Button>
                ),
              },
            ]}
            emptyMessage="No GRNs found"
          />
        </Card>
      )}

      {tab === "department-stock-requests" && (
        <Card title="Department Stock Requests" subtitle="Approval and fulfillment" noPadding>
          <DataTable
            data={requestRows}
            columns={[
              { header: "Request #", accessor: "id", className: "font-mono font-bold" },
              { header: "Department", accessor: "departmentName", className: "font-bold text-[var(--text-primary)]" },
              { header: "Requested By", accessor: "requestedByName", className: "text-[var(--text-muted)]" },
              { header: "Lines", accessor: (r: any) => `${r.itemCount} SKUs`, className: "text-[var(--text-muted)]" },
              { header: "Total Qty", accessor: (r: any) => Number(r.totalQty).toLocaleString(), className: "text-right font-mono font-black text-[var(--text-primary)]" },
              { header: "Status", accessor: (r: any) => r.statusLabel, className: "text-[var(--text-muted)]" },
              { header: "Requested At", accessor: (r: any) => new Date(r.createdAt).toLocaleString(), className: "text-[var(--text-muted)]" },
              {
                header: "Action",
                accessor: (r: any) => {
                  const isPending = r.statusLabel === "PENDING";
                  const isApproved = r.statusLabel === "APPROVED";
                  const isFulfilled = r.statusLabel === "FULFILLED";
                  return (
                    <div className="flex items-center gap-2">
                      <Button size="sm" variant="outline" onClick={() => openView(r.id)}>
                        View
                      </Button>
                      <Button
                        size="sm"
                        variant="primary"
                        disabled={!isPending}
                        isLoading={actionId === r.id}
                        onClick={() => approveRequest(r.id)}
                      >
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="danger"
                        disabled={!isPending}
                        isLoading={actionId === r.id}
                        onClick={() => rejectRequest(r.id)}
                      >
                        Reject
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={!isApproved || isFulfilled}
                        isLoading={actionId === r.id}
                        onClick={() => fulfillRequest(r.id)}
                      >
                        Fulfill
                      </Button>
                    </div>
                  );
                },
              },
            ]}
            emptyMessage="No department stock requests found"
          />
        </Card>
      )}

      {tab === "department-stock" && (
        <Card title="Department Stock Ledger" noPadding>
          <DataTable
            data={filteredDepartmentStock}
            columns={[
              { header: "Department", accessor: "departmentName", className: "font-bold" },
              { header: "Item", accessor: "itemName" },
              { header: "SKU", accessor: "sku", className: "font-mono" },
              { header: "Quantity", accessor: (d: DepartmentStockRow) => d.currentQuantity, className: "text-right font-mono font-black text-[var(--text-primary)]" },
              { header: "UOM", accessor: "uom" },
            ]}
          />
        </Card>
      )}

      {tab === "stock-transfers" && (
        <Card title="Stock Transfers" subtitle="Movement control" noPadding>
          <div className="p-4 border-b border-[var(--border-subtle)] flex justify-end">
            <Button size="sm" onClick={() => setTransferCreateOpen(true)}>
              New Transfer
            </Button>
          </div>
          <DataTable
            data={transferRows}
            columns={[
              { header: "Transfer #", accessor: "id", className: "font-mono font-bold" },
              { header: "From Location", accessor: "sourceLocationName", className: "text-[var(--text-muted)]" },
              { header: "To Location", accessor: "destinationLocationName", className: "text-[var(--text-muted)]" },
              { header: "Requested By", accessor: (r: any) => r.requestedByName, className: "text-[var(--text-muted)]" },
              { header: "Lines", accessor: (r: any) => `${r.lineCount} SKUs`, className: "text-[var(--text-muted)]" },
              { header: "Total Qty", accessor: (r: any) => Number(r.totalQty).toLocaleString(), className: "text-right font-mono font-black text-[var(--text-primary)]" },
              { header: "Status", accessor: (r: any) => r.statusLabel, className: "text-[var(--text-muted)]" },
              { header: "Created At", accessor: (r: any) => new Date(r.requestedAt).toLocaleString(), className: "text-[var(--text-muted)]" },
              {
                header: "Action",
                accessor: (r: any) => {
                  const isPending = r.statusLabel === "PENDING";
                  const isApproved = r.statusLabel === "APPROVED";
                  const isCompleted = r.statusLabel === "COMPLETED";
                  const isRejected = r.statusLabel === "REJECTED";
                  return (
                    <div className="flex items-center gap-2">
                      <Button size="sm" variant="outline" onClick={() => openTransferView(r.id)}>
                        View
                      </Button>
                      <Button
                        size="sm"
                        variant="primary"
                        disabled={!isPending}
                        isLoading={transferActionId === r.id}
                        onClick={() => approveTransfer(r.id)}
                      >
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="danger"
                        disabled={!isPending}
                        isLoading={transferActionId === r.id}
                        onClick={() => rejectTransfer(r.id)}
                      >
                        Reject
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={!isApproved || isCompleted || isRejected}
                        isLoading={transferActionId === r.id}
                        onClick={() => completeTransfer(r.id)}
                      >
                        Complete
                      </Button>
                    </div>
                  );
                },
              },
            ]}
            emptyMessage="No transfers found"
          />
        </Card>
      )}

      <Modal
        open={transferCreateOpen}
        onClose={() => {
          if (transferCreating) return;
          setTransferCreateOpen(false);
          setTransferCreateError(null);
        }}
        title="New Stock Transfer"
        description="Request a transfer with line items"
        size="xl"
      >
        <div className="space-y-4">
          <Select
            label="Destination"
            value={transferDestinationId}
            onChange={(e) => setTransferDestinationId(e.target.value)}
            options={locationOptions}
            placeholder="Select destination"
          />

          <div className="space-y-3">
            {transferItems.map((it, idx) => (
              <div key={idx} className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
                <div className="md:col-span-8">
                  <Select
                    label={idx === 0 ? "Item" : undefined}
                    value={it.itemId}
                    onChange={(e) => {
                      const next = transferItems.slice();
                      next[idx] = { ...next[idx], itemId: e.target.value };
                      setTransferItems(next);
                    }}
                    options={inventoryOptions}
                    placeholder="Select item"
                  />
                </div>
                <div className="md:col-span-3">
                  <Input
                    label={idx === 0 ? "Qty" : undefined}
                    value={it.quantity}
                    onChange={(e) => {
                      const next = transferItems.slice();
                      next[idx] = { ...next[idx], quantity: e.target.value };
                      setTransferItems(next);
                    }}
                    inputMode="numeric"
                  />
                </div>
                <div className="md:col-span-1">
                  <Button
                    size="icon"
                    variant="outline"
                    disabled={transferItems.length === 1}
                    onClick={() => setTransferItems(transferItems.filter((_, i) => i !== idx))}
                    aria-label="Remove line"
                  >
                    −
                  </Button>
                </div>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setTransferItems([...transferItems, { itemId: "", quantity: "1" }])}
            >
              Add Line
            </Button>
            <div className="text-xs text-[var(--text-muted)]">Total lines: {transferItems.length}</div>
          </div>

          {transferCreateError && <div className="text-sm text-rose-300">{transferCreateError}</div>}

          <ModalFooter>
            <Button variant="outline" onClick={() => setTransferCreateOpen(false)} disabled={transferCreating}>
              Cancel
            </Button>
            <Button onClick={submitRequestTransfer} isLoading={transferCreating}>
              Request
            </Button>
          </ModalFooter>
        </div>
      </Modal>

      <Modal
        open={transferViewOpen}
        onClose={() => {
          setTransferViewOpen(false);
          setTransferViewId(null);
        }}
        title={transferViewId ? `Transfer ${transferViewId}` : "Transfer"}
        description="Line items"
        size="xl"
      >
        {transferViewId && (
          <Card title="Lines" noPadding>
            <DataTable
              data={mockDB.stockTransferItems
                .filter((i) => i.stockTransferId === transferViewId)
                .map((i, idx) => {
                  const item = mockDB.inventoryItems.find((x) => x.id === i.itemId);
                  return {
                    id: `${transferViewId}_${idx}`,
                    itemName: item?.name ?? "Unknown",
                    sku: item?.sku ?? "",
                    quantity: i.quantity,
                  };
                })}
              columns={[
                { header: "Item", accessor: "itemName", className: "font-bold text-[var(--text-primary)]" },
                { header: "SKU", accessor: "sku", className: "font-mono text-xs" },
                { header: "Qty", accessor: (r: any) => Number(r.quantity).toLocaleString(), className: "text-right font-mono font-black" },
              ]}
              emptyMessage="No line items"
            />
          </Card>
        )}
        <ModalFooter>
          <Button variant="outline" onClick={() => setTransferViewOpen(false)}>
            Close
          </Button>
        </ModalFooter>
      </Modal>

      {tab === "adjustments" && (
        <Card title="Adjustment Activity" noPadding>
          <DataTable
            data={filteredAdjustments}
            columns={[
              { header: "Date", accessor: (m: StockMovementRow) => new Date(m.createdAt).toLocaleDateString() },
              { header: "Item", accessor: "itemName" },
              { header: "Reference", accessor: "referenceId", className: "font-mono" },
              { header: "Quantity", accessor: (m: StockMovementRow) => m.quantity, className: "text-right font-mono font-black text-[var(--text-primary)]" },
              { header: "By", accessor: "performedByName" },
            ]}
          />
        </Card>
      )}

      {tab === "monthly-stock-count" && (
        <Card title="Monthly Stock Count" subtitle="Month-end count and variance" noPadding>
          <DataTable
            data={filteredMonthlyRows}
            columns={[
              { header: "Category", accessor: "category" },
              { header: "Item", accessor: "item", className: "font-bold" },
              { header: "UOM", accessor: "uom" },
              { header: "Packaging", accessor: "packaging" },
              { header: "Fetched", accessor: (r: MonthlyCountRow) => r.fetched, className: "text-right font-mono font-black" },
              { header: "Received", accessor: (r: MonthlyCountRow) => r.received, className: "text-right font-mono font-black" },
              { header: "Taken", accessor: (r: MonthlyCountRow) => r.taken, className: "text-right font-mono font-black" },
              { header: "Department", accessor: "department" },
              { header: "Closing", accessor: (r: MonthlyCountRow) => r.closing, className: "text-right font-mono font-black text-[var(--text-primary)]" },
              { header: "End of Month Count", accessor: (r: MonthlyCountRow) => r.endOfMonthCount, className: "text-right font-mono font-black text-[var(--text-primary)]" },
              {
                header: "Variance",
                accessor: (r: MonthlyCountRow) => (
                  <span className={r.variance > 0 ? "text-emerald-300 text-right block font-mono font-black" : r.variance < 0 ? "text-rose-300 text-right block font-mono font-black" : "text-[var(--text-secondary)] text-right block font-mono font-black"}>
                    {r.variance > 0 ? `+${r.variance}` : r.variance}
                  </span>
                ),
              },
              { header: "Reason", accessor: "reason" },
            ]}
            emptyMessage="No count rows found"
          />
        </Card>
      )}

      {tab === "inventory-valuation" && (
        <Card title="Inventory Valuation" noPadding>
          <DataTable<InventoryValuationRow>
            data={valuationRows}
            columns={[
              { header: "Category", accessor: "categoryName", className: "font-bold" },
              { header: "Item Count", accessor: "itemCount", className: "text-right font-mono font-black" },
              { header: "Total Value", accessor: (v) => `UGX ${v.totalValue.toLocaleString()}`, className: "text-right font-mono font-black text-[var(--text-primary)]" },
            ]}
          />
        </Card>
      )}

      {tab === "reports" && (
        <Card title="Inventory Reports" subtitle="Exports">
          <div className="p-6 text-sm text-[var(--text-secondary)]">No reports available.</div>
        </Card>
      )}

      <Modal
        open={viewOpen}
        onClose={() => {
          if (viewLoading) return;
          setViewOpen(false);
          setViewId(null);
          setViewDetail(null);
        }}
        title={viewId ? `Request ${viewId}` : "Request"}
        description="Line items"
        size="xl"
      >
        {viewLoading && <div className="text-sm text-[var(--text-secondary)]">Loading...</div>}
        {!viewLoading && viewDetail && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="p-3 rounded-xl border border-white/10 bg-white/5">
                <div className="text-[10px] font-black uppercase text-[var(--text-muted)]">Department</div>
                <div className="text-sm font-bold text-[var(--text-primary)]">{viewDetail.departmentName}</div>
              </div>
              <div className="p-3 rounded-xl border border-white/10 bg-white/5">
                <div className="text-[10px] font-black uppercase text-[var(--text-muted)]">Requested By</div>
                <div className="text-sm font-bold text-[var(--text-primary)]">{viewDetail.requestedByName}</div>
              </div>
              <div className="p-3 rounded-xl border border-white/10 bg-white/5">
                <div className="text-[10px] font-black uppercase text-[var(--text-muted)]">Status</div>
                <div className="text-sm font-bold text-[var(--text-primary)]">{String(viewDetail.status)}</div>
              </div>
            </div>
            <Card title="Lines" noPadding>
              <DataTable
                data={viewDetail.items.map((i, idx) => ({ ...i, id: `${idx}_${i.sku}` }))}
                columns={[
                  { header: "Item", accessor: "itemName", className: "font-bold text-[var(--text-primary)]" },
                  { header: "SKU", accessor: "sku", className: "font-mono text-xs" },
                  { header: "Qty", accessor: (i: any) => Number(i.quantity).toLocaleString(), className: "text-right font-mono font-black" },
                  { header: "Est. Price", accessor: (i: any) => `UGX ${Number(i.estimatedPrice).toLocaleString()}`, className: "text-right font-mono font-black text-[var(--text-primary)]" },
                ]}
                emptyMessage="No line items"
              />
            </Card>
            <ModalFooter>
              <Button variant="outline" onClick={() => setViewOpen(false)}>
                Close
              </Button>
            </ModalFooter>
          </div>
        )}
      </Modal>

      <Modal
        open={createOpen}
        onClose={() => {
          if (creating) return;
          setCreateOpen(false);
          setCreateError(null);
        }}
        title="New GRN"
        description="Create a goods received note with line items"
        size="xl"
      >
        <div className="space-y-4">
          <Select
            label="LPO"
            value={createLpoId}
            onChange={(e) => setCreateLpoId(e.target.value)}
            options={issuedLpoOptions}
            placeholder="Select an ISSUED LPO"
          />

          <div className="space-y-3">
            {createItems.map((it, idx) => (
              <div key={idx} className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
                <div className="md:col-span-6">
                  <Select
                    label={idx === 0 ? "Item" : undefined}
                    value={it.itemId}
                    onChange={(e) => {
                      const next = createItems.slice();
                      next[idx] = { ...next[idx], itemId: e.target.value };
                      setCreateItems(next);
                    }}
                    options={inventoryOptions}
                    placeholder="Select item"
                  />
                </div>
                <div className="md:col-span-2">
                  <Input
                    label={idx === 0 ? "Qty" : undefined}
                    value={it.quantity}
                    onChange={(e) => {
                      const next = createItems.slice();
                      next[idx] = { ...next[idx], quantity: e.target.value };
                      setCreateItems(next);
                    }}
                    inputMode="numeric"
                  />
                </div>
                <div className="md:col-span-3">
                  <Input
                    label={idx === 0 ? "Unit Price" : undefined}
                    value={it.vendorPrice}
                    onChange={(e) => {
                      const next = createItems.slice();
                      next[idx] = { ...next[idx], vendorPrice: e.target.value };
                      setCreateItems(next);
                    }}
                    inputMode="numeric"
                  />
                </div>
                <div className="md:col-span-1">
                  <Button
                    size="icon"
                    variant="outline"
                    disabled={createItems.length === 1}
                    onClick={() => setCreateItems(createItems.filter((_, i) => i !== idx))}
                    aria-label="Remove line"
                  >
                    −
                  </Button>
                </div>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCreateItems([...createItems, { itemId: "", quantity: "1", vendorPrice: "0" }])}
            >
              Add Line
            </Button>
            <div className="text-xs text-[var(--text-muted)]">
              Total lines: {createItems.length}
            </div>
          </div>

          {createError && <div className="text-sm text-rose-300">{createError}</div>}

          <ModalFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)} disabled={creating}>
              Cancel
            </Button>
            <Button onClick={submitCreateGrn} isLoading={creating}>
              Create GRN
            </Button>
          </ModalFooter>
        </div>
      </Modal>
    </div>
  );
}
