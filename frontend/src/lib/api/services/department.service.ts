/**
 * Department Dashboard Composition Layer
 * Composes data from domain services: inventory, procurement, finance.
 * No direct mockDB access — all data flows through domain services.
 * Used by DEPARTMENT_HEAD role only.
 */

import type { AuthUser } from "@/lib/auth/types";
import { inventoryService } from "./inventory.service";
import { procurementService } from "./procurement.service";
import { financeService } from "./finance.service";

export interface DepartmentDashboardData {
    departmentName: string;
    locationName: string;
    stockItems: { itemName: string; sku: string; quantity: number; uom: string }[];
    requisitions: { id: string; totalAmount: number; status: string; createdAt: string; itemCount: number }[];
    kpis: {
        totalStockItems: number;
        pendingRequisitions: number;
        approvedRequisitions: number;
        totalSpend: number;
    };
}

export const departmentService = {
    async getDashboard(user: AuthUser): Promise<DepartmentDashboardData> {
        const [deptStock, requisitions, expenses] = await Promise.all([
            inventoryService.getDepartmentStock(user),
            procurementService.getRequisitions(user),
            financeService.getExpenses(user),
        ]);

        const stockItems = deptStock.map((ds) => ({
            itemName: ds.itemName,
            sku: ds.sku,
            quantity: ds.currentQuantity,
            uom: ds.uom,
        }));

        const reqRows = requisitions.map((r) => ({
            id: r.id,
            totalAmount: r.totalAmount,
            status: r.status,
            createdAt: r.createdAt,
            itemCount: r.itemCount,
        }));

        const locationName = requisitions[0]?.locationName ?? deptStock[0]?.departmentName ?? "—";
        const departmentName = deptStock[0]?.departmentName ?? "—";

        return {
            departmentName,
            locationName,
            stockItems,
            requisitions: reqRows,
            kpis: {
                totalStockItems: stockItems.length,
                pendingRequisitions: requisitions.filter((r) => r.status === "SUBMITTED").length,
                approvedRequisitions: requisitions.filter((r) => r.status === "APPROVED").length,
                totalSpend: expenses.reduce((s, e) => s + e.amount, 0),
            },
        };
    },

    /** Delegates to procurementService.createRequisition — single source of truth */
    async createRequisition(
        user: AuthUser,
        input: { items: { itemId: string; quantity: number; estimatedPrice: number }[] }
    ) {
        const locId = user.scope.locationId;
        const deptId = user.scope.departmentId;
        if (!locId || !deptId) throw new Error("Department head must have location and department assigned");

        return procurementService.createRequisition(user, {
            locationId: locId,
            departmentId: deptId,
            items: input.items,
        });
    },
};
