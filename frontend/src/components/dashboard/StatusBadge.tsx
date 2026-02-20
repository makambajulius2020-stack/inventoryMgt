"use client";

import React from "react";
import { cn } from "@/lib/utils";

export type StatusTone = "neutral" | "good" | "warn" | "bad" | "info";

interface StatusBadgeProps {
    label: string;
    tone?: StatusTone;
}

export function StatusBadge({ label, tone = "neutral" }: StatusBadgeProps) {
    const tones = {
        good: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
        warn: "bg-amber-500/10 text-amber-400 border-amber-500/20",
        bad: "bg-rose-500/10 text-rose-400 border-rose-500/20",
        info: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
        neutral: "bg-slate-500/10 text-slate-400 border-slate-500/20",
    };

    return (
        <span className={cn(
            "inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest border",
            tones[tone]
        )}>
            {label}
        </span>
    );
}
