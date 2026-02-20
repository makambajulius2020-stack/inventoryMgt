/**
 * GM Dashboard Composition Layer
 * Composes data from domain services: reporting, inventory, admin.
 * No direct mockDB access — all data flows through domain services.
 */

import type { AuthUser } from "@/lib/auth/types";
import { reportingService } from "./reporting.service";
import { inventoryService } from "./inventory.service";
import { adminService } from "./admin.service";

export interface GmDashboardData {
    locationName: string;
    revenue: number;
    expenses: number;
    profit: number;
    stockValue: number;
    staffCount: number;
    pendingRequisitions: number;
    lowStockItems: number;
    departments: { name: string; staffCount: number }[];
    inventoryHealth: { category: string; healthPercent: number; status: "GOOD" | "WARN" | "CRITICAL" }[];
}

export const gmService = {
    async getDashboard(user: AuthUser): Promise<GmDashboardData> {
        const [summary, stock, departments] = await Promise.all([
            reportingService.getLocationSummary(user),
            inventoryService.getLocationStock(user),
            adminService.listDepartments(user),
        ]);

        // Compute inventory health by category from domain stock data
        const catHealth: Record<string, { total: number; healthy: number }> = {};
        for (const row of stock) {
            const cat = row.categoryName || "Other";
            if (!catHealth[cat]) catHealth[cat] = { total: 0, healthy: 0 };
            catHealth[cat].total++;
            if (row.status === "HEALTHY") catHealth[cat].healthy++;
        }

        const inventoryHealth = Object.entries(catHealth).map(([category, data]) => {
            const pct = data.total > 0 ? Math.round((data.healthy / data.total) * 100) : 0;
            return {
                category,
                healthPercent: pct,
                status: (pct >= 70 ? "GOOD" : pct >= 40 ? "WARN" : "CRITICAL") as "GOOD" | "WARN" | "CRITICAL",
            };
        });

        return {
            ...summary,
            departments: departments.map((d) => ({ name: d.name, staffCount: 0 })),
            inventoryHealth,
        };
    },
};
