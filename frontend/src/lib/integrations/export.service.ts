import type { AuthUser } from "@/lib/auth/types";

import { reportingService } from "@/lib/api/services/reporting.service";
import { auditService } from "@/lib/api/services/audit.service";
import { inventoryService } from "@/lib/api/services/inventory.service";

import type { ExportFormat, ExportPayload } from "./integration.types";

function toCsv(rows: Array<Record<string, unknown>>): string {
  if (rows.length === 0) return "";

  const headers = Object.keys(rows[0]);
  const esc = (v: unknown) => {
    const s = v == null ? "" : String(v);
    const needs = /[",\n]/.test(s);
    const inner = s.replaceAll("\"", "\"\"");
    return needs ? `"${inner}"` : inner;
  };

  const lines = [headers.map(esc).join(",")];
  for (const r of rows) {
    lines.push(headers.map((h) => esc(r[h])).join(","));
  }
  return lines.join("\n");
}

export const exportService = {
  async exportFinancialSummary(user: AuthUser, input: { from: string; to: string; format: ExportFormat }): Promise<ExportPayload> {
    const reports = await reportingService.getExecutiveReports(user, { from: input.from, to: input.to });

    const filenameBase = `financial_summary_${input.from.split("T")[0]}_${input.to.split("T")[0]}`;
    if (input.format === "JSON") {
      return {
        filename: `${filenameBase}.json`,
        mimeType: "application/json",
        content: JSON.stringify(reports.revenueSummary, null, 2),
      };
    }

    const csv = toCsv([
      {
        totalRevenue: reports.revenueSummary.totalRevenue,
        totalExpenses: reports.revenueSummary.totalExpenses,
        netProfit: reports.revenueSummary.netProfit,
        profitMarginPercent: reports.revenueSummary.profitMarginPercent,
      },
    ]);

    return {
      filename: `${filenameBase}.csv`,
      mimeType: "text/csv",
      content: csv,
    };
  },

  async exportAuditTrace(user: AuthUser, input: { traceId: string; format: ExportFormat }): Promise<ExportPayload> {
    const chain = await auditService.getTraceChain(user, input.traceId);

    const filenameBase = `audit_trace_${input.traceId}`;
    if (input.format === "JSON") {
      return {
        filename: `${filenameBase}.json`,
        mimeType: "application/json",
        content: JSON.stringify(chain, null, 2),
      };
    }

    const csv = toCsv(
      chain.map((c) => ({
        timestamp: c.timestamp,
        action: c.action,
        entityType: c.entityType,
        entityId: c.entityId,
        userId: c.userId,
        actorRole: c.actorRole,
        locationId: c.locationId,
        referenceChainId: c.referenceChainId,
      }))
    );

    return {
      filename: `${filenameBase}.csv`,
      mimeType: "text/csv",
      content: csv,
    };
  },

  async exportInventorySnapshot(user: AuthUser, input: { format: ExportFormat }): Promise<ExportPayload> {
    const snapshot = await inventoryService.getLocationStock(user);

    const filenameBase = `inventory_snapshot_${new Date().toISOString().split("T")[0]}`;
    if (input.format === "JSON") {
      return {
        filename: `${filenameBase}.json`,
        mimeType: "application/json",
        content: JSON.stringify(snapshot, null, 2),
      };
    }

    const csv = toCsv(
      snapshot.map((s) => ({
        sku: s.sku,
        itemName: s.itemName,
        categoryName: s.categoryName,
        uom: s.uom,
        available: s.available,
        reorderLevel: s.reorderLevel,
        status: s.status,
        totalValue: s.totalValue,
        locationName: s.locationName,
      }))
    );

    return {
      filename: `${filenameBase}.csv`,
      mimeType: "text/csv",
      content: csv,
    };
  },
};
