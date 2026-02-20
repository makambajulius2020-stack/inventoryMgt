"use client";

import React, { useEffect, useState } from "react";
import {
    ShoppingCart,
    Package,
    Users,
    TrendingUp,
    ArrowRight
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { StatCard } from "@/components/ui/StatCard";
import { api } from "@/lib/api/client";
import { useAuth } from "@/contexts/AuthContext";
import { useGlobalDateFilters } from "@/contexts/GlobalDateFiltersContext";
import type { ExecutiveReports } from "@/lib/api/services/reporting.service";
import type { InventoryKPIs } from "@/lib/api/services/inventory.service";
import type { ProcurementKPIs } from "@/lib/api/services/procurement.service";

type GmOverviewData = {
    locationName: string;
    reports: ExecutiveReports;
    inventory: InventoryKPIs;
    procurement: ProcurementKPIs;
};

export default function GmDashboard() {
    const { state } = useAuth();
    const { filters } = useGlobalDateFilters();
    const [data, setData] = useState<GmOverviewData | null>(null);
    const [loading, setLoading] = useState(true);
    const [accessError, setAccessError] = useState<string | null>(null);

    useEffect(() => {
        async function load() {
            try {
                setAccessError(null);
                if (!state.user?.scope.locationId) return;

                const from = filters.fromDate ? `${filters.fromDate}T00:00:00Z` : "2026-02-01T00:00:00Z";
                const to = filters.toDate ? `${filters.toDate}T23:59:59Z` : "2026-02-28T23:59:59Z";

                const [reports, inventory, procurement] = await Promise.all([
                    api.reporting.getExecutiveReports(state.user, { from, to, locationId: state.user.scope.locationId }),
                    api.inventory.getKPIs(state.user),
                    api.procurement.getKPIs(state.user),
                ]);

                const locationName = state.user.scope.locationId;
                setData({ locationName, reports, inventory, procurement });
            } catch (e: unknown) {
                setAccessError(e instanceof Error ? e.message : "Access denied");
            } finally {
                setLoading(false);
            }
        }
        load();
    }, [state.user, filters.fromDate, filters.toDate]);

    if (loading || !data) {
        return (
            <div className="p-8 animate-pulse space-y-8">
                <div className="h-16 w-1/3 bg-[var(--surface-raised)] rounded-[var(--radius-xl)]" />
                <div className="grid grid-cols-4 gap-6">
                    {[1, 2, 3, 4].map((i) => (
                        <div key={i} className="h-28 bg-[var(--surface-raised)] rounded-[var(--radius-xl)]" />
                    ))}
                </div>
            </div>
        );
    }

    if (accessError) {
        return (
            <div className="p-8 space-y-6 max-w-[1600px] mx-auto">
                <Card title="Branch Control" subtitle="Overview">
                    <div className="p-6 text-sm font-bold text-rose-600">{accessError}</div>
                </Card>
            </div>
        );
    }

    return (
        <div className="p-8 space-y-8 max-w-[1600px] mx-auto">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-[var(--text-primary)] tracking-tight">{data.locationName}</h1>
                    <p className="text-sm text-[var(--text-muted)]">Branch Operational Command Center</p>
                </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
                <StatCard
                    label="Revenue"
                    value={`UGX ${data.reports.revenueSummary.totalRevenue.toLocaleString()}`}
                    icon={TrendingUp}
                    variant="accent"
                    trendDirection="up"
                    trend={`Net: UGX ${data.reports.revenueSummary.netProfit.toLocaleString()}`}
                />
                <StatCard label="Pending Requisitions" value={data.procurement.activeRequisitions} icon={ShoppingCart} variant="warning" />
                <StatCard label="Low Stock Items" value={data.inventory.lowStockCount} icon={Package} variant="danger" />
                <StatCard label="Overdue Invoices" value={data.reports.procurementOverview.pendingGrnCount} icon={Users} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card title="Financial Pulse" subtitle="Location P&L snapshot">
                    <div className="space-y-3 mt-2">
                        <div className="flex items-center justify-between">
                            <span className="text-sm font-bold text-[var(--text-primary)]">Expenses</span>
                            <span className="text-sm font-black">UGX {data.reports.revenueSummary.totalExpenses.toLocaleString()}</span>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-sm font-bold text-[var(--text-primary)]">Net Profit</span>
                            <span className="text-sm font-black">UGX {data.reports.revenueSummary.netProfit.toLocaleString()}</span>
                        </div>
                    </div>
                </Card>

                <Card title="Inventory Health" subtitle="Ledger-derived overview">
                    <div className="space-y-3 mt-2">
                        <div className="flex items-center justify-between">
                            <span className="text-sm font-bold text-[var(--text-primary)]">Stock Valuation</span>
                            <span className="text-sm font-black">UGX {data.reports.inventoryHealth.totalStockValue.toLocaleString()}</span>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-sm font-bold text-[var(--text-primary)]">Low Stock Alerts</span>
                            <span className="text-sm font-black">{data.reports.inventoryHealth.lowStockAlertsCount}</span>
                        </div>

                        <div className="pt-2">
                            <Button variant="ghost" className="w-full text-xs">
                                Open Full Inventory Audit
                                <ArrowRight className="w-3 h-3 ml-1" />
                            </Button>
                        </div>
                    </div>
                </Card>
            </div>
        </div>
    );
}
