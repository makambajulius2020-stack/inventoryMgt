"use client";

import React from "react";
import { cn } from "@/lib/utils";

export type StatusType = "SUCCESS" | "WARNING" | "DANGER" | "INFO" | "NEUTRAL";

export function StatusBadge({ status, label }: { status: StatusType, label: string }) {
    const styles: Record<StatusType, string> = {
        SUCCESS: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
        WARNING: "bg-amber-500/10 text-amber-500 border-amber-500/20",
        DANGER: "bg-rose-500/10 text-rose-500 border-rose-500/20",
        INFO: "bg-[var(--accent)]/10 text-[var(--accent-hover)] border-[var(--accent)]/20",
        NEUTRAL: "bg-slate-500/10 text-slate-500 border-slate-500/20"
    };

    return (
        <span className={cn(
            "px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest border",
            styles[status]
        )}>
            {label}
        </span>
    );
}

export function DataTable({ headers, children }: { headers: string[], children: React.ReactNode }) {
    return (
        <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
                <thead>
                    <tr className="bg-white/5">
                        {headers.map((h, i) => (
                            <th key={i} className="px-8 py-5 text-[10px] font-black text-[var(--text-muted)] uppercase tracking-[0.2em] first:rounded-l-2xl last:rounded-r-2xl">
                                {h}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                    {children}
                </tbody>
            </table>
        </div>
    );
}
