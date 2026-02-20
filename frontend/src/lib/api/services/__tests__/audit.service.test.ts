import { beforeEach, describe, expect, it } from "vitest";

import { auditService } from "../audit.service";
import { financeService } from "../finance.service";
import { procurementService } from "../procurement.service";
import { mockDB } from "@/lib/mock-db";
import { Role } from "@/lib/auth/roles";
import { makeUser, resetMockDBFromSnapshot } from "./testUtils";

const initial = structuredClone(mockDB);

beforeEach(() => {
  resetMockDBFromSnapshot(mockDB, initial);
});

describe("Audit Deep Tracing (Phase 2.5)", () => {
  it("returns ordered trace chain for a procurement→finance flow", async () => {
    const locId = mockDB.locations[0].id;
    const deptId = mockDB.departments.find((d) => d.locationId === locId)!.id;

    const deptHead = makeUser({
      id: "dh",
      role: Role.DEPARTMENT_HEAD,
      scope: { allLocations: false, locationId: locId, departmentId: deptId },
    });

    const po = makeUser({ id: "po", role: Role.PROCUREMENT_OFFICER, scope: { allLocations: false, locationId: locId } });
    const store = makeUser({ id: "store", role: Role.STORE_MANAGER, scope: { allLocations: false, locationId: locId } });
    const fin = makeUser({ id: "fin", role: Role.FINANCE_MANAGER, scope: { allLocations: false, locationId: locId } });

    const req = await procurementService.createRequisition(deptHead, {
      locationId: locId,
      departmentId: deptId,
      items: [{ itemId: mockDB.inventoryItems[0].id, quantity: 1, estimatedPrice: 1000 }],
    });

    await procurementService.transitionRequisition(deptHead, req.id, "SUBMITTED");
    await procurementService.transitionRequisition(po, req.id, "APPROVED");

    const lpo = await procurementService.createLPO(po, {
      requisitionId: req.id,
      vendorId: mockDB.vendors[0].id,
      locationId: locId,
      totalAmount: 1000,
      expectedDelivery: "2026-03-01",
    });

    await procurementService.transitionLPO(po, lpo.id, "ISSUED");

    const grn = await procurementService.createGRN(po, {
      lpoId: lpo.id,
      locationId: locId,
      items: [{ itemId: mockDB.inventoryItems[0].id, quantity: 1, vendorPrice: 1000 }],
    });

    await procurementService.markGRNReceived(store, grn.id);

    const inv = await procurementService.createVendorInvoice(fin, {
      grnId: grn.id,
      vendorId: mockDB.vendors[0].id,
      locationId: locId,
      amount: 1000,
      dueDate: "2026-03-15",
    });

    await financeService.approveInvoice(fin, inv.id);

    const traceId = mockDB.auditLogs.find((l) => l.entityType === "REQUISITION" && l.entityId === req.id)?.referenceChainId;
    expect(traceId).toBeTruthy();

    const chain = await auditService.getTraceChain(fin, traceId!);
    expect(chain.length).toBeGreaterThan(0);

    // Should be ordered asc by timestamp
    for (let i = 1; i < chain.length; i++) {
      expect(new Date(chain[i].timestamp).getTime()).toBeGreaterThanOrEqual(new Date(chain[i - 1].timestamp).getTime());
    }

    // Should include at least these entity types
    const types = new Set(chain.map((c) => c.entityType));
    expect(types.has("REQUISITION")).toBe(true);
    expect(types.has("LPO")).toBe(true);
    expect(types.has("GRN")).toBe(true);
    expect(types.has("SUPPLIER_INVOICE")).toBe(true);
  });

  it("enforces scope: location-scoped user cannot read cross-location trace", async () => {
    const auditor = makeUser({ id: "aud", role: Role.SYSTEM_AUDITOR, scope: { allLocations: true } });
    const pb = mockDB.locations[0].id;

    // Create two fake entries in different locations with same chain id
    const traceId = "tr_test_cross";
    mockDB.auditLogs.push({
      id: "aud_x1",
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
      id: "aud_x2",
      userId: "u1",
      action: "CREATE",
      entityType: "Y",
      entityId: "2",
      changes: "{}",
      timestamp: new Date().toISOString(),
      referenceChainId: traceId,
      locationId: mockDB.locations[1].id,
    });

    // Auditor (global) can read
    const chain = await auditService.getTraceChain(auditor, traceId);
    expect(chain.length).toBe(2);

    // Location user cannot
    const financePb = makeUser({ id: "fin_pb", role: Role.FINANCE_MANAGER, scope: { allLocations: false, locationId: pb } });
    await expect(auditService.getTraceChain(financePb, traceId)).rejects.toThrow(/cross-location/i);
  });

  it("allows location-scoped user to read same-location trace", async () => {
    const pb = mockDB.locations[0].id;
    const traceId = "tr_test_same_loc";

    mockDB.auditLogs.push({
      id: "aud_s1",
      userId: "u1",
      action: "CREATE",
      entityType: "X",
      entityId: "1",
      changes: "{}",
      timestamp: new Date().toISOString(),
      referenceChainId: traceId,
      locationId: pb,
    });

    const financePb = makeUser({ id: "fin_pb", role: Role.FINANCE_MANAGER, scope: { allLocations: false, locationId: pb } });
    const chain = await auditService.getTraceChain(financePb, traceId);
    expect(chain.length).toBe(1);
    expect(chain[0].locationId).toBe(pb);
  });

  it("denies location-scoped user if trace entries are missing locationId", async () => {
    const pb = mockDB.locations[0].id;
    const traceId = "tr_test_missing_loc";

    mockDB.auditLogs.push({
      id: "aud_m1",
      userId: "u1",
      action: "CREATE",
      entityType: "X",
      entityId: "1",
      changes: "{}",
      timestamp: new Date().toISOString(),
      referenceChainId: traceId,
    });

    const financePb = makeUser({ id: "fin_pb", role: Role.FINANCE_MANAGER, scope: { allLocations: false, locationId: pb } });
    await expect(auditService.getTraceChain(financePb, traceId)).rejects.toThrow(/missing locationId/i);
  });
});
