"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Download, Search } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { DataTable } from "@/components/ui/DataTable";
import { DashboardError, DashboardLoading } from "@/components/dashboard/DashboardStates";
import { Modal, ModalFooter } from "@/components/ui/Modal";
import { api } from "@/lib/api/client";
import { useAuth } from "@/contexts/AuthContext";
import { useGlobalDateFilters } from "@/contexts/GlobalDateFiltersContext";
import { mockDB } from "@/lib/mock-db";
import type { APAgingRow, ExpenseRow, InvoiceRow, PaymentRow } from "@/lib/api/services/finance.service";

type TabKey =
  | "accounts-payable"
  | "payments"
  | "expenses"
  | "petty-cash"
  | "sales-oversight"
  | "profit-loss"
  | "cash-flow"
  | "bank-reconciliation";

const FINANCE_TABS: { href: string; label: string }[] = [
  { href: "/finance/dashboard", label: "Dashboard" },
  { href: "/finance/accounts-payable", label: "Accounts Payable" },
  { href: "/finance/payments", label: "Payments" },
  { href: "/finance/expenses", label: "Expenses" },
  { href: "/finance/petty-cash", label: "Petty Cash" },
  { href: "/finance/sales-oversight", label: "Sales Oversight" },
  { href: "/finance/profit-loss", label: "Profit & Loss" },
  { href: "/finance/cash-flow", label: "Cash Flow" },
  { href: "/finance/bank-reconciliation", label: "Bank Reconciliation" },
  { href: "/finance/reports", label: "Reports" },
];

const TAB_TITLES: Record<TabKey, { title: string; subtitle: string }> = {
  "accounts-payable": { title: "Accounts Payable", subtitle: "Payables aging and settlement control" },
  payments: { title: "Payments", subtitle: "Cash disbursement register" },
  expenses: { title: "Expenses", subtitle: "Expense ledger and category control" },
  "petty-cash": { title: "Petty Cash", subtitle: "Petty cash governance and reconciliation" },
  "sales-oversight": { title: "Sales Oversight", subtitle: "Revenue posting and oversight" },
  "profit-loss": { title: "Profit & Loss", subtitle: "Profitability structure" },
  "cash-flow": { title: "Cash Flow", subtitle: "Cash movement intelligence" },
  "bank-reconciliation": { title: "Bank Reconciliation", subtitle: "Bank statement reconciliation shell" },
};

type PettyLedgerRow = {
  id: string;
  date: string;
  pvNo: string;
  expenseType: string;
  expenseAccount: string;
  description: string;
  addIn: number;
  paidOut: number;
  balance: number;
  link: string;
  opening?: boolean;
};

type APAgingTableRow = APAgingRow & {
  id: string;
};

function floatingField(label: string, field: React.ReactNode) {
  return (
    <div className="relative">
      {field}
      <label className="absolute -top-2 left-3 px-1 text-[10px] font-black uppercase tracking-wider text-sky-300 bg-[var(--card)]">{label}</label>
    </div>
  );
}

function PettyCashModule({ expenses }: { expenses: ExpenseRow[] }) {
  const [activeSubtab, setActiveSubtab] = useState<"summary" | "ledger" | "new-entry" | "attachments" | "reconciliation">("summary");

  const pettyRows = useMemo<PettyLedgerRow[]>(() => {
    const openingBalance = 900000;
    const dynamicRows = expenses.slice(0, 12).map((e, index) => ({
      id: e.id,
      date: e.date,
      pvNo: `PV-${String(index + 1).padStart(4, "0")}`,
      expenseType: e.categoryName,
      expenseAccount: `OPEX:${e.categoryName}`,
      description: e.description,
      addIn: index % 5 === 0 ? e.amount : 0,
      paidOut: index % 5 === 0 ? 0 : e.amount,
      balance: 0,
      link: "View",
    }));

    let running = openingBalance;
    const withBalance = dynamicRows.map((row) => {
      running += row.addIn;
      running -= row.paidOut;
      return { ...row, balance: running };
    });

    return [
      {
        id: "bal-bf",
        date: "-",
        pvNo: "-",
        expenseType: "Bal b/f",
        expenseAccount: "Opening Balance",
        description: "Balance brought forward",
        addIn: openingBalance,
        paidOut: 0,
        balance: openingBalance,
        link: "-",
        opening: true,
      },
      ...withBalance,
    ];
  }, [expenses]);

  const systemBalance = pettyRows[pettyRows.length - 1]?.balance ?? 0;
  const physicalCashCount = Math.max(0, systemBalance - 8000);
  const variance = physicalCashCount - systemBalance;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2 border-b border-[var(--border-subtle)] pb-2">
        {[
          { id: "summary", label: "Summary" },
          { id: "ledger", label: "Ledger" },
          { id: "new-entry", label: "New Entry" },
          { id: "attachments", label: "Attachments" },
          { id: "reconciliation", label: "Reconciliation" },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveSubtab(tab.id as typeof activeSubtab)}
            className={activeSubtab === tab.id ? "px-3 py-2 rounded-xl bg-[var(--surface-raised)] text-[var(--text-primary)] text-xs font-black uppercase tracking-wider" : "px-3 py-2 rounded-xl text-[var(--text-muted)] hover:text-[var(--text-primary)] text-xs font-black uppercase tracking-wider"}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeSubtab === "summary" && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card title="System Balance"><p className="text-right font-mono font-black text-lg text-[var(--text-primary)]">UGX {systemBalance.toLocaleString()}</p></Card>
          <Card title="Total Add In"><p className="text-right font-mono font-black text-lg text-emerald-300">UGX {pettyRows.reduce((s, r) => s + r.addIn, 0).toLocaleString()}</p></Card>
          <Card title="Total Paid Out"><p className="text-right font-mono font-black text-lg text-rose-300">UGX {pettyRows.reduce((s, r) => s + r.paidOut, 0).toLocaleString()}</p></Card>
        </div>
      )}

      {activeSubtab === "ledger" && (
        <Card title="Petty Cash Ledger" subtitle="Bal b/f row pinned at top" noPadding>
          <DataTable
            data={pettyRows}
            columns={[
              { header: "DATE", accessor: "date" },
              { header: "PV NO", accessor: "pvNo", className: "font-mono" },
              { header: "EXPENSE TYPE", accessor: "expenseType", className: "font-bold" },
              { header: "EXPENSE ACCOUNT", accessor: "expenseAccount", className: "font-mono" },
              { header: "DESCRIPTION", accessor: "description" },
              { header: "ADD IN", accessor: (r: PettyLedgerRow) => (r.addIn ? `UGX ${r.addIn.toLocaleString()}` : "-"), className: "text-right font-mono font-black text-emerald-300" },
              { header: "PAID OUT", accessor: (r: PettyLedgerRow) => (r.paidOut ? `UGX ${r.paidOut.toLocaleString()}` : "-"), className: "text-right font-mono font-black text-rose-300" },
              { header: "BALANCE", accessor: (r: PettyLedgerRow) => `UGX ${r.balance.toLocaleString()}`, className: "text-right font-mono font-black text-[var(--text-primary)]" },
              { header: "LINK", accessor: "link", className: "text-[var(--accent-hover)]" },
            ]}
          />
        </Card>
      )}

      {activeSubtab === "new-entry" && (
        <Card title="New Entry Form" subtitle="Petty cash posting shell">
          <form className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {floatingField("Date", <input type="date" className="h-11 w-full rounded-xl bg-[var(--input)] border border-[var(--input-border)] px-3 text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-blue-500" />)}
            {floatingField("PV Number", <input type="text" placeholder="PV-0001" className="h-11 w-full rounded-xl bg-[var(--input)] border border-[var(--input-border)] px-3 text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-blue-500" />)}
            {floatingField("Expense Type", <input type="text" placeholder="e.g. Transport" className="h-11 w-full rounded-xl bg-[var(--input)] border border-[var(--input-border)] px-3 text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-blue-500" />)}
            {floatingField("Expense Account", <select className="h-11 w-full rounded-xl bg-[var(--input)] border border-[var(--input-border)] px-3 text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-blue-500"><option>Cash On Hand</option><option>Office Expense</option><option>Fuel Expense</option></select>)}
            {floatingField("Description", <input type="text" placeholder="Entry description" className="h-11 w-full rounded-xl bg-[var(--input)] border border-[var(--input-border)] px-3 text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-blue-500" />)}
            {floatingField("Amount", <input type="number" placeholder="0" className="h-11 w-full rounded-xl bg-[var(--input)] border border-[var(--input-border)] px-3 text-right font-mono text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-blue-500" />)}
            {floatingField("Type", <div className="h-11 rounded-xl bg-[var(--input)] border border-[var(--input-border)] px-3 flex items-center gap-4"><label className="text-xs font-bold"><input type="radio" name="type" defaultChecked className="mr-2" />Add In</label><label className="text-xs font-bold"><input type="radio" name="type" className="mr-2" />Paid Out</label></div>)}
            {floatingField("Attachment Upload", <input type="file" className="h-11 w-full rounded-xl bg-[var(--input)] border border-[var(--input-border)] px-3 text-[var(--text-secondary)] focus:outline-none focus:ring-2 focus:ring-blue-500" />)}
            <div className="md:col-span-2 pt-2">
              <Button type="button" variant="primary">Save</Button>
            </div>
          </form>
        </Card>
      )}

      {activeSubtab === "attachments" && (
        <Card title="Attachments" subtitle="Supporting petty cash files" noPadding>
          <DataTable
            data={pettyRows.filter((r) => !r.opening).map((r) => ({ id: r.id, pv: r.pvNo, file: `${r.pvNo}.pdf`, date: r.date, status: "Linked" }))}
            columns={[
              { header: "PV NO", accessor: "pv", className: "font-mono font-bold" },
              { header: "FILE", accessor: "file" },
              { header: "DATE", accessor: "date" },
              { header: "STATUS", accessor: "status" },
            ]}
          />
        </Card>
      )}

      {activeSubtab === "reconciliation" && (
        <Card title="Reconciliation Panel" subtitle="Variance auto display only">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {floatingField("Physical Cash Count", <input readOnly value={`UGX ${physicalCashCount.toLocaleString()}`} className="h-11 w-full rounded-xl bg-[var(--input)] border border-[var(--input-border)] px-3 text-right font-mono font-black text-[var(--text-primary)]" />)}
            {floatingField("System Balance", <input readOnly value={`UGX ${systemBalance.toLocaleString()}`} className="h-11 w-full rounded-xl bg-[var(--input)] border border-[var(--input-border)] px-3 text-right font-mono font-black text-[var(--text-primary)]" />)}
            {floatingField("Variance", <input readOnly value={`UGX ${variance.toLocaleString()}`} className={variance === 0 ? "h-11 w-full rounded-xl bg-[var(--input)] border border-[var(--input-border)] px-3 text-right font-mono font-black text-[var(--text-secondary)]" : variance > 0 ? "h-11 w-full rounded-xl bg-emerald-500/10 border border-emerald-500/20 px-3 text-right font-mono font-black text-emerald-300" : "h-11 w-full rounded-xl bg-rose-500/10 border border-rose-500/20 px-3 text-right font-mono font-black text-rose-300"} />)}
            {floatingField("Reason", <input type="text" placeholder="Reason for variance" className="h-11 w-full rounded-xl bg-[var(--input)] border border-[var(--input-border)] px-3 text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-blue-500" />)}
            {floatingField("Approved By", <input type="text" placeholder="Approver name" className="h-11 w-full rounded-xl bg-[var(--input)] border border-[var(--input-border)] px-3 text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-blue-500" />)}
          </div>
        </Card>
      )}
    </div>
  );
}

export default function FinanceTabPage() {
  const params = useParams<{ tab: string }>();
  const tab = params.tab as TabKey;
  const tabConfig = TAB_TITLES[tab];
  const { state } = useAuth();
  const { filters } = useGlobalDateFilters();
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [expenses, setExpenses] = useState<ExpenseRow[]>([]);
  const [aging, setAging] = useState<APAgingRow[]>([]);

  const [payOpen, setPayOpen] = useState(false);
  const [payInvoiceId, setPayInvoiceId] = useState<string | null>(null);
  const [payMethodId, setPayMethodId] = useState("");
  const [payReference, setPayReference] = useState("");
  const [paying, setPaying] = useState(false);

  const [viewPayment, setViewPayment] = useState<PaymentRow | null>(null);
  const [viewExpense, setViewExpense] = useState<ExpenseRow | null>(null);

  const [transitioningInvoiceId, setTransitioningInvoiceId] = useState<string | null>(null);
  const [transitioningExpenseId, setTransitioningExpenseId] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      if (!state.user) return;
      try {
        setError(null);
        setLoading(true);
        const [invoiceRows, expenseRows, agingRows, paymentRows] = await Promise.all([
          api.finance.getInvoices(state.user!),
          api.finance.getExpenses(state.user!),
          api.finance.getAPAging(state.user!),
          api.finance.getPayments(state.user!),
        ]);
        setInvoices(invoiceRows);
        setExpenses(expenseRows);
        setAging(agingRows);
        setPayments(paymentRows);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Failed to load finance tab");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [state.user, tab]);

  const withinRange = (raw: string | undefined) => {
    if (!raw) return false;
    const t = new Date(raw).getTime();
    if (Number.isNaN(t)) return false;
    const fromTs = filters.fromDate ? new Date(filters.fromDate).getTime() : undefined;
    const toTs = filters.toDate ? new Date(filters.toDate).getTime() : undefined;
    if (fromTs !== undefined && t < fromTs) return false;
    if (toTs !== undefined && t > toTs) return false;
    return true;
  };

  const q = query.trim().toLowerCase();

  const paymentMethodOptions = useMemo(() => {
    return mockDB.paymentMethods.map((pm) => ({ value: pm.id, label: pm.name }));
  }, []);

  const invoiceMetaById = useMemo(() => {
    const map = new Map<string, { grnId?: string; lpoId?: string; threeWayOk: boolean; threeWayReason: string }>();
    for (const inv of mockDB.vendorInvoices) {
      const grn = inv.grnId ? mockDB.goodsReceivedNotes.find((g) => g.id === inv.grnId) : undefined;
      const lpo = grn ? mockDB.localPurchaseOrders.find((l) => l.id === grn.lpoId) : undefined;

      let ok = true;
      let reason = "PASS";
      if (!inv.grnId) {
        ok = false;
        reason = "Missing GRN";
      } else if (!grn) {
        ok = false;
        reason = "GRN not found";
      } else if (grn.status !== "RECEIVED") {
        ok = false;
        reason = `GRN ${grn.status}`;
      } else if (!lpo) {
        ok = false;
        reason = "Missing LPO";
      } else if (lpo.status === "DRAFT" || lpo.status === "CANCELLED") {
        ok = false;
        reason = `LPO ${lpo.status}`;
      } else if (inv.amount !== grn.totalAmount) {
        ok = false;
        reason = "Amount != GRN";
      } else if (inv.amount > lpo.totalAmount) {
        ok = false;
        reason = "Amount > LPO";
      }

      map.set(inv.id, {
        grnId: inv.grnId || undefined,
        lpoId: lpo?.id,
        threeWayOk: ok,
        threeWayReason: reason,
      });
    }
    return map;
  }, []);

  const invoiceApprovalRows = useMemo(() => {
    return invoices
      .filter((i) => withinRange(i.dueDate))
      .map((i) => {
        const meta = invoiceMetaById.get(i.id);
        return {
          ...i,
          grnId: meta?.grnId ?? "—",
          lpoId: meta?.lpoId ?? "—",
          threeWay: meta ? (meta.threeWayOk ? "PASS" : `FAIL: ${meta.threeWayReason}`) : "—",
          threeWayOk: meta?.threeWayOk ?? false,
        };
      })
      .filter((i) => {
        if (!q) return true;
        return (
          i.id.toLowerCase().includes(q) ||
          i.vendorName.toLowerCase().includes(q) ||
          String(i.grnId).toLowerCase().includes(q) ||
          String(i.lpoId).toLowerCase().includes(q) ||
          String(i.status).toLowerCase().includes(q)
        );
      })
      .slice(0, 400);
  }, [invoices, invoiceMetaById, q, filters.fromDate, filters.toDate]);

  const filteredPayments = useMemo(() => {
    return payments
      .filter((p) => withinRange(p.paidAt))
      .filter((p) => {
        if (!q) return true;
        return (
          p.id.toLowerCase().includes(q) ||
          p.invoiceId.toLowerCase().includes(q) ||
          p.vendorName.toLowerCase().includes(q)
        );
      })
      .slice(0, 400);
  }, [payments, q, filters.fromDate, filters.toDate]);

  const expenseRows = useMemo(() => {
    return expenses
      .filter((e) => withinRange(e.date))
      .filter((e) => {
        if (!q) return true;
        return (
          e.id.toLowerCase().includes(q) ||
          e.categoryName.toLowerCase().includes(q) ||
          e.departmentName.toLowerCase().includes(q)
        );
      })
      .slice(0, 400);
  }, [expenses, q, filters.fromDate, filters.toDate]);

  const refreshFinance = async () => {
    if (!state.user) return;
    const [invoiceRows, expenseRowsNext, agingRows, paymentRows] = await Promise.all([
      api.finance.getInvoices(state.user),
      api.finance.getExpenses(state.user),
      api.finance.getAPAging(state.user),
      api.finance.getPayments(state.user),
    ]);
    setInvoices(invoiceRows);
    setExpenses(expenseRowsNext);
    setAging(agingRows);
    setPayments(paymentRows);
  };

  const approveInvoice = async (invoiceId: string) => {
    if (!state.user) return;
    try {
      setTransitioningInvoiceId(invoiceId);
      await api.finance.approveInvoice(state.user, invoiceId);
      await refreshFinance();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to approve invoice");
    } finally {
      setTransitioningInvoiceId(null);
    }
  };

  const rejectInvoice = async (invoiceId: string) => {
    if (!state.user) return;
    try {
      setTransitioningInvoiceId(invoiceId);
      await api.procurement.transitionInvoice(state.user, invoiceId, "REJECTED");
      await refreshFinance();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to reject invoice");
    } finally {
      setTransitioningInvoiceId(null);
    }
  };

  const openPayInvoice = (invoiceId: string) => {
    setPayInvoiceId(invoiceId);
    setPayMethodId(paymentMethodOptions[0]?.value ?? "");
    setPayReference(`TXN-${invoiceId}-${new Date().toISOString().slice(0, 10)}`);
    setPayOpen(true);
  };

  const payInvoice = async () => {
    if (!state.user || !payInvoiceId) return;
    const inv = invoices.find((i) => i.id === payInvoiceId);
    if (!inv) return;
    try {
      setPaying(true);
      await api.finance.payInvoice(state.user, {
        invoiceId: payInvoiceId,
        amount: inv.amount,
        paymentMethodId: payMethodId,
        reference: payReference || `TXN-${Date.now()}`,
      });
      setPayOpen(false);
      await refreshFinance();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to pay invoice");
    } finally {
      setPaying(false);
    }
  };

  const approveExpense = async (expenseId: string) => {
    if (!state.user) return;
    try {
      setTransitioningExpenseId(expenseId);
      await api.finance.approveExpense(state.user, expenseId);
      await refreshFinance();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to approve expense");
    } finally {
      setTransitioningExpenseId(null);
    }
  };

  const rejectExpense = async (expenseId: string) => {
    if (!state.user) return;
    try {
      setTransitioningExpenseId(expenseId);
      await api.finance.rejectExpense(state.user, expenseId);
      await refreshFinance();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to reject expense");
    } finally {
      setTransitioningExpenseId(null);
    }
  };

  const payExpense = async (expenseId: string) => {
    if (!state.user) return;
    const exp = expenses.find((e) => e.id === expenseId);
    if (!exp) return;
    try {
      setTransitioningExpenseId(expenseId);
      const methodId = paymentMethodOptions[0]?.value;
      if (!methodId) throw new Error("No payment methods available");
      await api.finance.payExpense(state.user, {
        expenseId,
        paymentMethodId: methodId,
        reference: `EXP-${expenseId}-${Date.now()}`,
      });
      await refreshFinance();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to pay expense");
    } finally {
      setTransitioningExpenseId(null);
    }
  };

  const filteredInvoices = invoices.filter((i) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return i.id.toLowerCase().includes(q) || i.vendorName.toLowerCase().includes(q) || i.status.toLowerCase().includes(q);
  }).filter((i) => withinRange(i.dueDate));

  const agingRows: APAgingTableRow[] = aging.map((a) => ({ id: a.bucket, ...a }));

  type SalesOversightRow = {
    id: string;
    date: string;
    outlet: string;
    shift: string;
    grossSales: number;
    netSales: number;
    cash: number;
    momo: number;
    variance: number;
    status: string;
  };

  type ProfitLossRow = {
    id: string;
    branch: string;
    revenue: number;
    cogs: number;
    opex: number;
    grossProfit: number;
    netProfit: number;
    marginPct: number;
  };

  type CashFlowRow = {
    id: string;
    date: string;
    branch: string;
    inflow: number;
    outflow: number;
    net: number;
    endingCash: number;
    notes: string;
  };

  type BankRecoRow = {
    id: string;
    date: string;
    branch: string;
    statementRef: string;
    description: string;
    debit: number;
    credit: number;
    matched: string;
    variance: number;
  };

  const selectedBranchName = useMemo(() => {
    if (filters.location === "ALL") return "All Branches";
    return mockDB.locations.find((l) => l.id === filters.location)?.name ?? filters.location;
  }, [filters.location]);

  const salesOversightRows = useMemo<SalesOversightRow[]>(() => {
    const baseDate = filters.fromDate ?? new Date().toISOString().slice(0, 10);
    return Array.from({ length: 12 }).map((_, idx) => {
      const d = new Date(baseDate);
      d.setDate(d.getDate() - idx);
      const date = d.toISOString().slice(0, 10);
      const gross = 2_400_000 + idx * 83_000;
      const net = gross - 120_000;
      const cash = Math.round(net * 0.45);
      const momo = net - cash;
      const variance = idx % 4 === 0 ? -7_000 : idx % 7 === 0 ? 4_000 : 0;
      return {
        id: `sale_ov_${idx + 1}`,
        date,
        outlet: selectedBranchName,
        shift: idx % 2 === 0 ? "DAY" : "NIGHT",
        grossSales: gross,
        netSales: net,
        cash,
        momo,
        variance,
        status: variance === 0 ? "RECONCILED" : "REVIEW",
      };
    }).filter((r) => withinRange(r.date));
  }, [filters.fromDate, filters.toDate, selectedBranchName]);

  const profitLossRows = useMemo<ProfitLossRow[]>(() => {
    const branches = filters.location === "ALL"
      ? mockDB.locations.filter((l) => l.type === "BRANCH" && l.status === "ACTIVE").slice(0, 6)
      : mockDB.locations.filter((l) => l.id === filters.location);

    return branches.map((b, idx) => {
      const revenue = 54_000_000 + idx * 6_500_000;
      const cogs = Math.round(revenue * 0.42);
      const opex = 9_500_000 + idx * 750_000;
      const grossProfit = revenue - cogs;
      const netProfit = grossProfit - opex;
      const marginPct = revenue === 0 ? 0 : (netProfit / revenue) * 100;
      return {
        id: `pnl_${b.id}`,
        branch: b.name,
        revenue,
        cogs,
        opex,
        grossProfit,
        netProfit,
        marginPct,
      };
    });
  }, [filters.location]);

  const cashFlowRows = useMemo<CashFlowRow[]>(() => {
    const baseDate = filters.fromDate ?? new Date().toISOString().slice(0, 10);
    let endingCash = 18_000_000;

    return Array.from({ length: 10 }).map((_, idx) => {
      const d = new Date(baseDate);
      d.setDate(d.getDate() - idx);
      const date = d.toISOString().slice(0, 10);
      const inflow = 5_200_000 + idx * 135_000;
      const outflow = 4_850_000 + idx * 120_000;
      const net = inflow - outflow;
      endingCash += net;
      return {
        id: `cf_${idx + 1}`,
        date,
        branch: selectedBranchName,
        inflow,
        outflow,
        net,
        endingCash,
        notes: idx % 3 === 0 ? "Supplier settlement" : "Operations",
      };
    }).filter((r) => withinRange(r.date));
  }, [filters.fromDate, filters.toDate, selectedBranchName]);

  const bankRecoRows = useMemo<BankRecoRow[]>(() => {
    const baseDate = filters.fromDate ?? new Date().toISOString().slice(0, 10);
    return Array.from({ length: 14 }).map((_, idx) => {
      const d = new Date(baseDate);
      d.setDate(d.getDate() - idx);
      const date = d.toISOString().slice(0, 10);
      const debit = idx % 3 === 0 ? 0 : 1_200_000 + idx * 41_000;
      const credit = idx % 3 === 0 ? 2_450_000 + idx * 37_000 : 0;
      const matched = idx % 5 === 0 ? "NO" : "YES";
      const variance = matched === "YES" ? 0 : idx % 2 === 0 ? -12_000 : 18_000;
      return {
        id: `reco_${idx + 1}`,
        date,
        branch: selectedBranchName,
        statementRef: `STMT-${date.replace(/-/g, "")}-${String(idx + 1).padStart(3, "0")}`,
        description: idx % 2 === 0 ? "Card settlement" : "Bank transfer",
        debit,
        credit,
        matched,
        variance,
      };
    }).filter((r) => withinRange(r.date));
  }, [filters.fromDate, filters.toDate, selectedBranchName]);

  return (
    <div className="p-8 space-y-8 max-w-[1600px] mx-auto">
      {!tabConfig && <DashboardError title="Finance" message="Tab not found" />}
      {tabConfig && loading && <DashboardLoading titleWidthClassName="w-1/3" />}
      {tabConfig && !loading && error && <DashboardError title={tabConfig.title} message={error} />}

      {tabConfig && !loading && !error && (
        <>
          <div className="overflow-x-auto">
            <div className="flex gap-2 min-w-max border-b border-[var(--border-subtle)] pb-2">
              {FINANCE_TABS.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={item.href.endsWith(`/${tab}`) ? "px-3 py-2 rounded-xl bg-[var(--surface-raised)] text-[var(--text-primary)] text-xs font-black uppercase tracking-wider" : "px-3 py-2 rounded-xl text-[var(--text-muted)] hover:text-[var(--text-primary)] text-xs font-black uppercase tracking-wider"}
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </div>

      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-[var(--text-primary)] tracking-tighter uppercase">{tabConfig.title}</h1>
          <p className="text-[var(--text-secondary)] font-medium">{tabConfig.subtitle}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="h-9 px-3 rounded-xl bg-[var(--input)] border border-[var(--input-border)] inline-flex items-center gap-2 text-[var(--text-muted)]">
            <Search className="w-4 h-4" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Quick search" className="bg-transparent outline-none text-sm text-[var(--text-primary)]" />
          </label>
          <Button variant="outline" size="sm"><Download className="w-4 h-4 mr-2" />Export</Button>
        </div>
      </div>

      {tab === "accounts-payable" && (
        <>
          <Card title="Accounts Payable Aging" noPadding>
            <DataTable<APAgingTableRow>
              data={agingRows}
              columns={[
                { header: "Bucket", accessor: "bucket", className: "font-bold" },
                { header: "Amount", accessor: (a) => `UGX ${a.amount.toLocaleString()}`, className: "text-right font-mono font-black text-[var(--text-primary)]" },
                { header: "Invoices", accessor: "invoiceCount", className: "text-right font-mono font-black" },
              ]}
            />
          </Card>
          <Card title="Invoice Approval" subtitle="3-way match + settlement" noPadding>
            <DataTable
              data={invoiceApprovalRows}
              columns={[
                { header: "Invoice #", accessor: "id", className: "font-mono font-bold" },
                { header: "Vendor", accessor: "vendorName", className: "font-bold text-[var(--text-primary)]" },
                { header: "GRN", accessor: (r: any) => r.grnId, className: "font-mono text-[var(--text-muted)]" },
                { header: "LPO", accessor: (r: any) => r.lpoId, className: "font-mono text-[var(--text-muted)]" },
                { header: "Amount", accessor: (i: InvoiceRow) => `UGX ${i.amount.toLocaleString()}`, className: "text-right font-mono font-black text-[var(--text-primary)]" },
                { header: "3-Way Match Status", accessor: (r: any) => (r.threeWayOk ? "PASS" : r.threeWay), className: "text-[var(--text-muted)]" },
                { header: "Due Date", accessor: (i: InvoiceRow) => new Date(i.dueDate).toLocaleDateString(), className: "text-[var(--text-muted)]" },
                { header: "Status", accessor: "status", className: "text-[var(--text-muted)]" },
                {
                  header: "Action",
                  accessor: (r: any) => (
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        disabled={!(r.status === "PENDING" && r.threeWayOk)}
                        isLoading={transitioningInvoiceId === r.id}
                        onClick={() => approveInvoice(r.id)}
                      >
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={r.status !== "PENDING"}
                        isLoading={transitioningInvoiceId === r.id}
                        onClick={() => rejectInvoice(r.id)}
                      >
                        Reject
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={r.status !== "APPROVED"}
                        onClick={() => openPayInvoice(r.id)}
                      >
                        Pay
                      </Button>
                    </div>
                  ),
                },
              ]}
              emptyMessage="No invoices available"
            />
          </Card>
        </>
      )}

      {tab === "payments" && (
        <Card title="Payments" subtitle="Disbursement register" noPadding>
          <DataTable
            data={filteredPayments}
            columns={[
              { header: "Payment ID", accessor: "id", className: "font-mono font-bold" },
              { header: "Invoice #", accessor: "invoiceId", className: "font-mono" },
              { header: "Vendor", accessor: "vendorName", className: "font-bold text-[var(--text-primary)]" },
              { header: "Amount", accessor: (p: PaymentRow) => `UGX ${p.amount.toLocaleString()}`, className: "text-right font-mono font-black text-[var(--text-primary)]" },
              { header: "MOP", accessor: "paymentMethod", className: "text-[var(--text-muted)]" },
              { header: "Bank", accessor: () => "—", className: "text-[var(--text-muted)]" },
              { header: "Status", accessor: () => "PAID", className: "text-[var(--text-muted)]" },
              { header: "Payment Date", accessor: (p: PaymentRow) => new Date(p.paidAt).toLocaleDateString(), className: "text-[var(--text-muted)]" },
              {
                header: "Action",
                accessor: (p: PaymentRow) => (
                  <Button size="sm" variant="outline" onClick={() => setViewPayment(p)}>
                    View
                  </Button>
                ),
              },
            ]}
            emptyMessage="No payments available"
          />
        </Card>
      )}

      {tab === "expenses" && (
        <Card title="Expenses" subtitle="Approval + payment" noPadding>
          <DataTable
            data={expenseRows}
            columns={[
              { header: "Expense ID", accessor: "id", className: "font-mono font-bold" },
              { header: "Expense Type", accessor: "categoryName", className: "font-bold text-[var(--text-primary)]" },
              { header: "Account", accessor: "departmentName", className: "text-[var(--text-muted)]" },
              { header: "Amount", accessor: (e: ExpenseRow) => `UGX ${e.amount.toLocaleString()}`, className: "text-right font-mono font-black text-[var(--text-primary)]" },
              { header: "Linked Payment", accessor: (e: any) => e.paymentId ?? "—", className: "font-mono text-[var(--text-muted)]" },
              { header: "Date", accessor: (e: ExpenseRow) => new Date(e.date).toLocaleDateString(), className: "text-[var(--text-muted)]" },
              { header: "Status", accessor: (e: any) => `${e.approvalStatus ?? "SUBMITTED"} / ${e.status ?? "UNPAID"}`, className: "text-[var(--text-muted)]" },
              {
                header: "Action",
                accessor: (e: any) => (
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      disabled={(e.approvalStatus ?? "SUBMITTED") !== "SUBMITTED"}
                      isLoading={transitioningExpenseId === e.id}
                      onClick={() => approveExpense(e.id)}
                    >
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={(e.approvalStatus ?? "SUBMITTED") !== "SUBMITTED"}
                      isLoading={transitioningExpenseId === e.id}
                      onClick={() => rejectExpense(e.id)}
                    >
                      Reject
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={!((e.approvalStatus ?? "SUBMITTED") === "APPROVED" && (e.status ?? "UNPAID") === "UNPAID")}
                      isLoading={transitioningExpenseId === e.id}
                      onClick={() => payExpense(e.id)}
                    >
                      Pay
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setViewExpense(e)}>
                      View
                    </Button>
                  </div>
                ),
              },
            ]}
            emptyMessage="No expenses available"
          />
        </Card>
      )}

      {tab === "petty-cash" && <PettyCashModule expenses={expenseRows} />}

      {["sales-oversight", "profit-loss", "cash-flow", "bank-reconciliation"].includes(tab) && (
        <>
          {tab === "sales-oversight" && (
            <Card title="Sales Oversight" subtitle="Daily posting & variance" noPadding>
              <DataTable<SalesOversightRow>
                data={salesOversightRows}
                columns={[
                  { header: "Date", accessor: (r) => new Date(r.date).toLocaleDateString(), className: "text-[var(--text-muted)]" },
                  { header: "Outlet", accessor: "outlet", className: "font-bold text-[var(--text-primary)]" },
                  { header: "Shift", accessor: "shift", className: "font-mono" },
                  { header: "Gross", accessor: (r) => `UGX ${r.grossSales.toLocaleString()}`, className: "text-right font-mono font-black text-[var(--text-primary)]" },
                  { header: "Net", accessor: (r) => `UGX ${r.netSales.toLocaleString()}`, className: "text-right font-mono font-black" },
                  { header: "Cash", accessor: (r) => `UGX ${r.cash.toLocaleString()}`, className: "text-right font-mono font-black" },
                  { header: "MoMo", accessor: (r) => `UGX ${r.momo.toLocaleString()}`, className: "text-right font-mono font-black" },
                  {
                    header: "Variance",
                    accessor: (r) => (
                      <span className={r.variance === 0 ? "text-emerald-300" : "text-amber-300"}>
                        {`UGX ${r.variance.toLocaleString()}`}
                      </span>
                    ),
                    className: "text-right font-mono font-black",
                  },
                  { header: "Status", accessor: "status", className: "text-[var(--text-muted)]" },
                ]}
                emptyMessage="No sales oversight rows available"
              />
            </Card>
          )}

          {tab === "profit-loss" && (
            <Card title="Profit & Loss" subtitle="Branch profitability snapshot" noPadding>
              <DataTable<ProfitLossRow>
                data={profitLossRows}
                columns={[
                  { header: "Branch", accessor: "branch", className: "font-bold text-[var(--text-primary)]" },
                  { header: "Revenue", accessor: (r) => `UGX ${r.revenue.toLocaleString()}`, className: "text-right font-mono font-black text-[var(--text-primary)]" },
                  { header: "COGS", accessor: (r) => `UGX ${r.cogs.toLocaleString()}`, className: "text-right font-mono font-black" },
                  { header: "OPEX", accessor: (r) => `UGX ${r.opex.toLocaleString()}`, className: "text-right font-mono font-black" },
                  { header: "Gross Profit", accessor: (r) => `UGX ${r.grossProfit.toLocaleString()}`, className: "text-right font-mono font-black text-emerald-300" },
                  {
                    header: "Net Profit",
                    accessor: (r) => (
                      <span className={r.netProfit >= 0 ? "text-emerald-300" : "text-rose-300"}>
                        {`UGX ${r.netProfit.toLocaleString()}`}
                      </span>
                    ),
                    className: "text-right font-mono font-black",
                  },
                  { header: "Margin %", accessor: (r) => `${r.marginPct.toFixed(1)}%`, className: "text-right font-mono font-black" },
                ]}
                emptyMessage="No P&L rows available"
              />
            </Card>
          )}

          {tab === "cash-flow" && (
            <Card title="Cash Flow" subtitle="Daily inflow/outflow" noPadding>
              <DataTable<CashFlowRow>
                data={cashFlowRows}
                columns={[
                  { header: "Date", accessor: (r) => new Date(r.date).toLocaleDateString(), className: "text-[var(--text-muted)]" },
                  { header: "Branch", accessor: "branch", className: "font-bold text-[var(--text-primary)]" },
                  { header: "Inflow", accessor: (r) => `UGX ${r.inflow.toLocaleString()}`, className: "text-right font-mono font-black text-emerald-300" },
                  { header: "Outflow", accessor: (r) => `UGX ${r.outflow.toLocaleString()}`, className: "text-right font-mono font-black text-rose-300" },
                  {
                    header: "Net",
                    accessor: (r) => (
                      <span className={r.net >= 0 ? "text-emerald-300" : "text-rose-300"}>
                        {`UGX ${r.net.toLocaleString()}`}
                      </span>
                    ),
                    className: "text-right font-mono font-black",
                  },
                  { header: "Ending Cash", accessor: (r) => `UGX ${r.endingCash.toLocaleString()}`, className: "text-right font-mono font-black text-[var(--text-primary)]" },
                  { header: "Notes", accessor: "notes", className: "text-[var(--text-muted)]" },
                ]}
                emptyMessage="No cash flow rows available"
              />
            </Card>
          )}

          {tab === "bank-reconciliation" && (
            <Card title="Bank Reconciliation" subtitle="Statement matching" noPadding>
              <DataTable<BankRecoRow>
                data={bankRecoRows}
                columns={[
                  { header: "Date", accessor: (r) => new Date(r.date).toLocaleDateString(), className: "text-[var(--text-muted)]" },
                  { header: "Branch", accessor: "branch", className: "font-bold text-[var(--text-primary)]" },
                  { header: "Statement Ref", accessor: "statementRef", className: "font-mono font-bold" },
                  { header: "Description", accessor: "description" },
                  { header: "Debit", accessor: (r) => (r.debit ? `UGX ${r.debit.toLocaleString()}` : "-"), className: "text-right font-mono font-black" },
                  { header: "Credit", accessor: (r) => (r.credit ? `UGX ${r.credit.toLocaleString()}` : "-"), className: "text-right font-mono font-black" },
                  { header: "Matched", accessor: "matched", className: "text-[var(--text-muted)]" },
                  {
                    header: "Variance",
                    accessor: (r) => (
                      <span className={r.variance === 0 ? "text-emerald-300" : "text-amber-300"}>
                        {`UGX ${r.variance.toLocaleString()}`}
                      </span>
                    ),
                    className: "text-right font-mono font-black",
                  },
                ]}
                emptyMessage="No reconciliation rows available"
              />
            </Card>
          )}
        </>
      )}

      <Modal open={payOpen} onClose={() => setPayOpen(false)} title="Pay Invoice">
        <div className="space-y-4">
          <div className="text-sm text-[var(--text-secondary)]">Invoice: <span className="font-mono font-black text-[var(--text-primary)]">{payInvoiceId}</span></div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <label className="space-y-1">
              <div className="text-xs font-black uppercase tracking-wider text-[var(--text-muted)]">Payment Method</div>
              <select value={payMethodId} onChange={(e) => setPayMethodId(e.target.value)} className="h-10 w-full px-3 rounded-xl bg-[var(--input)] border border-[var(--input-border)] text-[var(--text-primary)]">
                {paymentMethodOptions.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </label>
            <label className="space-y-1">
              <div className="text-xs font-black uppercase tracking-wider text-[var(--text-muted)]">Reference</div>
              <input value={payReference} onChange={(e) => setPayReference(e.target.value)} className="h-10 w-full px-3 rounded-xl bg-[var(--input)] border border-[var(--input-border)] text-[var(--text-primary)]" />
            </label>
          </div>
        </div>
        <ModalFooter>
          <Button variant="outline" onClick={() => setPayOpen(false)} disabled={paying}>Cancel</Button>
          <Button onClick={payInvoice} isLoading={paying} disabled={!payInvoiceId || !payMethodId}>Pay</Button>
        </ModalFooter>
      </Modal>

      <Modal open={!!viewPayment} onClose={() => setViewPayment(null)} title="Payment Details">
        <div className="space-y-2 text-sm">
          <div><span className="text-[var(--text-muted)]">Payment ID:</span> <span className="font-mono font-black">{viewPayment?.id}</span></div>
          <div><span className="text-[var(--text-muted)]">Invoice:</span> <span className="font-mono font-black">{viewPayment?.invoiceId}</span></div>
          <div><span className="text-[var(--text-muted)]">Vendor:</span> <span className="font-black">{viewPayment?.vendorName}</span></div>
          <div><span className="text-[var(--text-muted)]">Amount:</span> <span className="font-mono font-black">UGX {viewPayment?.amount?.toLocaleString?.() ?? "—"}</span></div>
          <div><span className="text-[var(--text-muted)]">Method:</span> <span className="font-black">{viewPayment?.paymentMethod}</span></div>
          <div><span className="text-[var(--text-muted)]">Paid At:</span> <span className="font-black">{viewPayment?.paidAt ? new Date(viewPayment.paidAt).toLocaleString() : "—"}</span></div>
          <div><span className="text-[var(--text-muted)]">Reference:</span> <span className="font-mono">{viewPayment?.reference ?? "—"}</span></div>
        </div>
        <ModalFooter>
          <Button variant="outline" onClick={() => setViewPayment(null)}>Close</Button>
        </ModalFooter>
      </Modal>

      <Modal open={!!viewExpense} onClose={() => setViewExpense(null)} title="Expense Details">
        <div className="space-y-2 text-sm">
          <div><span className="text-[var(--text-muted)]">Expense ID:</span> <span className="font-mono font-black">{viewExpense?.id}</span></div>
          <div><span className="text-[var(--text-muted)]">Type:</span> <span className="font-black">{(viewExpense as any)?.categoryName ?? "—"}</span></div>
          <div><span className="text-[var(--text-muted)]">Account:</span> <span className="font-black">{(viewExpense as any)?.departmentName ?? "—"}</span></div>
          <div><span className="text-[var(--text-muted)]">Amount:</span> <span className="font-mono font-black">UGX {viewExpense?.amount?.toLocaleString?.() ?? "—"}</span></div>
          <div><span className="text-[var(--text-muted)]">Date:</span> <span className="font-black">{viewExpense?.date ? new Date(viewExpense.date).toLocaleString() : "—"}</span></div>
          <div><span className="text-[var(--text-muted)]">Status:</span> <span className="font-black">{`${(viewExpense as any)?.approvalStatus ?? "SUBMITTED"} / ${(viewExpense as any)?.status ?? "UNPAID"}`}</span></div>
          <div><span className="text-[var(--text-muted)]">Notes:</span> <span className="font-black">{(viewExpense as any)?.notes ?? "—"}</span></div>
        </div>
        <ModalFooter>
          <Button variant="outline" onClick={() => setViewExpense(null)}>Close</Button>
        </ModalFooter>
      </Modal>
        </>
      )}
    </div>
  );
}
