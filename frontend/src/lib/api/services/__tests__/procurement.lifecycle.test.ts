import { beforeEach, describe, expect, it } from "vitest";

import { procurementService } from "../procurement.service";
import { withAuditGuard } from "../_auditGuard";
import { mockDB } from "@/lib/mock-db";
import { Role } from "@/lib/auth/roles";
import type { AuditLog } from "@/lib/mock-db";
import { makeUser, resetMockDBFromSnapshot } from "./testUtils";

const initial = structuredClone(mockDB);

beforeEach(() => {
  resetMockDBFromSnapshot(mockDB, initial);
});

describe("Procurement Lifecycle State Machine (Phase 2.2)", () => {
  it("enforces forward-only requisition transitions and audits transitions", async () => {
    const locId = mockDB.locations[0].id;
    const deptId = mockDB.departments.find((d) => d.locationId === locId)!.id;

    const deptHead = makeUser({
      id: "dh",
      role: Role.DEPARTMENT_HEAD,
      scope: { allLocations: false, locationId: locId, departmentId: deptId },
    });

    const beforeAudits = mockDB.auditLogs.length;

    const req = await procurementService.createRequisition(deptHead, {
      locationId: locId,
      departmentId: deptId,
      items: [{ itemId: mockDB.inventoryItems[0].id, quantity: 1, estimatedPrice: 1000 }],
    });

    expect(req.status).toBe("DRAFT");

    await procurementService.transitionRequisition(deptHead, req.id, "SUBMITTED");

    const afterAudits = mockDB.auditLogs.length;
    expect(afterAudits).toBe(beforeAudits + 2); // CREATE + TRANSITION

    const po = makeUser({ id: "po", role: Role.PROCUREMENT_OFFICER, scope: { allLocations: false, locationId: locId } });
    await procurementService.transitionRequisition(po, req.id, "APPROVED");

    const row = mockDB.requisitions.find((r) => r.id === req.id)!;
    expect(row.status).toBe("APPROVED");

    await expect(procurementService.transitionRequisition(po, req.id, "SUBMITTED")).rejects.toThrow(/Cannot transition/);
  });

  it("blocks orphan creation: cannot create LPO unless requisition APPROVED and same location", async () => {
    const locA = mockDB.locations[0].id;
    const locB = mockDB.locations[1].id;

    const poA = makeUser({ id: "poA", role: Role.PROCUREMENT_OFFICER, scope: { allLocations: false, locationId: locA } });

    const reqSubmitted = mockDB.requisitions.find((r) => r.locationId === locA && r.status === "SUBMITTED")!;
    await expect(
      procurementService.createLPO(poA, {
        requisitionId: reqSubmitted.id,
        vendorId: mockDB.vendors[0].id,
        locationId: locA,
        totalAmount: 1000,
        expectedDelivery: new Date().toISOString(),
      })
    ).rejects.toThrow(/must be "APPROVED"/);

    const reqApprovedOtherLoc = mockDB.requisitions.find((r) => r.locationId === locB && r.status === "APPROVED")!;
    await expect(
      procurementService.createLPO(poA, {
        requisitionId: reqApprovedOtherLoc.id,
        vendorId: mockDB.vendors[0].id,
        locationId: locA,
        totalAmount: 1000,
        expectedDelivery: new Date().toISOString(),
      })
    ).rejects.toThrow(/location must match requisition location/);
  });

  it("enforces LPO transitions and audits transitions", async () => {
    const locId = mockDB.locations[0].id;
    const po = makeUser({ id: "po", role: Role.PROCUREMENT_OFFICER, scope: { allLocations: false, locationId: locId } });

    const reqApproved = mockDB.requisitions.find((r) => r.locationId === locId && r.status === "APPROVED")!;

    const lpo = await procurementService.createLPO(po, {
      requisitionId: reqApproved.id,
      vendorId: mockDB.vendors[0].id,
      locationId: locId,
      totalAmount: 1000,
      expectedDelivery: new Date().toISOString(),
    });

    expect(lpo.status).toBe("DRAFT");

    await expect(procurementService.createGRN(po, { lpoId: lpo.id, locationId: locId, items: [] })).rejects.toThrow(/must be "ISSUED"/);

    await procurementService.transitionLPO(po, lpo.id, "ISSUED");
    expect(mockDB.localPurchaseOrders.find((x) => x.id === lpo.id)!.status).toBe("ISSUED");

    await expect(procurementService.transitionLPO(po, lpo.id, "DRAFT")).rejects.toThrow(/Cannot transition/);
  });

  it("blocks orphan creation: cannot create invoice unless GRN RECEIVED and location matches", async () => {
    const locA = mockDB.locations[0].id;
    const locB = mockDB.locations[1].id;

    const financeA = makeUser({ id: "fmA", role: Role.FINANCE_MANAGER, scope: { allLocations: false, locationId: locA } });
    const financeB = makeUser({ id: "fmB", role: Role.FINANCE_MANAGER, scope: { allLocations: false, locationId: locB } });

    // Use an existing RECEIVED GRN in locA, but try to create invoice in locB
    const grnA = mockDB.goodsReceivedNotes.find((g) => g.locationId === locA && g.status === "RECEIVED")!;
    await expect(
      procurementService.createVendorInvoice(financeB, {
        grnId: grnA.id,
        vendorId: mockDB.vendors[0].id,
        locationId: locB,
        amount: 1000,
        dueDate: new Date().toISOString(),
      })
    ).rejects.toThrow(/location must match GRN location/);

    // Create a DRAFT GRN and confirm invoice blocked by status
    const lpoIssued = mockDB.localPurchaseOrders.find((l) => l.locationId === locA && l.status === "ISSUED")!;
    const storeA = makeUser({ id: "smA", role: Role.STORE_MANAGER, scope: { allLocations: false, locationId: locA } });

    const grnPending = await procurementService.createGRN(storeA, {
      lpoId: lpoIssued.id,
      locationId: locA,
      items: [{ itemId: mockDB.inventoryItems[0].id, quantity: 1, vendorPrice: 1000 }],
    });

    await expect(
      procurementService.createVendorInvoice(financeA, {
        grnId: grnPending.id,
        vendorId: mockDB.vendors[0].id,
        locationId: locA,
        amount: 1000,
        dueDate: new Date().toISOString(),
      })
    ).rejects.toThrow(/must be "RECEIVED"/);
  });

  it("payment request cannot be created unless invoice APPROVED; transitions are forward-only", async () => {
    const locId = mockDB.locations[0].id;
    const finance = makeUser({ id: "fm", role: Role.FINANCE_MANAGER, scope: { allLocations: false, locationId: locId } });

    const invPending = mockDB.vendorInvoices.find((i) => i.locationId === locId && i.status === "PENDING")!;

    await expect(procurementService.createPaymentRequest(finance, { invoiceId: invPending.id, locationId: locId, amount: 100 })).rejects.toThrow(
      /must be "APPROVED"/
    );

    await procurementService.transitionInvoice(finance, invPending.id, "APPROVED");

    const pr = await procurementService.createPaymentRequest(finance, { invoiceId: invPending.id, locationId: locId, amount: 100 });
    expect(pr.status).toBe("DRAFT");

    await expect(procurementService.transitionPaymentRequest(finance, pr.id, "APPROVED")).rejects.toThrow(/Cannot transition/);

    await procurementService.transitionPaymentRequest(finance, pr.id, "SUBMITTED");
    await procurementService.transitionPaymentRequest(finance, pr.id, "APPROVED");

    const row = mockDB.paymentRequests.find((p) => p.id === pr.id)!;
    expect(row.status).toBe("APPROVED");
  });

  it("auditor is blocked from all procurement mutations", async () => {
    const auditor = makeUser({ id: "aud", role: Role.SYSTEM_AUDITOR, scope: { allLocations: true } });

    await expect(
      procurementService.transitionInvoice(auditor, mockDB.vendorInvoices[0].id, "APPROVED")
    ).rejects.toThrow(/read-only/i);

    await expect(
      procurementService.createPaymentRequest(auditor, { invoiceId: mockDB.vendorInvoices[0].id, locationId: mockDB.locations[0].id, amount: 1 })
    ).rejects.toThrow(/read-only/i);
  });

  it("throws invariant when procurement mutation audit writes are suppressed", async () => {
    const locId = mockDB.locations[0].id;
    const deptId = mockDB.departments.find((d) => d.locationId === locId)!.id;
    const deptHead = makeUser({
      id: "dh_inv",
      role: Role.DEPARTMENT_HEAD,
      scope: { allLocations: false, locationId: locId, departmentId: deptId },
    });

    const originalPush = mockDB.auditLogs.push;
    const auditLogs = mockDB.auditLogs as unknown as {
      push: (...items: AuditLog[]) => number;
    };
    auditLogs.push = () => mockDB.auditLogs.length;

    try {
      await expect(
        procurementService.createRequisition(deptHead, {
          locationId: locId,
          departmentId: deptId,
          items: [{ itemId: mockDB.inventoryItems[0].id, quantity: 1, estimatedPrice: 1000 }],
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

  it("covers read APIs: KPIs, requisitions, detail, LPOs, GRNs, invoices, vendors, payment requests", async () => {
    const locId = mockDB.locations[0].id;
    const user = makeUser({ id: "gm", role: Role.GENERAL_MANAGER, scope: { allLocations: false, locationId: locId } });

    const kpis = await procurementService.getKPIs(user);
    expect(kpis.vendorCount).toBeGreaterThan(0);

    const reqs = await procurementService.getRequisitions(user);
    expect(reqs.every((r) => typeof r.id === "string" && r.locationName.length > 0)).toBe(true);

    const detail = await procurementService.getRequisitionDetail(user, mockDB.requisitions.find((r) => r.locationId === locId)!.id);
    expect(detail.items.length).toBeGreaterThan(0);

    const lpos = await procurementService.getLPOs(user);
    expect(lpos.every((l) => l.locationName.length > 0)).toBe(true);

    const grns = await procurementService.getGRNs(user);
    expect(grns.every((g) => g.locationName.length > 0)).toBe(true);

    const invoices = await procurementService.getVendorInvoices(user);
    expect(invoices.every((i) => i.locationName.length > 0)).toBe(true);

    const vendors = await procurementService.getVendors();
    expect(vendors.length).toBeGreaterThan(0);

    const prs = await procurementService.getPaymentRequests(user);
    expect(Array.isArray(prs)).toBe(true);
  });

  it("covers remaining transitions: requisition cancel/reject, LPO cancel/close, invoice reject/cancel", async () => {
    const locId = mockDB.locations[0].id;
    const deptId = mockDB.departments.find((d) => d.locationId === locId)!.id;
    const deptHead = makeUser({ id: "dh", role: Role.DEPARTMENT_HEAD, scope: { allLocations: false, locationId: locId, departmentId: deptId } });
    const po = makeUser({ id: "po", role: Role.PROCUREMENT_OFFICER, scope: { allLocations: false, locationId: locId } });

    const req = await procurementService.createRequisition(deptHead, {
      locationId: locId,
      departmentId: deptId,
      items: [{ itemId: mockDB.inventoryItems[0].id, quantity: 1, estimatedPrice: 1000 }],
    });

    await procurementService.transitionRequisition(deptHead, req.id, "SUBMITTED");
    await procurementService.transitionRequisition(po, req.id, "REJECTED");
    await expect(procurementService.transitionRequisition(po, req.id, "APPROVED")).rejects.toThrow(/Cannot transition/);

    const req2 = await procurementService.createRequisition(deptHead, {
      locationId: locId,
      departmentId: deptId,
      items: [{ itemId: mockDB.inventoryItems[1].id, quantity: 1, estimatedPrice: 1000 }],
    });
    await procurementService.transitionRequisition(deptHead, req2.id, "SUBMITTED");
    await procurementService.transitionRequisition(po, req2.id, "CANCELLED");

    const reqApproved = mockDB.requisitions.find((r) => r.locationId === locId && r.status === "APPROVED")!;
    const lpo = await procurementService.createLPO(po, {
      requisitionId: reqApproved.id,
      vendorId: mockDB.vendors[0].id,
      locationId: locId,
      totalAmount: 1000,
      expectedDelivery: new Date().toISOString(),
    });
    await procurementService.transitionLPO(po, lpo.id, "CANCELLED");
    await expect(procurementService.transitionLPO(po, lpo.id, "ISSUED")).rejects.toThrow(/Cannot transition/);

    const lpo2 = await procurementService.createLPO(po, {
      requisitionId: reqApproved.id,
      vendorId: mockDB.vendors[0].id,
      locationId: locId,
      totalAmount: 1000,
      expectedDelivery: new Date().toISOString(),
    });
    await procurementService.transitionLPO(po, lpo2.id, "ISSUED");

    const store = makeUser({ id: "sm", role: Role.STORE_MANAGER, scope: { allLocations: false, locationId: locId } });
    const grn = await procurementService.createGRN(store, {
      lpoId: lpo2.id,
      locationId: locId,
      items: [{ itemId: mockDB.inventoryItems[0].id, quantity: 1, vendorPrice: 1000 }],
    });
    await procurementService.markGRNReceived(store, grn.id);

    const finance = makeUser({ id: "fm", role: Role.FINANCE_MANAGER, scope: { allLocations: false, locationId: locId } });
    const inv = await procurementService.createVendorInvoice(finance, {
      grnId: grn.id,
      vendorId: mockDB.vendors[0].id,
      locationId: locId,
      amount: 1000,
      dueDate: new Date().toISOString(),
    });
    await procurementService.transitionInvoice(finance, inv.id, "REJECTED");

    const inv2 = await procurementService.createVendorInvoice(finance, {
      grnId: grn.id,
      vendorId: mockDB.vendors[0].id,
      locationId: locId,
      amount: 1000,
      dueDate: new Date().toISOString(),
    });
    const po2 = makeUser({ id: "po2", role: Role.PROCUREMENT_OFFICER, scope: { allLocations: false, locationId: locId } });
    await procurementService.transitionInvoice(po2, inv2.id, "CANCELLED");

    // LPO close path requires RECEIVED
    await procurementService.transitionLPO(po, lpo2.id, "CLOSED");
  }, 20000);

  it("covers three-way match (invoice->grn->lpo) happy path", async () => {
    const auditor = makeUser({ id: "aud", role: Role.SYSTEM_AUDITOR, scope: { allLocations: true } });
    const invoice = mockDB.vendorInvoices.find((i) => !!i.grnId) ?? mockDB.vendorInvoices[0];
    const res = await procurementService.getThreeWayMatch(auditor, invoice.id);
    expect(res.invoice.id).toBe(invoice.id);
    expect(typeof res.discrepancy).toBe("number");
  });
});
