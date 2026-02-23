"use client";

import React from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { useAuth } from "@/contexts/AuthContext";
import { useGlobalDateFilters } from "@/contexts/GlobalDateFiltersContext";
import { GlobalFilterBar } from "@/components/core/GlobalFilterBar";
import { mockDB } from "@/lib/mock-db";

interface DashboardShellProps {
    children: React.ReactNode;
    hideLocation?: boolean;
}

export function DashboardShell({ children, hideLocation = false }: DashboardShellProps) {
    const { state } = useAuth();
    const { filters, setFilters } = useGlobalDateFilters();

    const locationOptions = React.useMemo(() => {
        if (state.allowedLocations.includes("ALL")) {
            const branchIds = mockDB.locations
                .filter((l) => l.type === "BRANCH" && l.status === "ACTIVE")
                .map((l) => l.id);
            return ["ALL", ...branchIds];
        }
        return state.allowedLocations;
    }, [state.allowedLocations]);

    return (
        <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)] portal-bg">
            <Sidebar />
            <div className="pl-[260px] flex flex-col min-h-screen">
                <Header />
                <GlobalFilterBar
                    filters={filters}
                    locations={locationOptions}
                    onChange={setFilters}
                    hideLocation={hideLocation}
                />
                <main className="flex-1 p-8 space-y-8">
                    <div className="max-w-7xl mx-auto space-y-8">
                        {children}
                    </div>
                </main>
            </div>
        </div>
    );
}
