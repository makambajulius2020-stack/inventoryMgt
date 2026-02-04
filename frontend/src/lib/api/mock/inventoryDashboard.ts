import type {
  DashboardFilters,
  InventoryDashboardApi,
  InventoryKpisDTO,
  InventoryMovementsDTO,
  InventoryMovementType,
  InventoryMonthEndSnapshotsDTO,
  InventoryMovementLedgerDTO,
  InventoryLedgerMovementKind,
  InventoryStockDTO,
} from "@/lib/api/types";
import { ALL_BRANCHES_LABEL, getDemoBranchPool } from "@/lib/locations";

function seededNumber(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return h;
}

function fmtUGX(v: number) {
  return v.toLocaleString(undefined, { style: "currency", currency: "UGX", maximumFractionDigits: 0 });
}

function seedFor(filters: DashboardFilters) {
  return seededNumber(`${filters.preset}-${filters.location}-${filters.fromDate ?? ""}-${filters.toDate ?? ""}`);
}

function pickBranch(filters: DashboardFilters, fallback: string) {
  if (filters.location && filters.location !== ALL_BRANCHES_LABEL) return filters.location;
  return fallback;
}

const BRANCHES = getDemoBranchPool();
const CATEGORIES = ["Meat", "Dairy", "Produce", "Beverages", "Dry Goods"] as const;
const DEPARTMENTS = ["Kitchen", "Bar", "Housekeeping", "Front Office", "Maintenance"] as const;
const ITEMS = [
  "Beef Fillet",
  "Chicken Breast",
  "Fresh Milk",
  "Tomatoes",
  "Onions",
  "Mineral Water",
  "Cooking Oil",
  "Rice",
  "Sugar",
  "Soap",
] as const;

function statusFor(onHand: number): "OK" | "Low" | "Critical" {
  if (onHand <= 5) return "Critical";
  if (onHand <= 15) return "Low";
  return "OK";
}

function monthFor(filters: DashboardFilters) {
  const from = filters.fromDate;
  if (from && from.length >= 7) return from.slice(0, 7);
  return "2026-02";
}

export const mockInventoryDashboardApi: InventoryDashboardApi = {
  async getKpis(filters: DashboardFilters): Promise<InventoryKpisDTO> {
    const s = seedFor(filters);

    const totalInventoryValue = 6_200_000 + (s % 1_200_000);
    const lowStockItems = 8 + (s % 10);
    const overstockedItems = 3 + (s % 7);
    const recentAdjustments = 5 + (s % 8);
    const pettyCashReceiptsCount = 12 + (s % 16);
    const pettyCashReceiptsValue = 420_000 + (s % 260_000);

    return {
      filters,
      kpis: {
        totalInventoryValue: { label: "Total Inventory Value", value: totalInventoryValue, display: fmtUGX(totalInventoryValue) },
        lowStockItems: { label: "Low Stock Items", value: lowStockItems, display: String(lowStockItems) },
        overstockedItems: { label: "Overstocked Items", value: overstockedItems, display: String(overstockedItems) },
        recentAdjustments: { label: "Recent Adjustments", value: recentAdjustments, display: String(recentAdjustments) },
        pettyCashReceiptsCount: { label: "Petty Cash Receipts", value: pettyCashReceiptsCount, display: String(pettyCashReceiptsCount) },
        pettyCashReceiptsValue: { label: "Petty Cash Receipts (Value)", value: pettyCashReceiptsValue, display: fmtUGX(pettyCashReceiptsValue) },
      },
    };
  },

  async getStock(filters: DashboardFilters): Promise<InventoryStockDTO> {
    const s = seedFor(filters);
    const count = 22 + (s % 18);

    const rows = Array.from({ length: count }).map((_, i) => {
      const item = ITEMS[(s + i) % ITEMS.length];
      const category = CATEGORIES[(s + i * 3) % CATEGORIES.length];
      const branch = pickBranch(filters, BRANCHES[(s + i * 2) % BRANCHES.length]);

      const onHand = 3 + ((s + i * 5) % 85);
      const available = Math.max(0, onHand - ((s + i * 7) % 10));
      const unitValue = 4_500 + ((s + i * 900) % 18_000);
      const value = unitValue * onHand;

      return {
        item,
        category,
        branch,
        onHand,
        available,
        value,
        valueDisplay: fmtUGX(value),
        status: statusFor(onHand),
      };
    });

    return { filters, rows };
  },

  async getMovements(filters: DashboardFilters): Promise<InventoryMovementsDTO> {
    const s = seedFor(filters);
    const count = 18 + (s % 16);

    const movementTypes: InventoryMovementType[] = ["GRN", "PETTY_CASH", "ADJUSTMENT", "ISSUE"];

    const rows = Array.from({ length: count }).map((_, i) => {
      const dateDay = 1 + ((s + i * 3) % 28);
      const item = ITEMS[(s + i * 2) % ITEMS.length];
      const type = movementTypes[(s + i * 5) % movementTypes.length];
      const qty = 1 + ((s + i * 11) % 30);
      const branch = pickBranch(filters, BRANCHES[(s + i * 4) % BRANCHES.length]);

      const sourceDocument =
        type === "GRN"
          ? `GRN-${String((s + i * 13) % 9000).padStart(4, "0")}`
          : type === "PETTY_CASH"
            ? `PC-${String((s + i * 17) % 9000).padStart(4, "0")}`
            : type === "ADJUSTMENT"
              ? `ADJ-${String((s + i * 19) % 9000).padStart(4, "0")}`
              : `ISS-${String((s + i * 23) % 9000).padStart(4, "0")}`;

      return {
        date: `2026-02-${String(dateDay).padStart(2, "0")}`,
        item,
        movementType: type,
        quantity: qty,
        sourceDocument,
        branch,
      };
    });

    return { filters, rows };
  },

  async getMonthEndSnapshots(filters: DashboardFilters, params?: { month?: string }): Promise<InventoryMonthEndSnapshotsDTO> {
    const s = seedFor(filters);
    const month = params?.month ?? monthFor(filters);
    const pool = filters.location && filters.location !== ALL_BRANCHES_LABEL ? [filters.location] : BRANCHES;

    const rows = pool.flatMap((branch, bi) => {
      const items = ITEMS.slice(0, 10);
      return items.map((item, i) => {
        const opening = 20 + ((s + bi * 7 + i * 3) % 120);
        const received = 5 + ((s + bi * 11 + i * 5) % 80);
        const issued = 3 + ((s + bi * 13 + i * 7) % 90);
        const systemClosing = opening + received - issued;

        const hasPhysical = ((s + bi + i) % 4) === 0;
        const physicalCount = hasPhysical ? Math.max(0, systemClosing + ((i % 3) - 1) * (2 + (s % 6))) : undefined;
        const variance = physicalCount !== undefined ? physicalCount - systemClosing : undefined;
        const varianceReason =
          physicalCount !== undefined
            ? variance === 0
              ? "Count matched system"
              : variance > 0
                ? "Late GRN posted after count"
                : "Unrecorded issues / wastage"
            : undefined;

        return {
          branch,
          month,
          item,
          opening,
          received,
          issued,
          systemClosing,
          physicalCount,
          variance,
          varianceReason,
        };
      });
    });

    return { filters, month, rows };
  },

  async getMovementLedger(filters: DashboardFilters, params: { month: string; branch: string; item?: string }): Promise<InventoryMovementLedgerDTO> {
    const s = seedFor(filters);
    const month = params.month;
    const count = 22 + (s % 18);

    const kinds: InventoryLedgerMovementKind[] = ["FETCHED", "RECEIVED", "ISSUED", "ADJUSTMENT"];
    const item = params.item ?? ITEMS[(s % ITEMS.length)];

    const rows = Array.from({ length: count }).map((_, i) => {
      const kind = kinds[(s + i * 3) % kinds.length];
      const day = 1 + ((s + i * 5) % 28);
      const quantity = 1 + ((s + i * 7) % 30);

      const sourceDocument =
        kind === "RECEIVED"
          ? `GRN-${String((s + i * 13) % 9000).padStart(4, "0")}`
          : kind === "FETCHED"
            ? `FETCH-${String((s + i * 17) % 9000).padStart(4, "0")}`
            : kind === "ADJUSTMENT"
              ? `ADJ-${String((s + i * 19) % 9000).padStart(4, "0")}`
              : `ISS-${String((s + i * 23) % 9000).padStart(4, "0")}`;

      return {
        id: `iml_${String((s + i * 29) % 9000).padStart(4, "0")}`,
        date: `${month}-${String(day).padStart(2, "0")}`,
        branch: params.branch,
        item,
        kind,
        quantity,
        dept: kind === "ISSUED" ? DEPARTMENTS[(s + i) % DEPARTMENTS.length] : undefined,
        sourceDocument,
        reason: kind === "ADJUSTMENT" ? "Stock count adjustment" : undefined,
      };
    });

    return { filters, month, branch: params.branch, item: params.item, rows };
  },
};
