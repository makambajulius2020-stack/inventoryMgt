"use client";

import React from "react";
import { motion } from "framer-motion";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { useAuth } from "@/contexts/AuthContext";
import { useGlobalDateFilters } from "@/contexts/GlobalDateFiltersContext";
import { GlobalFilterBar } from "@/components/core/GlobalFilterBar";

interface DashboardShellProps {
    children: React.ReactNode;
    hideLocation?: boolean;
}

export function DashboardShell({ children, hideLocation = false }: DashboardShellProps) {
    const { state } = useAuth();
    const { filters, setFilters } = useGlobalDateFilters();

    return (
        <div className="min-h-screen bg-slate-900 text-slate-200 portal-bg">
            <Sidebar />
            <div className="pl-[260px] flex flex-col min-h-screen">
                <Header />
                <GlobalFilterBar
                    filters={filters}
                    locations={state.allowedLocations}
                    onChange={setFilters}
                    hideLocation={hideLocation}
                />
                <motion.main
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5 }}
                    className="flex-1 p-8 space-y-8"
                >
                    <div className="max-w-7xl mx-auto space-y-8">
                        {children}
                    </div>
                </motion.main>
            </div>
        </div>
    );
}
