"use client";

import React from "react";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";
import { motion, AnimatePresence } from "framer-motion";
import { usePathname } from "next/navigation";

import { useAuth } from "@/contexts/AuthContext";
import { useGlobalDateFilters } from "@/contexts/GlobalDateFiltersContext";
import { GlobalFilterBar } from "@/components/core/GlobalFilterBar";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { getLandingRouteForRoles, getRolePrefix } from "@/lib/auth/roleRouting";
import { RoleName } from "@/lib/auth/types";

export function MainLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const { state } = useAuth();
    const { filters, setFilters } = useGlobalDateFilters();
    const router = useRouter();
    const [sidebarOpen, setSidebarOpen] = React.useState(false);

    useEffect(() => {
        if (state.allowedLocations.length > 0) {
            if (filters.location === "ALL" && !state.allowedLocations.includes("ALL")) {
                setFilters({ ...filters, location: state.allowedLocations[0] });
            }
        }
    }, [state.allowedLocations, filters, setFilters]);

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
        <div className="flex min-h-screen bg-slate-50 dark:bg-[#000b18] transition-colors duration-500">
            <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
            <div className="flex-1 md:ml-[280px] flex flex-col">
                <Header onToggleSidebar={() => setSidebarOpen((v) => !v)} />
                <GlobalFilterBar
                    filters={filters}
                    locations={state.allowedLocations}
                    onChange={setFilters}
                />

                <main className="flex-1">
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={pathname}
                            initial={{ opacity: 0, scale: 0.99 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.99 }}
                            transition={{ duration: 0.2, ease: "easeOut" }}
                        >
                            {children}
                        </motion.div>
                    </AnimatePresence>
                </main>
            </div>
        </div>
    );
}
