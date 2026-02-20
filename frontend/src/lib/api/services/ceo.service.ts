/**
 * CEO Service — Executive-only aggregated data.
 * Delegates to reporting.service.ts.
 * No direct access to operational tables (inventory, procurement, etc.).
 */

import { reportingService } from "./reporting.service";
import type {
    ExecutiveSummary,
    BranchRanking,
    RevenueTrendPoint,
} from "./reporting.service";

export type { ExecutiveSummary, BranchRanking, RevenueTrendPoint };

export interface CEOAlert {
    id: string;
    severity: "HIGH" | "MEDIUM" | "LOW";
    message: string;
    locationName: string;
}

export interface CEODashboardData {
    summary: ExecutiveSummary;
    branchRanking: BranchRanking[];
    revenueTrend: RevenueTrendPoint[];
    alerts: CEOAlert[];
}

export const ceoService = {
    async getDashboard(): Promise<CEODashboardData> {
        const [summary, branchRanking, revenueTrend] = await Promise.all([
            reportingService.getExecutiveSummary(),
            reportingService.getBranchRanking(),
            reportingService.getRevenueTrend(),
        ]);

        // Derive alerts from aggregated data (not raw tables)
        const alerts: CEOAlert[] = [];
        if (summary.unpaidInvoices > 3) {
            alerts.push({ id: "alt-inv", severity: "HIGH", message: `${summary.unpaidInvoices} unpaid invoices across locations`, locationName: "System-wide" });
        }
        if (summary.activeRequisitions > 5) {
            alerts.push({ id: "alt-req", severity: "MEDIUM", message: `${summary.activeRequisitions} active requisitions pending`, locationName: "System-wide" });
        }
        for (const branch of branchRanking) {
            if (branch.profit < 0) {
                alerts.push({ id: `alt-loss-${branch.locationId}`, severity: "HIGH", message: `${branch.locationName} is operating at a loss`, locationName: branch.locationName });
            }
        }

        return { summary, branchRanking, revenueTrend, alerts };
    },

    getExecutiveSummary: () => reportingService.getExecutiveSummary(),
    getBranchRanking: () => reportingService.getBranchRanking(),
    getRevenueTrend: () => reportingService.getRevenueTrend(),
};
