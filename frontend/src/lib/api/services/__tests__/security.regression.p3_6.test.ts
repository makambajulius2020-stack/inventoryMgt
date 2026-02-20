import { beforeEach, describe, expect, it } from "vitest";

import { inventoryService } from "../inventory.service";
import { procurementService } from "../procurement.service";
import { financeService } from "../finance.service";
import { auditService } from "../audit.service";
import { reportingService } from "../reporting.service";
import { mockDB } from "@/lib/mock-db";
import { Role } from "@/lib/auth/roles";
import { makeUser, resetMockDBFromSnapshot } from "./testUtils";

const initial = structuredClone(mockDB);

beforeEach(() => {
  resetMockDBFromSnapshot(mockDB, initial);
});

describe("Phase 3 Security Regression Sweep (p3_6)", () => {
  it("rejects missing user context across core services", async () => {
    const bad = makeUser({ id: "", role: Role.GENERAL_MANAGER, scope: { allLocations: false, locationId: mockDB.locations[0].id } });

    await expect(inventoryService.getKPIs(bad)).rejects.toThrow(/missing user context/i);
    await expect(procurementService.getKPIs(bad)).rejects.toThrow(/missing user context/i);
    await expect(financeService.getAPAging(bad)).rejects.toThrow(/missing user context/i);
  });

  it("rejects scope spoofing: non-global roles cannot claim allLocations=true", async () => {
    const spoofed = makeUser({
      id: "spoof",
      role: Role.FINANCE_MANAGER,
      scope: { allLocations: true },
    });

    await expect(financeService.getInvoices(spoofed)).rejects.toThrow(/non-global role cannot have allLocations/i);
    await expect(procurementService.getRequisitions(spoofed)).rejects.toThrow(/non-global role cannot have allLocations/i);
    await expect(inventoryService.getMovementHistory(spoofed)).rejects.toThrow(/non-global role cannot have allLocations/i);
  });

  it("rejects direct service call without required scope (missing locationId)", async () => {
    const noLoc = makeUser({ id: "u_noloc", role: Role.STORE_MANAGER, scope: { allLocations: false } });

    await expect(inventoryService.getMovementHistory(noLoc)).rejects.toThrow(/missing locationId/i);
    await expect(procurementService.getRequisitions(noLoc)).rejects.toThrow(/missing locationId/i);
    await expect(financeService.getExpenses(noLoc)).rejects.toThrow(/missing locationId/i);
  });

  it("blocks cross-location trace fetch (tampered traceId cannot bypass scope)", async () => {
    const pb = mockDB.locations[0].id;
    const kb = mockDB.locations[1].id;

    const traceId = "tr_p3_cross";
    mockDB.auditLogs.push({
      id: "aud_p3_1",
      userId: "u1",
      action: "CREATE",
      entityType: "X",
      entityId: "1",
      changes: "{}",
      timestamp: new Date().toISOString(),
      referenceChainId: traceId,
      locationId: pb,
    });
    mockDB.auditLogs.push({
      id: "aud_p3_2",
      userId: "u1",
      action: "CREATE",
      entityType: "Y",
      entityId: "2",
      changes: "{}",
      timestamp: new Date().toISOString(),
      referenceChainId: traceId,
      locationId: kb,
    });

    const financePb = makeUser({ id: "fin_pb", role: Role.FINANCE_MANAGER, scope: { allLocations: false, locationId: pb } });
    await expect(auditService.getTraceChain(financePb, traceId)).rejects.toThrow(/cross-location/i);

    // Tampered trace id (whitespace injection) should not match chain and should not leak cross-location
    await expect(auditService.getTraceChain(financePb, `${traceId} `)).rejects.toThrow(/missing locationId/i);
  });

  it("blocks reporting escalation: non-reporting roles cannot access aggregation", async () => {
    const pb = mockDB.locations[0].id;
    const store = makeUser({ id: "sm", role: Role.STORE_MANAGER, scope: { allLocations: false, locationId: pb } });

    await expect(
      reportingService.getExecutiveReports(store, { from: "2026-02-01T00:00:00Z", to: "2026-02-28T23:59:59Z", locationId: pb })
    ).rejects.toThrow(/not permitted/i);
  });
});
