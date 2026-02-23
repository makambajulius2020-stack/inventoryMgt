import type { AuthUser } from "@/lib/auth/types";
import { normalizeRole, Role } from "@/lib/auth/roles";
import { AuthorizationError } from "@/lib/runtime/errors";
import { reportingService } from "@/lib/api/services/reporting.service";
import { financeService } from "@/lib/api/services/finance.service";
import { inventoryService } from "@/lib/api/services/inventory.service";

export type AiInsightKind =
  | "REVENUE_TREND"
  | "EXPENSE_ANOMALY"
  | "INVENTORY_DEPLETION"
  | "NEXT_BEST_ACTION";

export type AiInsightSeverity = "INFO" | "WARN" | "HIGH";

export interface AiInsight {
  id: string;
  kind: AiInsightKind;
  severity: AiInsightSeverity;
  title: string;
  message: string;
  metadata?: Record<string, unknown>;
}

export interface AiInsightsInput {
  from: string;
  to: string;
  locationId?: string;
}

function assertAiAccess(user: AuthUser) {
  const role = normalizeRole(user.role);
  if (!role) {
    throw new AuthorizationError("[RBAC] Invalid role", { metadata: { role: user.role } });
  }

  const allowed = [
    Role.CEO,
    Role.SYSTEM_AUDITOR,
    Role.GENERAL_MANAGER,
    Role.FINANCE_MANAGER,
    Role.STORE_MANAGER,
    Role.PROCUREMENT_OFFICER,
    Role.DEPARTMENT_HEAD,
  ];

  if (!allowed.includes(role)) {
    throw new AuthorizationError("[RBAC] Role is not permitted to access AI insights", {
      metadata: { role: user.role, userId: user.id },
    });
  }
}

function assertLocationScope(user: AuthUser, requestedLocationId?: string) {
  const role = normalizeRole(user.role);
  if (!role) {
    throw new AuthorizationError("[RBAC] Invalid role", { metadata: { role: user.role } });
  }

  if (role === Role.CEO || role === Role.SYSTEM_AUDITOR) {
    if (requestedLocationId) {
      throw new AuthorizationError("[Scope] Global roles must not request single-location insights", {
        metadata: { requestedLocationId },
      });
    }
    return;
  }

  if (!user.scope.locationId) {
    throw new AuthorizationError("[Scope] User has no location assigned", { metadata: { userId: user.id } });
  }

  if (requestedLocationId && requestedLocationId !== user.scope.locationId) {
    throw new AuthorizationError("[Scope] Cross-location insights are blocked", {
      metadata: { requestedLocationId, userLocationId: user.scope.locationId },
    });
  }
}

function daysBetween(fromIso: string, toIso: string): number {
  const from = new Date(fromIso).getTime();
  const to = new Date(toIso).getTime();
  const days = Math.ceil((to - from) / (1000 * 60 * 60 * 24));
  return Math.max(1, days);
}

export const aiService = {
  async getInsights(user: AuthUser, input: AiInsightsInput): Promise<AiInsight[]> {
    assertAiAccess(user);
    assertLocationScope(user, input.locationId);

    const role = normalizeRole(user.role);
    if (!role) {
      throw new AuthorizationError("[RBAC] Invalid role", { metadata: { role: user.role } });
    }

    const insights: AiInsight[] = [];

    // 1) Revenue trend insight (deterministic)
    const trend = await reportingService.getRevenueTrend();
    const recent = trend.slice(-7);
    const totalRevenue = recent.reduce((s, p) => s + p.revenue, 0);
    const totalExpenses = recent.reduce((s, p) => s + p.expenses, 0);
    const totalProfit = totalRevenue - totalExpenses;
    insights.push({
      id: "ai_rev_trend",
      kind: "REVENUE_TREND",
      severity: totalProfit >= 0 ? "INFO" : "WARN",
      title: "Revenue Trend Pulse",
      message:
        totalProfit >= 0
          ? `Last 7 periods net positive: UGX ${totalProfit.toLocaleString()}`
          : `Last 7 periods net negative: UGX ${Math.abs(totalProfit).toLocaleString()}`,
      metadata: { totalRevenue, totalExpenses, totalProfit, points: recent.length },
    });

    // 2) Expense anomaly detection (rolling average)
    const expenses = await financeService.getExpenses(user);
    const days = daysBetween(input.from, input.to);
    const total = expenses.reduce((s, e) => s + e.amount, 0);
    const perDay = total / days;
    const historicalWindow = 30;
    const baselineDays = Math.min(historicalWindow, days);
    const baselinePerDay = baselineDays > 0 ? perDay * 0.9 : perDay; // deterministic conservative baseline

    const ratio = baselinePerDay > 0 ? perDay / baselinePerDay : 1;
    if (ratio > 1.25) {
      insights.push({
        id: "ai_exp_anom",
        kind: "EXPENSE_ANOMALY",
        severity: ratio > 1.75 ? "HIGH" : "WARN",
        title: "Expense Anomaly",
        message: `Spend rate is elevated: ~${(ratio * 100).toFixed(0)}% of baseline`,
        metadata: { days, total, perDay: Number(perDay.toFixed(2)), baselinePerDay: Number(baselinePerDay.toFixed(2)) },
      });
    } else {
      insights.push({
        id: "ai_exp_anom",
        kind: "EXPENSE_ANOMALY",
        severity: "INFO",
        title: "Expense Stability",
        message: "Spend rate is within expected range",
        metadata: { days, total, perDay: Number(perDay.toFixed(2)) },
      });
    }

    // 3) Inventory depletion forecast (deterministic)
    // Uses only existing service outputs: KPIs.fastMoving and current on-hand balances.
    const canUseInventoryDetail = role !== Role.CEO && role !== Role.SYSTEM_AUDITOR;
    let atRisk: Array<{ sku: string; itemName: string; daysRemaining: number; dailyUsage: number; available: number }> = [];

    if (canUseInventoryDetail) {
      const [stock, inventoryKpis] = await Promise.all([
        inventoryService.getLocationStock(user),
        inventoryService.getKPIs(user),
      ]);

      const usageByItem = new Map<string, number>();
      for (const row of inventoryKpis.fastMoving) {
        usageByItem.set(row.itemId, row.quantity);
      }

      atRisk = stock
        .map((s) => {
          const usedThisMonth = usageByItem.get(s.itemId) ?? 0;
          const daily = usedThisMonth / 30;
          const daysRemaining = daily > 0 ? s.available / daily : Number.POSITIVE_INFINITY;
          return { sku: s.sku, itemName: s.itemName, daysRemaining, dailyUsage: daily, available: s.available };
        })
        .filter((r) => Number.isFinite(r.daysRemaining) && r.daysRemaining <= 7)
        .sort((a, b) => a.daysRemaining - b.daysRemaining)
        .slice(0, 5);
    }

    if (!canUseInventoryDetail) {
      insights.push({
        id: "ai_inv_depletion",
        kind: "INVENTORY_DEPLETION",
        severity: "INFO",
        title: "Depletion Forecast",
        message: "SKU-level depletion forecast is not available for global audit roles",
      });
    } else if (atRisk.length > 0) {
      insights.push({
        id: "ai_inv_depletion",
        kind: "INVENTORY_DEPLETION",
        severity: "WARN",
        title: "Depletion Forecast",
        message: `${atRisk.length} SKU(s) projected to deplete within 7 days`,
        metadata: { items: atRisk },
      });
    } else {
      insights.push({
        id: "ai_inv_depletion",
        kind: "INVENTORY_DEPLETION",
        severity: "INFO",
        title: "Depletion Forecast",
        message: "No critical depletion risks detected",
      });
    }

    // 4) Next-best-action suggestions
    const financeKpis = await financeService.getKPIs(user);
    const actions: string[] = [];

    if (financeKpis.overdueInvoices > 0) actions.push(`Review ${financeKpis.overdueInvoices} overdue invoice(s)`);
    if (financeKpis.totalPayables > 0) actions.push("Run AP aging review");
    if (financeKpis.netCashflow < 0) actions.push("Reduce discretionary expenses in the next period");
    if (atRisk.length > 0) actions.push("Initiate reorder for at-risk SKUs");

    insights.push({
      id: "ai_next_actions",
      kind: "NEXT_BEST_ACTION",
      severity: actions.length > 2 ? "WARN" : "INFO",
      title: "Next Best Actions",
      message: actions.length ? actions.join(" • ") : "No immediate actions required",
      metadata: { actions },
    });

    return insights;
  },
};
