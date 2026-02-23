"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
    ShoppingCart,
    Package,
    Users,
    TrendingUp,
    ArrowRight
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { KpiCard, KpiGrid } from "@/components/dashboard/KpiCard";
import { DashboardEmpty, DashboardError, DashboardLoading } from "@/components/dashboard/DashboardStates";
import { AiInsightsPanel } from "@/components/dashboard/AiInsightsPanel";
import { api } from "@/lib/api/client";
import { useAuth } from "@/contexts/AuthContext";
import type { GmDashboardData } from "@/lib/api/services/gm.service";

export default function GmDashboard() {
    const { state } = useAuth();
    const [data, setData] = useState<GmDashboardData | null>(null);
    const [loading, setLoading] = useState(true);
    const [accessError, setAccessError] = useState<string | null>(null);

    useEffect(() => {
        async function load() {
            try {
                setAccessError(null);
                if (!state.user) return;
                const res = await api.gm.getDashboard(state.user);
                setData(res);
            } catch (e: unknown) {
                setAccessError(e instanceof Error ? e.message : "Access denied");
            } finally {
                setLoading(false);
            }
        }
        load();
    }, [state.user]);

    if (loading) {
        return <DashboardLoading titleWidthClassName="w-1/3" />;
    }

    if (accessError) {
        return <DashboardError title="Branch Control" message={accessError} />;
    }

    if (!data) {
        return <DashboardEmpty title="Branch Control" message="No dashboard data available." />;
    }

    return (
        <div className="p-8 space-y-8 max-w-[1600px] mx-auto">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-[var(--text-primary)] tracking-tight">{data.locationName}</h1>
                    <p className="text-sm text-[var(--text-muted)]">Branch Operational Command Center</p>
                </div>
                <div className="flex items-center gap-3">
                    <Button asChild variant="outline" size="sm">
                        <Link href="/inventory/dashboard">Inventory</Link>
                    </Button>
                    <Button asChild size="sm">
                        <Link href="/finance/dashboard">Finance</Link>
                    </Button>
                </div>
            </div>

            {/* KPI Cards */}
            <KpiGrid>
                <KpiCard
                    title="Revenue"
                    value={`UGX ${data.revenue.toLocaleString()}`}
                    subtitle={`Net: UGX ${data.profit.toLocaleString()}`}
                    icon={TrendingUp}
                    tone={data.profit >= 0 ? "good" : "warn"}
                />
                <KpiCard
                    title="Pending Requisitions"
                    value={data.pendingRequisitions}
                    subtitle="Open department demand"
                    icon={ShoppingCart}
                    tone={data.pendingRequisitions > 0 ? "warn" : "good"}
                />
                <KpiCard
                    title="Low Stock Items"
                    value={data.lowStockItems}
                    subtitle="Reorder required"
                    icon={Package}
                    tone={data.lowStockItems > 0 ? "danger" : "good"}
                />
                <KpiCard
                    title="Staff"
                    value={data.staffCount}
                    subtitle="Active users"
                    icon={Users}
                    tone="accent"
                />
            </KpiGrid>

            <AiInsightsPanel />

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card title="Financial Pulse" subtitle="Location P&L snapshot">
                    <div className="space-y-3 mt-2">
                        <div className="flex items-center justify-between">
                            <span className="text-sm font-bold text-[var(--text-primary)]">Expenses</span>
                            <span className="text-sm font-black">UGX {data.expenses.toLocaleString()}</span>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-sm font-bold text-[var(--text-primary)]">Net Profit</span>
                            <span className="text-sm font-black">UGX {data.profit.toLocaleString()}</span>
                        </div>
                    </div>
                </Card>

                <Card title="Inventory Health" subtitle="Ledger-derived overview">
                    <div className="space-y-3 mt-2">
                        <div className="flex items-center justify-between">
                            <span className="text-sm font-bold text-[var(--text-primary)]">Stock Valuation</span>
                            <span className="text-sm font-black">UGX {data.stockValue.toLocaleString()}</span>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-sm font-bold text-[var(--text-primary)]">Low Stock Alerts</span>
                            <span className="text-sm font-black">{data.lowStockItems}</span>
                        </div>

                        <div className="pt-2">
                            <Button asChild variant="outline" size="sm" className="w-full justify-center">
                                <Link href="/inventory/dashboard" className="flex items-center justify-center w-full">
                                    Open Full Inventory Audit
                                    <ArrowRight className="w-3 h-3 ml-1" />
                                </Link>
                            </Button>
                        </div>
                    </div>
                </Card>
            </div>
        </div>
    );
}
