import { beforeEach, describe, expect, it } from "vitest";

import { reportingService } from "../reporting.service";
import { financeService } from "../finance.service";
import { inventoryService } from "../inventory.service";
import { mockDB } from "@/lib/mock-db";
import { Role } from "@/lib/auth/roles";
import { makeUser, resetMockDBFromSnapshot } from "./testUtils";

const initial = structuredClone(mockDB);

beforeEach(() => {
  resetMockDBFromSnapshot(mockDB, initial);
});

describe("Reporting Aggregation Engine (Phase 2.4)", () => {
  it("computes CEO global executive reports and matches finance P&L aggregation", async () => {
    const ceo = makeUser({ id: "ceo", role: Role.CEO, scope: { allLocations: true } });

    const from = "2026-02-01T00:00:00Z";
    const to = "2026-02-28T23:59:59Z";

    const reports = await reportingService.getExecutiveReports(ceo, { from, to });

    const locs = mockDB.locations.filter((l) => l.status === "ACTIVE");
    let expectedRevenue = 0;
    let expectedNet = 0;
    let expectedExpenses = 0;
    for (const loc of locs) {
      const pnl = await financeService.getProfitAndLoss(ceo, { from, to, locationId: loc.id });
      expectedRevenue += pnl.revenue;
      expectedNet += pnl.netProfit;
      expectedExpenses += pnl.cogs + pnl.operatingExpenses;
    }

    expect(reports.revenueSummary.totalRevenue).toBe(expectedRevenue);
    expect(reports.revenueSummary.netProfit).toBe(expectedNet);
    expect(reports.revenueSummary.totalExpenses).toBe(expectedExpenses);

    const expectedMargin = expectedRevenue > 0 ? (expectedNet / expectedRevenue) * 100 : 0;
    expect(reports.revenueSummary.profitMarginPercent).toBeCloseTo(expectedMargin, 8);

    expect(reports.locationComparison.length).toBeGreaterThan(0);
  });

  it("scopes GENERAL_MANAGER to their location and blocks cross-location access", async () => {
    const locA = mockDB.locations[0].id;
    const locB = mockDB.locations[1].id;

    const gmA = makeUser({ id: "gmA", role: Role.GENERAL_MANAGER, scope: { allLocations: false, locationId: locA } });

    const from = "2026-02-01T00:00:00Z";
    const to = "2026-02-28T23:59:59Z";

    const reports = await reportingService.getExecutiveReports(gmA, { from, to, locationId: locA });
    expect(reports.locationComparison).toEqual([]); // managers never see multi-location comparisons

    await expect(reportingService.getExecutiveReports(gmA, { from, to, locationId: locB })).rejects.toThrow(/Cross-location/);
  });

  it("allows auditor global aggregation but rejects requesting a single-location executive report", async () => {
    const auditor = makeUser({ id: "aud", role: Role.SYSTEM_AUDITOR, scope: { allLocations: true } });
    const from = "2026-02-01T00:00:00Z";
    const to = "2026-02-28T23:59:59Z";

    const reports = await reportingService.getExecutiveReports(auditor, { from, to });
    expect(reports.locationComparison.length).toBeGreaterThan(0);

    await expect(
      reportingService.getExecutiveReports(auditor, { from, to, locationId: mockDB.locations[0].id })
    ).rejects.toThrow(/Global roles must not request/);
  });

  it("inventory valuation aggregation matches inventory engine KPIs (ledger-derived)", async () => {
    const auditor = makeUser({ id: "aud", role: Role.SYSTEM_AUDITOR, scope: { allLocations: true } });
    const from = "2026-02-01T00:00:00Z";
    const to = "2026-02-28T23:59:59Z";

    const reports = await reportingService.getExecutiveReports(auditor, { from, to });
    const invKpis = await inventoryService.getKPIs(auditor);

    expect(reports.inventoryHealth.totalStockValue).toBeCloseTo(invKpis.totalValue, 6);
    expect(reports.inventoryHealth.lowStockAlertsCount).toBeGreaterThanOrEqual(0);
  });

  it("exposes no mutation methods", async () => {
    const keys = Object.keys(reportingService);
    const forbidden = [/create/i, /update/i, /delete/i, /transition/i, /approve/i, /pay/i, /post/i, /reverse/i, /mutate/i];

    for (const k of keys) {
      for (const re of forbidden) {
        expect(k).not.toMatch(re);
      }
    }
  });
});
