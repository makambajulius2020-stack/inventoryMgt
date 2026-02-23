"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
    BarChart3,
    ShoppingCart,
    Wallet,
    Package,
    Plus,
    History
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { DataTable } from "@/components/ui/DataTable";
import { StatusBadge } from "@/components/core/StatusBadge";
import { KpiCard, KpiGrid } from "@/components/dashboard/KpiCard";
import { DashboardEmpty, DashboardError, DashboardLoading } from "@/components/dashboard/DashboardStates";
import { AiInsightsPanel } from "@/components/dashboard/AiInsightsPanel";
import { api } from "@/lib/api/client";
import { useAuth } from "@/contexts/AuthContext";
import type { DepartmentDashboardData } from "@/lib/api/services/department.service";

type DepartmentStockRow = DepartmentDashboardData["stockItems"][number];
type DepartmentStockTableRow = DepartmentStockRow & { id: string };

export default function DepartmentDashboard() {
    const { state } = useAuth();
    const [data, setData] = useState<DepartmentDashboardData | null>(null);
    const [loading, setLoading] = useState(true);
    const [accessError, setAccessError] = useState<string | null>(null);

    useEffect(() => {
        async function load() {
            try {
                setAccessError(null);
                if (!state.user) return;

                const res = await api.department.getDashboard(state.user);
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
        return <DashboardError title="Dept Overview" message={accessError} />;
    }

    if (!data) {
        return <DashboardEmpty title="Dept Overview" message="No dashboard data available." />;
    }

    return (
        <div className="p-8 space-y-8 max-w-[1600px] mx-auto">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black text-[var(--text-primary)] tracking-tighter uppercase">{data.departmentName}</h1>
                    <p className="text-[var(--text-secondary)] font-medium">{data.locationName} — Departmental operations</p>
                </div>
                <div className="flex items-center gap-3">
                    <Button asChild variant="outline" size="sm">
                        <Link href="/department/requisitions">
                            <History className="w-4 h-4 mr-2" /> Requisitions
                        </Link>
                    </Button>
                    <Button asChild size="sm">
                        <Link href="/department/stock">
                            <Plus className="w-4 h-4 mr-2" /> Stock View
                        </Link>
                    </Button>
                </div>
            </div>

            {/* Metrics */}
            <KpiGrid>
                <KpiCard title="Stock Items" value={data.kpis.totalStockItems} icon={Package} subtitle="In Department" tone="accent" />
                <KpiCard title="Pending Requisitions" value={data.kpis.pendingRequisitions} icon={ShoppingCart} subtitle="Awaiting fulfillment" tone={data.kpis.pendingRequisitions > 0 ? "warn" : "good"} />
                <KpiCard title="Approved Requisitions" value={data.kpis.approvedRequisitions} icon={BarChart3} subtitle="In review chain" tone="good" />
                <KpiCard title="Total Spend" value={`UGX ${data.kpis.totalSpend.toLocaleString()}`} icon={Wallet} subtitle="Expenses in scope" tone="default" />
            </KpiGrid>

            <AiInsightsPanel />

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Stock Items */}
                <Card title="Department Stock" className="lg:col-span-2" noPadding>
                    <DataTable<DepartmentStockTableRow>
                        data={data.stockItems.map((r) => ({ ...r, id: `${r.sku}::${r.itemName}` }))}
                        columns={[
                            { header: "Item", accessor: "itemName", className: "font-black text-[var(--text-primary)]" },
                            { header: "SKU", accessor: "sku", className: "font-mono text-xs" },
                            {
                                header: "Quantity",
                                accessor: (i: DepartmentStockTableRow) => (
                                    <div className="flex items-center gap-2">
                                        <span className="font-black">{i.quantity}</span>
                                        <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase">{i.uom}</span>
                                    </div>
                                )
                            },
                        ]}
                        emptyMessage="No department stock movements found"
                    />
                </Card>

                {/* Requisition Summary */}
                <Card title="Recent Requisitions" subtitle="Department fulfillment chain">
                    <div className="space-y-4 mt-4">
                        {data.requisitions.slice(0, 6).map((req) => (
                            <div key={req.id} className="flex items-center justify-between p-4 border border-white/10 bg-white/5 rounded-2xl hover:bg-white/10 transition-all">
                                <div>
                                    <p className="text-sm font-black text-[var(--text-primary)]">{req.id}</p>
                                    <p className="text-[10px] font-black text-[var(--text-muted)] uppercase">{new Date(req.createdAt).toLocaleDateString()}</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-xs font-black">UGX {req.totalAmount.toLocaleString()}</p>
                                    <StatusBadge label={req.status} tone={req.status === "SUBMITTED" ? "warn" : "good"} />
                                </div>
                            </div>
                        ))}
                    </div>
                </Card>
            </div>
        </div>
    );
}
