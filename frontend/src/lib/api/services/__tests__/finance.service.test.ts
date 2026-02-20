import { beforeEach, describe, expect, it } from "vitest";

import { financeService } from "../finance.service";
import { withAuditGuard } from "../_auditGuard";
import { mockDB } from "@/lib/mock-db";
import { Role } from "@/lib/auth/roles";
import type { AuditLog } from "@/lib/mock-db";
import { makeUser, resetMockDBFromSnapshot } from "./testUtils";

const initial = structuredClone(mockDB);

beforeEach(() => {
  resetMockDBFromSnapshot(mockDB, initial);
});

describe("Finance Engine (Phase 2.3)", () => {
  it("enforces RBAC: only finance/gm can approve invoices", async () => {
    const pb = mockDB.locations[0].id;
    const storePb = makeUser({ id: "sm_pb", role: Role.STORE_MANAGER, scope: { allLocations: false, locationId: pb } });

    const pending = mockDB.vendorInvoices.find((i) => i.locationId === pb && i.status === "PENDING" && i.grnId)!
    expect(pending).toBeTruthy();

    await expect(financeService.approveInvoice(storePb, pending.id)).rejects.toThrow(/RBAC/);
  });

  it("rejects ledger posting when debits != credits", async () => {
    const pb = mockDB.locations[0].id;
    const financePb = makeUser({ id: "fin_pb", role: Role.FINANCE_MANAGER, scope: { allLocations: false, locationId: pb } });

    await expect(
      financeService.postManualReversal(financePb, {
        locationId: pb,
        reversalId: "rev_bad_1",
        lines: [
          { accountCode: "CASH", debit: 100, credit: 0 },
          { accountCode: "REVENUE", debit: 0, credit: 90 },
        ],
      })
    ).rejects.toThrow(/imbalance/i);
  });

  it("supports reversal-only changes (creates reversal entries rather than mutating existing)", async () => {
    const pb = mockDB.locations[0].id;
    const financePb = makeUser({ id: "fin_pb", role: Role.FINANCE_MANAGER, scope: { allLocations: false, locationId: pb } });

    const { referenceId } = await financeService.postRevenueFromSales(financePb, {
      locationId: pb,
      from: "2026-02-17T00:00:00Z",
      to: "2026-02-18T23:59:59Z",
      paymentMethodId: mockDB.paymentMethods[0].id,
    });

    const before = mockDB.financialEntries.filter((e) => e.referenceType === "SALE" && e.referenceId === referenceId);
    expect(before.length).toBe(2);

    const { reversalId } = await financeService.reversePostedReference(financePb, {
      locationId: pb,
      referenceType: "SALE",
      referenceId,
    });

    const after = mockDB.financialEntries.filter((e) => e.referenceType === "SALE" && e.referenceId === referenceId);
    expect(after.length).toBe(2);

    const rev = mockDB.financialEntries.filter((e) => e.referenceType === "REVERSAL" && e.referenceId === reversalId);
    expect(rev.length).toBe(2);
  });

  it("approves invoice only after 3-way match + posts balanced ledger entries + blocks duplicates", async () => {
    const pb = mockDB.locations[0].id;
    const financePb = makeUser({ id: "fin_pb", role: Role.FINANCE_MANAGER, scope: { allLocations: false, locationId: pb } });

    const inv = mockDB.vendorInvoices.find((i) => i.locationId === pb && i.status === "PENDING" && i.grnId)!
    expect(inv).toBeTruthy();

    expect(mockDB.financialEntries.length).toBe(0);
    await financeService.approveInvoice(financePb, inv.id);

    expect(inv.status).toBe("APPROVED");
    const posted = mockDB.financialEntries.filter((e) => e.referenceType === "INVOICE" && e.referenceId === inv.id);
    expect(posted.length).toBe(2);

    const totalDebit = posted.reduce((s, e) => s + e.debit, 0);
    const totalCredit = posted.reduce((s, e) => s + e.credit, 0);
    expect(totalDebit).toBe(totalCredit);

    await expect(financeService.approveInvoice(financePb, inv.id)).rejects.toThrow(/Cannot approve invoice/);
    await expect(financeService.approveInvoice(financePb, inv.id)).rejects.toThrow(/status is/);
  });

  it("blocks cross-location approval and payment", async () => {
    const pb = mockDB.locations[0].id;
    const mk = mockDB.locations[1].id;

    const financePb = makeUser({ id: "fin_pb", role: Role.FINANCE_MANAGER, scope: { allLocations: false, locationId: pb } });

    const invMk = mockDB.vendorInvoices.find((i) => i.locationId === mk && i.status === "PENDING")!;
    expect(invMk).toBeTruthy();

    await expect(financeService.approveInvoice(financePb, invMk.id)).rejects.toThrow(/cannot access location/);

    // also payment cross-location
    const invPb = mockDB.vendorInvoices.find((i) => i.locationId === pb && i.status === "PENDING" && i.grnId)!
    await financeService.approveInvoice(financePb, invPb.id);

    const financeMk = makeUser({ id: "fin_mk", role: Role.FINANCE_MANAGER, scope: { allLocations: false, locationId: mk } });
    await expect(financeService.payInvoice(financeMk, { invoiceId: invPb.id, amount: invPb.amount, paymentMethodId: mockDB.paymentMethods[0].id, reference: "X" })).rejects.toThrow(
      /cannot access location/
    );
  });

  it("pays approved invoice once + posts payment ledger", async () => {
    const pb = mockDB.locations[0].id;
    const financePb = makeUser({ id: "fin_pb", role: Role.FINANCE_MANAGER, scope: { allLocations: false, locationId: pb } });

    const inv = mockDB.vendorInvoices.find((i) => i.locationId === pb && i.status === "PENDING" && i.grnId)!
    await financeService.approveInvoice(financePb, inv.id);

    const pmId = mockDB.paymentMethods[0].id;
    const pay = await financeService.payInvoice(financePb, { invoiceId: inv.id, amount: inv.amount, paymentMethodId: pmId, reference: "TXN-1" });

    expect(pay.invoiceId).toBe(inv.id);
    expect(inv.status).toBe("PAID");

    const posted = mockDB.financialEntries.filter((e) => e.referenceType === "PAYMENT" && e.referenceId === pay.id);
    expect(posted.length).toBe(2);

    await expect(financeService.payInvoice(financePb, { invoiceId: inv.id, amount: inv.amount, paymentMethodId: pmId, reference: "TXN-2" })).rejects.toThrow(
      /already PAID/
    );
  });

  it("creates unpaid expense (AP) then pays it (cash) with ledger + audit", async () => {
    const pb = mockDB.locations[0].id;
    const financePb = makeUser({ id: "fin_pb", role: Role.FINANCE_MANAGER, scope: { allLocations: false, locationId: pb } });

    const expRow = await financeService.createExpense(financePb, {
      locationId: pb,
      categoryId: mockDB.categories[0].id,
      amount: 1000,
      description: "Test expense",
    });

    const exp = mockDB.expenses.find((e) => e.id === expRow.id)!;
    expect(exp.status).toBe("UNPAID");

    const expEntries = mockDB.financialEntries.filter((e) => e.referenceType === "EXPENSE" && e.referenceId === exp.id);
    expect(expEntries.length).toBe(2);

    const { paymentId } = await financeService.payExpense(financePb, {
      expenseId: exp.id,
      paymentMethodId: mockDB.paymentMethods[0].id,
      reference: "EXP-PAY-1",
    });

    expect(exp.status).toBe("PAID");
    expect(exp.paymentId).toBe(paymentId);

    const payEntries = mockDB.financialEntries.filter((e) => e.referenceType === "EXPENSE_PAYMENT" && e.referenceId === paymentId);
    expect(payEntries.length).toBe(2);

    const aud = mockDB.auditLogs.filter((a) => a.entityId === paymentId && a.entityType === "EXPENSE_PAYMENT");
    expect(aud.length).toBeGreaterThan(0);
  });

  it("posts revenue from sales idempotently + reports derive from ledger", async () => {
    const pb = mockDB.locations[0].id;
    const financePb = makeUser({ id: "fin_pb", role: Role.FINANCE_MANAGER, scope: { allLocations: false, locationId: pb } });

    const { referenceId } = await financeService.postRevenueFromSales(financePb, {
      locationId: pb,
      from: "2026-02-17T00:00:00Z",
      to: "2026-02-18T23:59:59Z",
      paymentMethodId: mockDB.paymentMethods[0].id,
    });

    const saleEntries = mockDB.financialEntries.filter((e) => e.referenceType === "SALE" && e.referenceId === referenceId);
    expect(saleEntries.length).toBe(2);

    await expect(
      financeService.postRevenueFromSales(financePb, {
        locationId: pb,
        from: "2026-02-17T00:00:00Z",
        to: "2026-02-18T23:59:59Z",
        paymentMethodId: mockDB.paymentMethods[0].id,
      })
    ).rejects.toThrow(/already posted/i);

    // Add a paid expense to create operating expense cash out
    await financeService.createExpense(financePb, {
      locationId: pb,
      categoryId: mockDB.categories[1].id,
      amount: 500,
      description: "Paid OPEX",
      paymentMethodId: mockDB.paymentMethods[0].id,
      reference: "OPEX-1",
    });

    const pnl = await financeService.getProfitAndLoss(financePb, {
      from: "2026-02-16T00:00:00Z",
      to: "2026-02-20T23:59:59Z",
      locationId: pb,
    });
    expect(pnl.revenue).toBeGreaterThan(0);
    expect(pnl.operatingExpenses).toBeGreaterThan(0);

    const cf = await financeService.getCashFlowReport(financePb, {
      from: "2026-02-16T00:00:00Z",
      to: "2026-02-20T23:59:59Z",
      locationId: pb,
    });
    expect(cf.cashFromSales).toBeGreaterThan(0);
    expect(cf.cashPaidForExpenses).toBeGreaterThan(0);

    const ex = await financeService.getExpenditureVsIncome(financePb, {
      from: "2026-02-16T00:00:00Z",
      to: "2026-02-20T23:59:59Z",
      locationId: pb,
    });
    expect(ex.totalIncome).toBe(pnl.revenue);
    expect(ex.totalExpenses).toBeGreaterThan(0);
  });

  it("blocks auditor mutations", async () => {
    const pb = mockDB.locations[0].id;
    const auditor = makeUser({ id: "aud", role: Role.SYSTEM_AUDITOR, scope: { allLocations: true } });

    await expect(
      financeService.createExpense(auditor, { locationId: pb, categoryId: mockDB.categories[0].id, amount: 1, description: "x" })
    ).rejects.toThrow(/read-only/);
  });

  it("throws invariant when audit writes are suppressed during a mutation", async () => {
    const pb = mockDB.locations[0].id;
    const financePb = makeUser({ id: "fin_pb", role: Role.FINANCE_MANAGER, scope: { allLocations: false, locationId: pb } });

    const originalPush = mockDB.auditLogs.push;
    const auditLogs = mockDB.auditLogs as unknown as {
      push: (...items: AuditLog[]) => number;
    };
    auditLogs.push = () => mockDB.auditLogs.length;

    try {
      await expect(
        financeService.createExpense(financePb, {
          locationId: pb,
          categoryId: mockDB.categories[0].id,
          amount: 100,
          description: "suppressed-audit",
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
