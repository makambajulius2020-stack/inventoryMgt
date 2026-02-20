"use client";

import React from "react";
import { cn } from "@/lib/utils";

interface SectionCardProps {
    title: string;
    children: React.ReactNode;
    action?: React.ReactNode;
    className?: string;
    noPadding?: boolean;
}

export function SectionCard({
    title,
    children,
    action,
    className,
    noPadding = false
}: SectionCardProps) {
    return (
        <div className={cn(
            "bg-slate-800 border border-white/10 rounded-2xl shadow-xl overflow-hidden",
            className
        )}>
            <div className="px-6 py-5 border-b border-white/5 flex items-center justify-between bg-white/[0.02]">
                <h3 className="text-sm font-black text-white uppercase tracking-widest">{title}</h3>
                {action && <div>{action}</div>}
            </div>
            <div className={cn("relative", !noPadding && "p-6")}>
                {children}
            </div>
        </div>
    );
}
