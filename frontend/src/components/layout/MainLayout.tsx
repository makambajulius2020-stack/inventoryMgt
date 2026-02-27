"use client";

import React from "react";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";
import { usePathname } from "next/navigation";

import { useAuth } from "@/contexts/AuthContext";
import { useGlobalDateFilters } from "@/contexts/GlobalDateFiltersContext";
import { GlobalFilterBar } from "@/components/core/GlobalFilterBar";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { getLandingRouteForRoles, getRolePrefix } from "@/lib/auth/roleRouting";
import { RoleName } from "@/lib/auth/types";
import { mockDB } from "@/lib/mock-db";

export function MainLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const { state, setActiveLocation } = useAuth();
    const { filters, setFilters } = useGlobalDateFilters();
    const router = useRouter();
    const [sidebarOpen, setSidebarOpen] = React.useState(false);

    const hideLocation = React.useMemo(() => {
        return pathname.startsWith("/ceo");
    }, [pathname]);

    const locationOptions = React.useMemo(() => {
        if (state.allowedLocations.includes("ALL")) {
            const branchIds = mockDB.locations
                .filter((l) => l.type === "BRANCH" && l.status === "ACTIVE")
                .map((l) => l.id);
            return ["ALL", ...branchIds];
        }
        return state.allowedLocations;
    }, [state.allowedLocations]);

    useEffect(() => {
        if (state.allowedLocations.length > 0) {
            setFilters((prev) => {
                if (prev.location === "ALL" && !state.allowedLocations.includes("ALL")) {
                    return { ...prev, location: state.allowedLocations[0] };
                }
                return prev;
            });
        }
    }, [state.allowedLocations, setFilters]);

    useEffect(() => {
        // Protect all routes within MainLayout
        if (!state.token) {
            router.replace("/login");
            return;
        }

        const role = state.roles[0] as RoleName;
        const pathPrefix = pathname.split('/')[1];
        const expectedPrefix = getRolePrefix(role);

        // RBAC Verification
        if (role && pathPrefix && expectedPrefix && pathPrefix !== expectedPrefix) {
            router.replace(getLandingRouteForRoles(state.roles));
        }
    }, [state.token, state.roles, pathname, router]);

    if (!state.token) return null;

    return (
        <div className="flex min-h-screen bg-[var(--background)] transition-colors duration-500">
            <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
            <div className="flex-1 md:ml-[280px] flex flex-col">
                <Header onToggleSidebar={() => setSidebarOpen((v) => !v)} />
                <GlobalFilterBar
                    filters={filters}
                    locations={locationOptions}
                    hideLocation={hideLocation}
                    onChange={(next) => {
                        setFilters(next);
                        if (next.location !== filters.location) {
                            setActiveLocation(next.location);
                        }
                    }}
                />

                <main className="flex-1" key={pathname}>
                    {children}
                </main>
            </div>
        </div>
    );
}
