"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { usePathname } from "next/navigation";
import Image from "next/image";
import {
    Menu,
    Bell,
    Search,
    User,
    Globe,
    LogOut
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { RoleName } from "@/lib/auth/types";
import { mockDB } from "@/lib/mock-db";
import { useGlobalDateFilters } from "@/contexts/GlobalDateFiltersContext";
import { api } from "@/lib/api/client";
import type { PortalKind } from "@/lib/api/services/search.service";

export function Header({ onToggleSidebar }: { onToggleSidebar?: () => void }) {
    const router = useRouter();
    const pathname = usePathname();
    const { state, logout } = useAuth();
    const { filters } = useGlobalDateFilters();
    const [searchQuery, setSearchQuery] = React.useState("");
    const [searchOpen, setSearchOpen] = React.useState(false);
    const [searchResults, setSearchResults] = React.useState<{ id: string; title: string; subtitle?: string; type: string }[]>([]);
    const role = state.user?.role as RoleName;

    const locationLabel = React.useMemo(() => {
        if (state.user?.scope.allLocations) return "Global Command";
        const locationId = state.user?.scope.locationId;
        if (!locationId) return "Location Scoped";
        return mockDB.locations.find((l) => l.id === locationId)?.name ?? "Location Scoped";
    }, [state.user?.scope.allLocations, state.user?.scope.locationId]);

    const portal = React.useMemo<PortalKind | undefined>(() => {
        const prefix = pathname.split("/")[1];
        if (!prefix) return undefined;
        if (prefix === "ceo" || prefix === "auditor" || prefix === "gm" || prefix === "finance" || prefix === "procurement" || prefix === "inventory" || prefix === "department" || prefix === "admin") {
            return prefix as PortalKind;
        }
        return undefined;
    }, [pathname]);

    const effectiveLocationId = React.useMemo(() => {
        if (!filters.location || filters.location === "ALL") return undefined;
        return filters.location;
    }, [filters.location]);

    React.useEffect(() => {
        let cancelled = false;
        const q = searchQuery.trim();
        if (!q || !state.user) {
            setSearchResults([]);
            return;
        }

        const t = window.setTimeout(async () => {
            try {
                const res = await api.search.search(state.user!, {
                    query: q,
                    portal,
                    locationId: effectiveLocationId,
                    limit: 8,
                });
                if (cancelled) return;
                setSearchResults(res);
            } catch {
                if (cancelled) return;
                setSearchResults([]);
            }
        }, 150);

        return () => {
            cancelled = true;
            window.clearTimeout(t);
        };
    }, [searchQuery, state.user, portal, effectiveLocationId]);

    return (
        <header className="h-16 bg-[var(--surface-raised)] backdrop-blur-xl border-b border-[var(--border-subtle)] flex items-center justify-between px-8 sticky top-0 z-40">
            <div className="flex items-center gap-4">
                {onToggleSidebar && (
                    <button
                        type="button"
                        onClick={onToggleSidebar}
                        className="md:hidden p-2 rounded-xl bg-white/5 border border-white/10 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all"
                        aria-label="Toggle sidebar"
                    >
                        <Menu className="w-5 h-5" />
                    </button>
                )}
                <div className="flex items-center gap-2">
                    {portal === "gm" ? (
                        <div className="w-5 h-5 rounded-md overflow-hidden border border-white/10 bg-black/10">
                            <Image src="/Patiobella-logo.jpeg" alt="Patiobella" width={20} height={20} className="w-full h-full object-cover" />
                        </div>
                    ) : (
                        <Globe className="w-4 h-4 text-[var(--accent-hover)]" />
                    )}
                    <span className="text-[10px] font-black text-[var(--text-secondary)] uppercase tracking-widest">
                        {locationLabel}
                    </span>
                </div>
            </div>

            <div className="flex items-center gap-6">
                {/* Global Search */}
                <div className="hidden md:flex items-center gap-2 bg-white/5 border border-white/10 px-4 py-2 rounded-xl text-[var(--text-muted)] focus-within:ring-2 focus-within:ring-[var(--ring)]/20 transition-all relative group">
                    <Search className="w-4 h-4" />
                    <input
                        type="text"
                        placeholder="Search entities..."
                        className="bg-transparent border-none outline-none text-sm w-64 font-medium placeholder:text-[var(--text-muted)] text-[var(--text-primary)]"
                        onChange={(e) => {
                            setSearchQuery(e.target.value);
                            setSearchOpen(true);
                        }}
                        value={searchQuery}
                        onFocus={() => setSearchOpen(true)}
                        onBlur={() => window.setTimeout(() => setSearchOpen(false), 150)}
                    />

                    {searchOpen && searchResults.length > 0 && (
                        <div className="absolute top-full left-0 mt-2 w-full rounded-2xl overflow-hidden border border-white/10 bg-[var(--surface-raised)] backdrop-blur-xl shadow-premium z-50">
                            <div className="max-h-[320px] overflow-auto">
                                {searchResults.map((r) => (
                                    <button
                                        key={`${r.type}:${r.id}`}
                                        type="button"
                                        className="w-full text-left px-4 py-3 hover:bg-white/5 transition-all"
                                        onMouseDown={(e) => e.preventDefault()}
                                        onClick={() => {
                                            setSearchOpen(false);
                                        }}
                                    >
                                        <div className="flex items-center justify-between gap-4">
                                            <div className="min-w-0">
                                                <div className="text-xs font-black text-[var(--text-primary)] truncate">{r.title}</div>
                                                {r.subtitle && (
                                                    <div className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-widest truncate">{r.subtitle}</div>
                                                )}
                                            </div>
                                            <div className="text-[10px] font-black text-[var(--accent-hover)] uppercase tracking-widest">{r.type}</div>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                <div className="flex items-center gap-3">
                    <button
                        onClick={() => {
                            logout();
                            router.replace("/login");
                        }}
                        className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all"
                    >
                        <LogOut className="w-4 h-4" />
                        <span className="text-xs font-bold">Logout</span>
                    </button>

                    <button className="p-2.5 rounded-xl bg-white/5 border border-white/10 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all relative group">
                        <Bell className="w-5 h-5" />
                        <span className="absolute top-2.5 right-2.5 w-2 h-2 bg-rose-500 rounded-full border-2 border-[var(--background)]"></span>
                    </button>

                    <div className="flex items-center gap-3 pl-2 pr-4 py-1.5 rounded-full bg-white/5 border border-white/10">
                        <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-[var(--accent-hover)]">
                            <User className="w-4 h-4" />
                        </div>
                        <div className="text-left hidden sm:block">
                            <p className="text-[10px] font-black text-[var(--accent-hover)] uppercase leading-none mb-0.5">{role}</p>
                            <p className="text-xs font-bold text-[var(--text-secondary)] leading-none">
                                {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </header>
    );
}
