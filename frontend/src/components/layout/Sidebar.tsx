"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import Image from "next/image";
import {
    LayoutDashboard,
    ShieldCheck,
    Layers,
    ShoppingCart,
    Package,
    DollarSign,
    Users,
    LogOut,
    ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { RoleName } from "@/lib/auth/types";
import { mockDB } from "@/lib/mock-db";

type NavItem = { label: string; href: string; icon: React.ComponentType<{ className?: string }> };

const NAV_ITEMS: Partial<Record<RoleName, NavItem[]>> = {
    CEO: [
        { label: "Executive Overview", href: "/ceo/dashboard", icon: LayoutDashboard },
        { label: "Financial Intelligence", href: "/ceo/financial-intelligence", icon: DollarSign },
        { label: "Operational Overview", href: "/ceo/operational-overview", icon: Layers },
        { label: "Procurement Overview", href: "/ceo/procurement-overview", icon: ShoppingCart },
        { label: "Inventory Status", href: "/ceo/inventory-status", icon: Package },
        { label: "Sales Analytics", href: "/ceo/sales-analytics", icon: DollarSign },
        { label: "Audit & Controls", href: "/ceo/audit-controls", icon: ShieldCheck },
        { label: "Reports & Exports", href: "/ceo/reports", icon: Layers },
    ],
    SYSTEM_AUDITOR: [
        { label: "System Logs", href: "/auditor/dashboard", icon: ShieldCheck },
        { label: "Financial Audit", href: "/auditor/financial-audit", icon: DollarSign },
        { label: "Stock Movement Audit", href: "/auditor/stock-movement-audit", icon: Package },
        { label: "User Activity", href: "/auditor/user-activity", icon: Users },
        { label: "Cross Location Reports", href: "/auditor/cross-location-reports", icon: Layers },
    ],
    STORE_CONTROLLER: [
        { label: "Dashboard", href: "/store-controller/dashboard", icon: LayoutDashboard },
        { label: "Inventory Integrity", href: "/store-controller/inventory-integrity", icon: ShieldCheck },
        { label: "Procurement Flow", href: "/store-controller/procurement-flow", icon: ShoppingCart },
        { label: "Department Stock", href: "/store-controller/department-stock", icon: Package },
    ],
    GENERAL_MANAGER: [
        { label: "Location Overview", href: "/gm/dashboard", icon: LayoutDashboard },
        { label: "Department Performance", href: "/gm/department-performance", icon: Users },
        { label: "Approvals", href: "/gm/approvals", icon: ShieldCheck },
        { label: "Financial Summary", href: "/gm/financial-summary", icon: DollarSign },
        { label: "Procurement Status", href: "/gm/procurement-status", icon: ShoppingCart },
        { label: "Inventory Status", href: "/gm/inventory-status", icon: Package },
    ],
    DEPARTMENT_HEAD: [
        { label: "Department Dashboard", href: "/department/dashboard", icon: LayoutDashboard },
        { label: "Requisitions", href: "/department/requisitions", icon: ShoppingCart },
        { label: "Stock Requests", href: "/department/stock-requests", icon: Package },
        { label: "Transfers", href: "/department/transfers", icon: Layers },
        { label: "Performance", href: "/department/performance", icon: DollarSign },
    ],
    PROCUREMENT_OFFICER: [
        { label: "Dashboard", href: "/procurement/dashboard", icon: LayoutDashboard },
        { label: "Requisitions", href: "/procurement/requisitions", icon: ShoppingCart },
        { label: "LPO Management", href: "/procurement/lpo-management", icon: Layers },
        { label: "GRN Management", href: "/procurement/grn-management", icon: Package },
        { label: "Vendor Invoices", href: "/procurement/vendor-invoices", icon: DollarSign },
        { label: "Vendor Ledger", href: "/procurement/vendor-ledger", icon: Users },
        { label: "Purchase Reports", href: "/procurement/purchase-reports", icon: Layers },
        { label: "Variance & Reconciliation", href: "/procurement/variance-reconciliation", icon: ShieldCheck },
    ],
    STORE_MANAGER: [
        { label: "Dashboard", href: "/inventory/dashboard", icon: LayoutDashboard },
        { label: "Location Stock", href: "/inventory/stock", icon: Package },
        { label: "Location Inventory", href: "/inventory/location-inventory", icon: Package },
        { label: "GRN Stock Entry", href: "/inventory/grn-stock-entry", icon: Package },
        { label: "Dept Stock Requests", href: "/inventory/department-stock-requests", icon: ShoppingCart },
        { label: "Department Stock", href: "/inventory/department-stock", icon: Users },
        { label: "Stock Transfers", href: "/inventory/stock-transfers", icon: Layers },
        { label: "Adjustments", href: "/inventory/adjustments", icon: ShieldCheck },
        { label: "Monthly Stock Count", href: "/inventory/monthly-stock-count", icon: Package },
        { label: "Inventory Valuation", href: "/inventory/inventory-valuation", icon: DollarSign },
        { label: "Reports", href: "/inventory/reports", icon: Layers },
    ],
    FINANCE_MANAGER: [
        { label: "Dashboard", href: "/finance/dashboard", icon: LayoutDashboard },
        { label: "Accounts Payable", href: "/finance/accounts-payable", icon: DollarSign },
        { label: "Payments", href: "/finance/payments", icon: DollarSign },
        { label: "Expenses", href: "/finance/expenses", icon: Layers },
        { label: "Petty Cash", href: "/finance/petty-cash", icon: Layers },
        { label: "Sales Oversight", href: "/finance/sales-oversight", icon: DollarSign },
        { label: "Profit & Loss", href: "/finance/profit-loss", icon: DollarSign },
        { label: "Cash Flow", href: "/finance/cash-flow", icon: Layers },
        { label: "Bank Reconciliation", href: "/finance/bank-reconciliation", icon: ShieldCheck },
        { label: "Reports", href: "/finance/reports", icon: Users },
    ],
};

export function Sidebar({ open = true, onClose }: { open?: boolean; onClose?: () => void }) {
    const pathname = usePathname();
    const { state, logout } = useAuth();
    const role = state.roles[0] as RoleName;
    const items = NAV_ITEMS[role] ?? [];
    const locationBadge = React.useMemo(() => {
        if (state.user?.scope.allLocations) return "Global";
        const locationId = state.user?.scope.locationId;
        if (!locationId) return "Scoped";
        return mockDB.locations.find((l) => l.id === locationId)?.name ?? locationId;
    }, [state.user?.scope.allLocations, state.user?.scope.locationId]);

    return (
        <>
            <div
                className={cn(
                    "fixed inset-0 bg-black/40 z-40 md:hidden transition-opacity",
                    open ? "opacity-100" : "opacity-0 pointer-events-none"
                )}
                onClick={onClose}
            />
            <aside
                className={cn(
                    "fixed left-0 top-0 h-full w-[280px] bg-[var(--sidebar)] text-white flex flex-col z-50 transition-transform md:translate-x-0 backdrop-blur-xl border-r border-white/10",
                    open ? "translate-x-0" : "-translate-x-full"
                )}
            >
            {/* Branding */}
            <div className="p-8">
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl overflow-hidden border border-white/10 bg-white/5">
                        <Image src="/Hugamara-Logo.jpeg" alt="HUGAMARA" width={48} height={48} className="w-full h-full object-cover" priority />
                    </div>
                    <div>
                        <h2 className="text-xl font-black tracking-tighter uppercase leading-none">HUGAMARA</h2>
                        <p className="text-[10px] font-black text-teal-400 uppercase tracking-widest mt-1">Enterprise Management System</p>
                    </div>
                </div>
            </div>

            {/* Navigation */}
            <nav className="flex-1 px-4 space-y-1 overflow-y-auto">
                <p className="px-4 text-[10px] font-black text-slate-200/80 uppercase tracking-widest mb-4">Command Console</p>
                {items.map((item) => {
                    const active = pathname === item.href;
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            onClick={onClose}
                            className={cn(
                                "group flex items-center justify-between px-4 py-3.5 rounded-2xl transition-all duration-300",
                                active
                                    ? "bg-white/10 text-white shadow-xl shadow-black/20"
                                    : "text-slate-200/80 hover:text-white hover:bg-white/5"
                            )}
                        >
                            <div className="flex items-center gap-3">
                                <item.icon className={cn("w-5 h-5", active ? "text-teal-400" : "text-slate-200/70 group-hover:text-slate-200")} />
                                <span className="text-sm font-bold tracking-tight">{item.label}</span>
                            </div>
                            {active && <ChevronRight className="w-4 h-4 text-teal-400" />}
                        </Link>
                    );
                })}
            </nav>

            {/* User Profile / Logout */}
            <div className="p-6">
                <div className="p-4 bg-white/5 rounded-3xl border border-white/5">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 rounded-full flex items-center justify-center font-black bg-white/10 text-[var(--accent-hover)] border border-white/10">
                            {state.user?.name?.[0]}
                        </div>
                        <div className="overflow-hidden">
                            <p className="text-sm font-bold truncate">{state.user?.name}</p>
                            <p className="text-[10px] font-black text-teal-400 uppercase tracking-widest leading-none">{role}</p>
                            <p className="mt-1 inline-flex max-w-full truncate px-2 py-0.5 rounded-lg bg-white/10 border border-white/10 text-[9px] font-black uppercase tracking-wider text-slate-200">
                                {locationBadge}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={() => logout()}
                        className="w-full flex items-center justify-center gap-2 py-3 bg-rose-500/10 text-rose-500 rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-rose-500 hover:text-white transition-all"
                    >
                        <LogOut className="w-4 h-4" />
                        Terminate Session
                    </button>
                </div>
            </div>
            </aside>
        </>
    );
}
