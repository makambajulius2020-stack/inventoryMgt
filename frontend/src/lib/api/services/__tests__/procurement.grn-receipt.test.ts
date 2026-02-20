import { beforeEach, describe, expect, it } from "vitest";

import { procurementService } from "../procurement.service";
import { mockDB } from "@/lib/mock-db";
import { Role } from "@/lib/auth/roles";
import { makeUser, resetMockDBFromSnapshot } from "./testUtils";

const initial = structuredClone(mockDB);

beforeEach(() => {
  resetMockDBFromSnapshot(mockDB, initial);
});

describe("Procurement GRN receipt lifecycle", () => {
  it("draft GRN (createGRN) does NOT create PURCHASE_RECEIPT movements", async () => {
    const locId = mockDB.locations[0].id;

    // Ensure we have an ISSUED LPO at this location for the test
    const lpoId = `lpo_test_${Date.now()}`;
    mockDB.localPurchaseOrders.push({
      id: lpoId,
      locationId: locId,
      requisitionId: mockDB.requisitions[0].id,
      vendorId: mockDB.vendors[0].id,
      totalAmount: 1000,
      status: "ISSUED",
      issuedAt: new Date().toISOString(),
      expectedDelivery: new Date().toISOString(),
    });

    const store = makeUser({ id: "sm", role: Role.STORE_MANAGER, scope: { allLocations: false, locationId: locId } });

    const before = mockDB.stockMovements.filter((m) => m.type === "PURCHASE_RECEIPT").length;

    const grn = await procurementService.createGRN(store, {
      lpoId,
      locationId: locId,
      items: [{ itemId: mockDB.inventoryItems[0].id, quantity: 2, vendorPrice: 500 }],
    });

    expect(grn.status).toBe("PENDING");

    const after = mockDB.stockMovements.filter((m) => m.type === "PURCHASE_RECEIPT" && m.referenceType === "GRN" && m.referenceId === grn.id).length;
    expect(after).toBe(0);
    expect(mockDB.stockMovements.filter((m) => m.type === "PURCHASE_RECEIPT").length).toBe(before);
  });

  it("markGRNReceived creates PURCHASE_RECEIPT movements per GRN line item and audit logs", async () => {
    const locId = mockDB.locations[0].id;

    const lpoId = `lpo_test_${Date.now()}`;
    mockDB.localPurchaseOrders.push({
      id: lpoId,
      locationId: locId,
      requisitionId: mockDB.requisitions[0].id,
      vendorId: mockDB.vendors[0].id,
      totalAmount: 2000,
      status: "ISSUED",
      issuedAt: new Date().toISOString(),
      expectedDelivery: new Date().toISOString(),
    });

    const store = makeUser({ id: "sm", role: Role.STORE_MANAGER, scope: { allLocations: false, locationId: locId } });

    const grn = await procurementService.createGRN(store, {
      lpoId,
      locationId: locId,
      items: [
        { itemId: mockDB.inventoryItems[0].id, quantity: 2, vendorPrice: 500 },
        { itemId: mockDB.inventoryItems[1].id, quantity: 1, vendorPrice: 1000 },
      ],
    });

    const startMoves = mockDB.stockMovements.length;
    const startAudits = mockDB.auditLogs.length;

    await procurementService.markGRNReceived(store, grn.id);

    const receipts = mockDB.stockMovements.filter(
      (m) => m.type === "PURCHASE_RECEIPT" && m.referenceType === "GRN" && m.referenceId === grn.id
    );

    expect(receipts.length).toBe(2);
    expect(mockDB.stockMovements.length).toBe(startMoves + 2);

    // 2 movement CREATE audit logs + GRN receive + LPO receive
    expect(mockDB.auditLogs.length).toBe(startAudits + 4);

    const grnRow = mockDB.goodsReceivedNotes.find((g) => g.id === grn.id)!;
    const lpoRow = mockDB.localPurchaseOrders.find((l) => l.id === lpoId)!;
    expect(grnRow.status).toBe("RECEIVED");
    expect(lpoRow.status).toBe("RECEIVED");
  });

  it("double receive throws (idempotency)", async () => {
    const locId = mockDB.locations[0].id;

    const lpoId = `lpo_test_${Date.now()}`;
    mockDB.localPurchaseOrders.push({
      id: lpoId,
      locationId: locId,
      requisitionId: mockDB.requisitions[0].id,
      vendorId: mockDB.vendors[0].id,
      totalAmount: 1000,
      status: "ISSUED",
      issuedAt: new Date().toISOString(),
      expectedDelivery: new Date().toISOString(),
    });

    const store = makeUser({ id: "sm", role: Role.STORE_MANAGER, scope: { allLocations: false, locationId: locId } });

    const grn = await procurementService.createGRN(store, {
      lpoId,
      locationId: locId,
      items: [{ itemId: mockDB.inventoryItems[0].id, quantity: 1, vendorPrice: 1000 }],
    });

    await procurementService.markGRNReceived(store, grn.id);
    await expect(procurementService.markGRNReceived(store, grn.id)).rejects.toThrow(/already RECEIVED|already has PURCHASE_RECEIPT/i);
  });

  it("scope violation throws (cannot receive GRN for other location)", async () => {
    const locA = mockDB.locations[0].id;
    const locB = mockDB.locations[1].id;

    const lpoId = `lpo_test_${Date.now()}`;
    mockDB.localPurchaseOrders.push({
      id: lpoId,
      locationId: locA,
      requisitionId: mockDB.requisitions[0].id,
      vendorId: mockDB.vendors[0].id,
      totalAmount: 1000,
      status: "ISSUED",
      issuedAt: new Date().toISOString(),
      expectedDelivery: new Date().toISOString(),
    });

    const storeA = makeUser({ id: "smA", role: Role.STORE_MANAGER, scope: { allLocations: false, locationId: locA } });
    const storeB = makeUser({ id: "smB", role: Role.STORE_MANAGER, scope: { allLocations: false, locationId: locB } });

    const grn = await procurementService.createGRN(storeA, {
      lpoId,
      locationId: locA,
      items: [{ itemId: mockDB.inventoryItems[0].id, quantity: 1, vendorPrice: 1000 }],
    });

    await expect(procurementService.markGRNReceived(storeB, grn.id)).rejects.toThrow(/cannot access location/i);
  });

  it("auditor cannot mark GRN received", async () => {
    const locId = mockDB.locations[0].id;

    const lpoId = `lpo_test_${Date.now()}`;
    mockDB.localPurchaseOrders.push({
      id: lpoId,
      locationId: locId,
      requisitionId: mockDB.requisitions[0].id,
      vendorId: mockDB.vendors[0].id,
      totalAmount: 1000,
      status: "ISSUED",
      issuedAt: new Date().toISOString(),
      expectedDelivery: new Date().toISOString(),
    });

    const store = makeUser({ id: "sm", role: Role.STORE_MANAGER, scope: { allLocations: false, locationId: locId } });
    const grn = await procurementService.createGRN(store, {
      lpoId,
      locationId: locId,
      items: [{ itemId: mockDB.inventoryItems[0].id, quantity: 1, vendorPrice: 1000 }],
    });

    const auditor = makeUser({ id: "aud", role: Role.SYSTEM_AUDITOR, scope: { allLocations: true } });
    await expect(procurementService.markGRNReceived(auditor, grn.id)).rejects.toThrow(/read-only/i);
  });
});
