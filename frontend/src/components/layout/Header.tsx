"use client";

import React from "react";
import { useRouter } from "next/navigation";
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

export function Header({ onToggleSidebar }: { onToggleSidebar?: () => void }) {
    const router = useRouter();
    const { state, logout } = useAuth();
    const [searchQuery, setSearchQuery] = React.useState("");
    const role = state.user?.role as RoleName;

    return (
        <header className="h-16 bg-white/80 dark:bg-[#000b18]/80 backdrop-blur-xl border-b border-slate-200 dark:border-white/5 flex items-center justify-between px-8 sticky top-0 z-40">
            <div className="flex items-center gap-4">
                {onToggleSidebar && (
                    <button
                        type="button"
                        onClick={onToggleSidebar}
                        className="md:hidden p-2 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-200 hover:text-[#001F3F] dark:hover:text-teal-300 transition-all"
                        aria-label="Toggle sidebar"
                    >
                        <Menu className="w-5 h-5" />
                    </button>
                )}
                <div className="flex items-center gap-2">
                    <Globe className="w-4 h-4 text-teal-500" />
                    <span className="text-[10px] font-black text-slate-600 dark:text-slate-200 uppercase tracking-widest">
                        {state.user?.scope.allLocations ? "Global Command" : state.user?.scope.locationId || "Location Scoped"}
                    </span>
                </div>
            </div>

            <div className="flex items-center gap-6">
                {/* Global Search */}
                <div className="hidden md:flex items-center gap-2 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 px-4 py-2 rounded-xl text-slate-400 focus-within:ring-2 focus-within:ring-[#001F3F]/10 transition-all relative group">
                    <Search className="w-4 h-4" />
                    <input
                        type="text"
                        placeholder="Search entities..."
                        className="bg-transparent border-none outline-none text-sm w-64 font-medium placeholder:text-slate-600 text-slate-900 dark:placeholder:text-slate-300 dark:text-white"
                        onChange={(e) => setSearchQuery(e.target.value)}
                        value={searchQuery}
                    />
                </div>

                <div className="flex items-center gap-3">
                    <button
                        onClick={() => {
                            logout();
                            router.replace("/login");
                        }}
                        className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-200 hover:text-[#001F3F] dark:hover:text-teal-300 transition-all"
                    >
                        <LogOut className="w-4 h-4" />
                        <span className="text-xs font-bold">Logout</span>
                    </button>

                    <button className="p-2.5 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-200 hover:text-[#001F3F] dark:hover:text-teal-300 transition-all relative group">
                        <Bell className="w-5 h-5" />
                        <span className="absolute top-2.5 right-2.5 w-2 h-2 bg-rose-500 rounded-full border-2 border-white dark:border-[#000b18]"></span>
                    </button>

                    <div className="flex items-center gap-3 pl-2 pr-4 py-1.5 rounded-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10">
                        <div className="w-8 h-8 rounded-full bg-[#001F3F] flex items-center justify-center text-teal-400">
                            <User className="w-4 h-4" />
                        </div>
                        <div className="text-left hidden sm:block">
                            <p className="text-[10px] font-black text-[#001F3F] dark:text-teal-400 uppercase leading-none mb-0.5">{role}</p>
                            <p className="text-xs font-bold text-slate-700 dark:text-slate-200 leading-none">
                                {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </header>
    );
}
