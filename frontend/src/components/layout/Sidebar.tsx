"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
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
    Hexagon
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { RoleName } from "@/lib/auth/types";

type NavItem = { label: string; href: string; icon: React.ComponentType<{ className?: string }> };

const NAV_ITEMS: Partial<Record<RoleName, NavItem[]>> = {
    CEO: [
        { label: "Executive Suite", href: "/ceo/dashboard", icon: LayoutDashboard },
        { label: "Executive Reports", href: "/ceo/reports", icon: Layers },
        { label: "Role Assignment", href: "/ceo/users", icon: ShieldCheck },
        { label: "Global Users", href: "/admin/users", icon: Users },
    ],
    SYSTEM_AUDITOR: [
        { label: "Audit Vault", href: "/auditor/dashboard", icon: ShieldCheck },
        { label: "Entity Register", href: "/auditor/entities", icon: Package },
        { label: "Lifecycle Trace", href: "/auditor/trace", icon: Layers },
    ],
    GENERAL_MANAGER: [
        { label: "Branch Control", href: "/gm/dashboard", icon: LayoutDashboard },
        { label: "Inventory Health", href: "/gm/inventory", icon: Package },
        { label: "Financial Pulse", href: "/gm/finance", icon: DollarSign },
    ],
    DEPARTMENT_HEAD: [
        { label: "Dept Overview", href: "/department/dashboard", icon: LayoutDashboard },
        { label: "Budget & Usage", href: "/department/budget", icon: DollarSign },
        { label: "Requisitions", href: "/department/requisitions", icon: ShoppingCart },
    ],
    PROCUREMENT_OFFICER: [
        { label: "Procurement Hub", href: "/procurement/dashboard", icon: LayoutDashboard },
        { label: "Purchase Orders", href: "/procurement/lpos", icon: ShoppingCart },
        { label: "Vendor Registry", href: "/procurement/vendors", icon: Users },
    ],
    STORE_MANAGER: [
        { label: "Inventory Hub", href: "/inventory/dashboard", icon: LayoutDashboard },
        { label: "Stock Control", href: "/inventory/stock", icon: Package },
        { label: "Movements", href: "/inventory/movements", icon: Layers },
    ],
    FINANCE_MANAGER: [
        { label: "Finance Hub", href: "/finance/dashboard", icon: LayoutDashboard },
        { label: "Accounts Payable", href: "/finance/ap", icon: DollarSign },
        { label: "Expenses", href: "/finance/expenses", icon: Layers },
    ],
};

export function Sidebar({ open = true, onClose }: { open?: boolean; onClose?: () => void }) {
    const pathname = usePathname();
    const { state, logout } = useAuth();
    const role = state.roles[0] as RoleName;
    const items = NAV_ITEMS[role] ?? [];

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
                    "fixed left-0 top-0 h-full w-[280px] bg-[#001F3F] text-white flex flex-col z-50 transition-transform md:translate-x-0",
                    open ? "translate-x-0" : "-translate-x-full"
                )}
            >
            {/* Branding */}
            <div className="p-8">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-teal-500 rounded-2xl flex items-center justify-center shadow-lg shadow-teal-500/20">
                        <Hexagon className="w-6 h-6 text-white fill-white/20" />
                    </div>
                    <div>
                        <h2 className="text-xl font-black tracking-tighter uppercase leading-none">Antigravity</h2>
                        <p className="text-[10px] font-black text-teal-400 uppercase tracking-widest mt-1">Enterprise Core</p>
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
                        <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center font-black text-[#001F3F] bg-teal-400">
                            {state.user?.name?.[0]}
                        </div>
                        <div className="overflow-hidden">
                            <p className="text-sm font-bold truncate">{state.user?.name}</p>
                            <p className="text-[10px] font-black text-teal-400 uppercase tracking-widest leading-none">{role}</p>
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
