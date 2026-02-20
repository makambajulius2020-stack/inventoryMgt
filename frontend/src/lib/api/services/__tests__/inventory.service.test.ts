import { beforeEach, describe, expect, it } from "vitest";

import { inventoryService } from "../inventory.service";
import { withAuditGuard } from "../_auditGuard";
import { mockDB } from "@/lib/mock-db";
import { Role } from "@/lib/auth/roles";
import type { AuditLog } from "@/lib/mock-db";
import { makeUser, resetMockDBFromSnapshot } from "./testUtils";

const initial = structuredClone(mockDB);

beforeEach(() => {
  resetMockDBFromSnapshot(mockDB, initial);
});

describe("Inventory Engine (ledger-based)", () => {
  it("derives location stock from movements (opening balance + purchase receipt - issue - adjustment)", async () => {
    const locId = mockDB.locations[0].id;
    const itemId = mockDB.inventoryItems[2].id; // Beef Fillet

    const auditor = makeUser({ id: "aud", role: Role.SYSTEM_AUDITOR, scope: { allLocations: true } });
    const stock = await inventoryService.getLocationStock(auditor);

    const row = stock.find((r) => r.locationId === locId && r.itemId === itemId);
    expect(row).toBeTruthy();

    // Seed movements for PB + item[2]: opening 8, purchase receipt 19, adjustment -2 => 25
    expect(row!.onHand).toBe(25);
  });

  it("supports movement history filters (from/to/itemId/type/departmentId)", async () => {
    const auditor = makeUser({ id: "aud", role: Role.SYSTEM_AUDITOR, scope: { allLocations: true } });

    const deptMove = mockDB.stockMovements.find((m) => m.type === "DEPARTMENT_ISSUE" && m.departmentId);
    expect(deptMove).toBeTruthy();

    const res = await inventoryService.getMovementHistory(auditor, {
      from: "2026-02-17T00:00:00Z",
      to: "2026-02-17T23:59:59Z",
      itemId: deptMove!.inventoryItemId,
      type: "DEPARTMENT_ISSUE",
      departmentId: deptMove!.departmentId,
    });

    expect(res.length).toBeGreaterThan(0);
    expect(new Set(res.map((r) => r.type))).toEqual(new Set(["DEPARTMENT_ISSUE"]));
    expect(new Set(res.map((r) => r.itemName))).toEqual(new Set([mockDB.inventoryItems.find((i) => i.id === deptMove!.inventoryItemId)!.name]));
  });

  it("enforces scope: location-scoped user only sees their location movements", async () => {
    const pb = mockDB.locations[0].id;

    const storePb = makeUser({
      id: mockDB.users.find((u) => u.role === "STORE_MANAGER" && u.locationId === pb)!.id,
      role: Role.STORE_MANAGER,
      scope: { allLocations: false, locationId: pb },
    });

    const movements = await inventoryService.getMovementHistory(storePb);
    expect(movements.length).toBeGreaterThan(0);

    // All returned rows should resolve to PB locationName
    const pbName = mockDB.locations.find((l) => l.id === pb)!.name;
    expect(new Set(movements.map((m) => m.locationName))).toEqual(new Set([pbName]));
  });

  it("lists stock transfers with correct scope filtering", async () => {
    const pb = mockDB.locations[0].id;
    const kb = mockDB.locations[1].id;

    const storePb = makeUser({ id: "sm_pb", role: Role.STORE_MANAGER, scope: { allLocations: false, locationId: pb } });
    const storeKb = makeUser({ id: "sm_kb", role: Role.STORE_MANAGER, scope: { allLocations: false, locationId: kb } });
    const auditor = makeUser({ id: "aud", role: Role.SYSTEM_AUDITOR, scope: { allLocations: true } });

    const all = await inventoryService.getStockTransfers(auditor);
    expect(all.length).toBe(mockDB.stockTransfers.length);

    const pbScoped = await inventoryService.getStockTransfers(storePb);
    expect(pbScoped.every((t) => t.sourceLocationName.includes(" ") || t.destinationLocationName.includes(" "))).toBe(true);

    const pbIds = new Set(
      mockDB.stockTransfers
        .filter((t) => t.sourceLocationId === pb || t.destinationLocationId === pb)
        .map((t) => t.id)
    );
    expect(new Set(pbScoped.map((t) => t.id))).toEqual(pbIds);

    const kbIds = new Set(
      mockDB.stockTransfers
        .filter((t) => t.sourceLocationId === kb || t.destinationLocationId === kb)
        .map((t) => t.id)
    );
    const kbScoped = await inventoryService.getStockTransfers(storeKb);
    expect(new Set(kbScoped.map((t) => t.id))).toEqual(kbIds);
  });

  it("derives department stock from DEPARTMENT_ISSUE movements and enforces department scope", async () => {
    const deptMove = mockDB.stockMovements.find((m) => m.type === "DEPARTMENT_ISSUE" && m.departmentId);
    expect(deptMove).toBeTruthy();

    const deptHead = makeUser({
      id: "dh",
      role: Role.DEPARTMENT_HEAD,
      scope: { allLocations: false, locationId: deptMove!.locationId, departmentId: deptMove!.departmentId },
    });

    const rows = await inventoryService.getDepartmentStock(deptHead);
    expect(rows.length).toBeGreaterThan(0);
    expect(new Set(rows.map((r) => r.departmentName))).toEqual(
      new Set([mockDB.departments.find((d) => d.id === deptMove!.departmentId)!.name])
    );
  });

  it("computes low stock alerts and sorts by deficit", async () => {
    const auditor = makeUser({ id: "aud", role: Role.SYSTEM_AUDITOR, scope: { allLocations: true } });
    const alerts = await inventoryService.getLowStockAlerts(auditor);
    expect(alerts.length).toBeGreaterThan(0);

    for (const a of alerts) {
      expect(a.onHand).toBeLessThanOrEqual(a.reorderLevel);
      expect(a.deficit).toBe(a.reorderLevel - a.onHand);
    }
    for (let i = 1; i < alerts.length; i++) {
      expect(alerts[i - 1].deficit).toBeGreaterThanOrEqual(alerts[i].deficit);
    }
  });

  it("computes KPIs from ledger within scope", async () => {
    const auditor = makeUser({ id: "aud", role: Role.SYSTEM_AUDITOR, scope: { allLocations: true } });
    const kpis = await inventoryService.getKPIs(auditor);
    expect(kpis.totalItems).toBeGreaterThan(0);
    expect(kpis.totalValue).toBeGreaterThan(0);
    expect(kpis.movementThisMonth).toBeGreaterThan(0);
    expect(kpis.fastMoving.length).toBeLessThanOrEqual(5);
    expect(kpis.slowMoving.length).toBeLessThanOrEqual(5);
  });

  it("returns stock valuation grouped by category", async () => {
    const auditor = makeUser({ id: "aud", role: Role.SYSTEM_AUDITOR, scope: { allLocations: true } });
    const val = await inventoryService.getStockValuation(auditor);
    expect(val.length).toBeGreaterThan(0);
    expect(val.every((v) => typeof v.categoryName === "string" && v.categoryName.length > 0)).toBe(true);
    expect(val.reduce((s, v) => s + v.totalValue, 0)).toBeGreaterThan(0);
  });

  it("blocks CEO from operational inventory services", async () => {
    const ceo = makeUser({ id: "ceo", role: Role.CEO, scope: { allLocations: true } });
    await expect(inventoryService.getLocationStock(ceo)).rejects.toThrow(/CEO cannot access/);
  });

  it("transferStock creates double-entry movements + audit logs", async () => {
    const src = mockDB.locations[0].id;
    const dst = mockDB.locations[1].id;
    const itemId = mockDB.inventoryItems[0].id;

    const storePb = makeUser({
      id: mockDB.users.find((u) => u.role === "STORE_MANAGER" && u.locationId === src)!.id,
      role: Role.STORE_MANAGER,
      scope: { allLocations: false, locationId: src },
    });

    const startMoves = mockDB.stockMovements.length;
    const startAudits = mockDB.auditLogs.length;

    const { transferId } = await inventoryService.transferStock(storePb, {
      sourceLocationId: src,
      destinationLocationId: dst,
      itemId,
      quantity: 1,
    });

    expect(transferId).toMatch(/^stx_/);
    expect(mockDB.stockMovements.length).toBe(startMoves + 2);

    const lastTwo = mockDB.stockMovements.slice(-2);
    expect(new Set(lastTwo.map((m) => m.referenceId))).toEqual(new Set([transferId]));
    expect(new Set(lastTwo.map((m) => m.type))).toEqual(new Set(["TRANSFER_OUT", "TRANSFER_IN"]));

    // Audit log per movement
    expect(mockDB.auditLogs.length).toBe(startAudits + 2);
    const lastAuditEntityIds = mockDB.auditLogs.slice(-2).map((a) => a.entityId);
    expect(new Set(lastAuditEntityIds)).toEqual(new Set(lastTwo.map((m) => m.id)));
  });

  it("enforces mutation guards: GM cannot transfer, Auditor cannot adjust", async () => {
    const src = mockDB.locations[0].id;
    const dst = mockDB.locations[1].id;
    const itemId = mockDB.inventoryItems[0].id;

    const gm = makeUser({ id: "gm", role: Role.GENERAL_MANAGER, scope: { allLocations: false, locationId: src } });
    await expect(
      inventoryService.transferStock(gm, { sourceLocationId: src, destinationLocationId: dst, itemId, quantity: 1 })
    ).rejects.toThrow(/not permitted|Read-only/);

    const auditor = makeUser({ id: "aud", role: Role.SYSTEM_AUDITOR, scope: { allLocations: true } });
    await expect(
      inventoryService.adjustStock(auditor, { locationId: src, itemId, adjustment: 1, reason: "test" })
    ).rejects.toThrow(/Read-only/);
  });

  it("maintains ledger consistency: cannot adjust below zero", async () => {
    const src = mockDB.locations[0].id;
    const itemId = mockDB.inventoryItems[8].id; // Dish Detergent has small opening balance

    const storePb = makeUser({
      id: mockDB.users.find((u) => u.role === "STORE_MANAGER" && u.locationId === src)!.id,
      role: Role.STORE_MANAGER,
      scope: { allLocations: false, locationId: src },
    });

    const auditor = makeUser({ id: "aud", role: Role.SYSTEM_AUDITOR, scope: { allLocations: true } });
    const before = await inventoryService.getLocationStock(auditor);
    const row = before.find((r) => r.locationId === src && r.itemId === itemId)!;

    await expect(
      inventoryService.adjustStock(storePb, { locationId: src, itemId, adjustment: -(row.onHand + 1), reason: "bad" })
    ).rejects.toThrow(/negative/);
  });

  it("throws invariant when inventory mutation audit writes are suppressed", async () => {
    const src = mockDB.locations[0].id;
    const dst = mockDB.locations[1].id;
    const itemId = mockDB.inventoryItems[0].id;
    const storePb = makeUser({
      id: mockDB.users.find((u) => u.role === "STORE_MANAGER" && u.locationId === src)!.id,
      role: Role.STORE_MANAGER,
      scope: { allLocations: false, locationId: src },
    });

    const originalPush = mockDB.auditLogs.push;
    const auditLogs = mockDB.auditLogs as unknown as {
      push: (...items: AuditLog[]) => number;
    };
    auditLogs.push = () => mockDB.auditLogs.length;

    try {
      await expect(
        inventoryService.transferStock(storePb, {
          sourceLocationId: src,
          destinationLocationId: dst,
          itemId,
          quantity: 1,
        })
      ).rejects.toThrow(/\[Invariant\].*audit write/i);
    } finally {
      auditLogs.push = originalPush;
    }
  });

  it("throws invariant when traceId is missing", async () => {
    const existingAudit = structuredClone(mockDB.auditLogs[0]);

    await expect(
      withAuditGuard(async () => {
        mockDB.auditLogs.push(existingAudit);
        return "ok";
      })
    ).rejects.toThrow(/\[Invariant\].*referenceChainId/i);
  });
});
