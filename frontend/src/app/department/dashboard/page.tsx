"use client";

import React, { useEffect, useState } from "react";
import {
    BarChart3,
    ShoppingCart,
    Wallet,
    Package,
    Plus,
    ArrowUpRight,
    History
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { DataTable } from "@/components/ui/DataTable";
import { StatusBadge } from "@/components/core/StatusBadge";
import { api } from "@/lib/api/client";
import { useAuth } from "@/contexts/AuthContext";
import type { RequisitionRow } from "@/lib/api/services/procurement.service";

type DepartmentOverviewData = {
    locationName: string;
    departmentName: string;
    stockItems: Awaited<ReturnType<typeof api.inventory.getDepartmentStock>>;
    requisitions: RequisitionRow[];
};

type DepartmentStockRow = DepartmentOverviewData["stockItems"][number];

export default function DepartmentDashboard() {
    const { state } = useAuth();
    const [data, setData] = useState<DepartmentOverviewData | null>(null);
    const [loading, setLoading] = useState(true);
    const [accessError, setAccessError] = useState<string | null>(null);

    useEffect(() => {
        async function load() {
            try {
                setAccessError(null);
                if (!state.user) return;

                const [stockItems, requisitions] = await Promise.all([
                    api.inventory.getDepartmentStock(state.user),
                    api.procurement.getRequisitions(state.user),
                ]);

                const locationName = state.user.scope.locationId ?? "";
                const departmentName = state.user.scope.departmentId ?? "";
                setData({ locationName, departmentName, stockItems, requisitions });
            } catch (e: unknown) {
                setAccessError(e instanceof Error ? e.message : "Access denied");
            } finally {
                setLoading(false);
            }
        }
        load();
    }, [state.user]);

    if (loading || !data) {
        return <div className="p-8 animate-pulse space-y-8">
            <div className="h-12 w-48 bg-slate-200 dark:bg-slate-800 rounded-xl" />
            <div className="grid grid-cols-4 gap-6">
                {[1, 2, 3, 4].map(i => <div key={i} className="h-32 bg-slate-200 dark:bg-slate-800 rounded-3xl" />)}
            </div>
        </div>;
    }

    if (accessError) {
        return (
            <div className="p-8 space-y-6 max-w-[1600px] mx-auto">
                <Card title="Dept Overview" subtitle="Overview">
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
                    <h1 className="text-3xl font-black text-[#001F3F] dark:text-white tracking-tighter uppercase">{data.departmentName}</h1>
                    <p className="text-slate-500 font-medium">{data.locationName} — Departmental operations</p>
                </div>
                <div className="flex items-center gap-3">
                    <Button variant="outline" size="sm">
                        <History className="w-4 h-4 mr-2" /> Usage Logs
                    </Button>
                    <Button size="sm">
                        <Plus className="w-4 h-4 mr-2" /> New Requisition
                    </Button>
                </div>
            </div>

            {/* Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <DeptKpi label="Stock Items" value={data.stockItems.length} icon={Package} trend="In Department" />
                <DeptKpi label="Requisitions" value={data.requisitions.length} icon={ShoppingCart} trend="Visible in scope" />
                <DeptKpi label="Department" value={data.departmentName || ""} icon={BarChart3} trend="Scoped" />
                <DeptKpi label="Location" value={data.locationName || ""} icon={Wallet} trend="Scoped" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Stock Items */}
                <Card title="Department Stock" className="lg:col-span-2" noPadding>
                    <DataTable
                        data={data.stockItems}
                        columns={[
                            { header: "Item", accessor: "itemName", className: "font-black text-[#001F3F] dark:text-white" },
                            { header: "SKU", accessor: "sku", className: "font-mono text-xs" },
                            {
                                header: "Quantity",
                                accessor: (i: DepartmentStockRow) => (
                                    <div className="flex items-center gap-2">
                                        <span className="font-black">{i.currentQuantity}</span>
                                        <span className="text-[10px] font-bold text-slate-400 uppercase">{i.uom}</span>
                                    </div>
                                )
                            },
                        ]}
                    />
                </Card>

                {/* Requisition Summary */}
                <Card title="Recent Requisitions" subtitle="Department fulfillment chain">
                    <div className="space-y-4 mt-4">
                        {data.requisitions.slice(0, 6).map((req) => (
                            <div key={req.id} className="flex items-center justify-between p-4 border border-slate-100 dark:border-white/5 rounded-2xl hover:bg-slate-50 dark:hover:bg-white/5 transition-all">
                                <div>
                                    <p className="text-sm font-black text-[#001F3F] dark:text-white">{req.id}</p>
                                    <p className="text-[10px] font-black text-slate-400 uppercase">{new Date(req.createdAt).toLocaleDateString()}</p>
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

function DeptKpi({ label, value, icon: Icon, trend }: { label: string; value: number | string; icon: React.ComponentType<{ className?: string }>; trend: string }) {
    return (
        <Card className="hover:shadow-lg transition-all border-none ring-1 ring-slate-100 dark:ring-white/10">
            <div className="flex items-start justify-between mb-4">
                <div className="p-3 bg-slate-50 dark:bg-white/5 rounded-2xl">
                    <Icon className="w-5 h-5 text-[#001F3F] dark:text-teal-400" />
                </div>
                <div className="flex items-center gap-1 text-[10px] font-black text-emerald-500 uppercase tracking-widest">
                    <ArrowUpRight className="w-3 h-3" /> Live
                </div>
            </div>
            <div>
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">{label}</p>
                <p className="text-3xl font-black text-[#001F3F] dark:text-white tracking-tighter uppercase">{value}</p>
                <p className="text-[10px] font-bold text-slate-400 uppercase mt-1">{trend}</p>
            </div>
        </Card>
    );
}
