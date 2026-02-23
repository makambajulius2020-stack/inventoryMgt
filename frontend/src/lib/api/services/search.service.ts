import type { AuthUser } from "@/lib/auth/types";
import { normalizeRole, Role } from "@/lib/auth/roles";
import { mockDB } from "@/lib/mock-db";

export type SearchResultType =
  | "INVENTORY_ITEM"
  | "REQUISITION"
  | "LPO"
  | "GRN"
  | "VENDOR_INVOICE"
  | "VENDOR"
  | "USER";

export type PortalKind =
  | "ceo"
  | "auditor"
  | "gm"
  | "finance"
  | "procurement"
  | "inventory"
  | "department"
  | "admin";

export type GlobalSearchResult = {
  type: SearchResultType;
  id: string;
  title: string;
  subtitle?: string;
};

function assertCanSearch(user: AuthUser) {
  const role = normalizeRole(user.role);
  if (!role) throw new Error(`[RBAC] Role "${user.role}" is not recognized.`);
  const allowed = [
    Role.CEO,
    Role.SYSTEM_AUDITOR,
    Role.GENERAL_MANAGER,
    Role.FINANCE_MANAGER,
    Role.PROCUREMENT_OFFICER,
    Role.STORE_MANAGER,
    Role.DEPARTMENT_HEAD,
  ];
  if (!allowed.includes(role)) throw new Error(`[RBAC] Role "${user.role}" is not permitted to search.`);
}

function includesQuery(haystack: string, q: string) {
  return haystack.toLowerCase().includes(q);
}

function portalTypes(portal?: PortalKind): Set<SearchResultType> {
  switch (portal) {
    case "procurement":
      return new Set(["REQUISITION", "LPO", "GRN", "VENDOR_INVOICE", "VENDOR", "INVENTORY_ITEM"]);
    case "inventory":
      return new Set(["INVENTORY_ITEM", "GRN", "LPO"]);
    case "finance":
      return new Set(["VENDOR_INVOICE", "VENDOR", "REQUISITION", "LPO"]);
    case "department":
      return new Set(["REQUISITION", "INVENTORY_ITEM"]);
    case "admin":
      return new Set(["USER"]);
    case "auditor":
      return new Set(["REQUISITION", "LPO", "GRN", "VENDOR_INVOICE", "VENDOR", "INVENTORY_ITEM", "USER"]);
    case "gm":
    case "ceo":
    default:
      return new Set(["REQUISITION", "LPO", "GRN", "VENDOR_INVOICE", "VENDOR", "INVENTORY_ITEM", "USER"]);
  }
}

export const searchService = {
  async search(user: AuthUser, input: { query: string; portal?: PortalKind; locationId?: string; limit?: number }): Promise<GlobalSearchResult[]> {
    assertCanSearch(user);

    const q = input.query.trim().toLowerCase();
    if (!q) return [];

    const allowedTypes = portalTypes(input.portal);
    const limit = Math.max(1, Math.min(20, input.limit ?? 8));
    const locationId = input.locationId;

    const results: GlobalSearchResult[] = [];

    const push = (r: GlobalSearchResult) => {
      if (!allowedTypes.has(r.type)) return;
      results.push(r);
    };

    for (const item of mockDB.inventoryItems) {
      if (results.length >= limit) break;
      if (includesQuery(item.name, q) || includesQuery(item.sku, q)) {
        push({ type: "INVENTORY_ITEM", id: item.id, title: item.name, subtitle: item.sku });
      }
    }

    for (const r of mockDB.requisitions) {
      if (results.length >= limit) break;
      if (locationId && r.locationId !== locationId) continue;
      if (includesQuery(r.id, q)) {
        push({ type: "REQUISITION", id: r.id, title: r.id, subtitle: `UGX ${r.totalAmount.toLocaleString()}` });
      }
    }

    for (const l of mockDB.localPurchaseOrders) {
      if (results.length >= limit) break;
      if (locationId && l.locationId !== locationId) continue;
      if (includesQuery(l.id, q)) {
        push({ type: "LPO", id: l.id, title: l.id, subtitle: `UGX ${l.totalAmount.toLocaleString()}` });
      }
    }

    for (const g of mockDB.goodsReceivedNotes) {
      if (results.length >= limit) break;
      if (locationId && g.locationId !== locationId) continue;
      if (includesQuery(g.id, q)) {
        push({ type: "GRN", id: g.id, title: g.id, subtitle: `UGX ${g.totalAmount.toLocaleString()}` });
      }
    }

    for (const inv of mockDB.vendorInvoices) {
      if (results.length >= limit) break;
      if (locationId && inv.locationId !== locationId) continue;
      if (includesQuery(inv.id, q)) {
        push({ type: "VENDOR_INVOICE", id: inv.id, title: inv.id, subtitle: `UGX ${inv.amount.toLocaleString()}` });
      }
    }

    for (const v of mockDB.vendors) {
      if (results.length >= limit) break;
      if (includesQuery(v.name, q) || includesQuery(v.contactEmail, q)) {
        push({ type: "VENDOR", id: v.id, title: v.name, subtitle: v.contactEmail });
      }
    }

    for (const u of mockDB.users) {
      if (results.length >= limit) break;
      if (locationId && u.locationId && u.locationId !== locationId) continue;
      if (includesQuery(u.name, q) || includesQuery(u.email, q)) {
        push({ type: "USER", id: u.id, title: u.name, subtitle: u.email });
      }
    }

    return results.slice(0, limit);
  },
};
