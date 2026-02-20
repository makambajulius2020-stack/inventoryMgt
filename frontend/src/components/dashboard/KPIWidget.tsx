"use client";

import React from "react";
import { LucideIcon, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { AnimatedCounter } from "./AnimatedCounter";

interface KPIWidgetProps {
    title: string;
    value: number;
    icon: LucideIcon;
    prefix?: string;
    suffix?: string;
    decimals?: number;
    trend?: {
        value: number;
        isUp: boolean;
    };
}

export function KPIWidget({
    title,
    value,
    icon: Icon,
    prefix,
    suffix,
    decimals,
    trend,
}: KPIWidgetProps) {
    return (
        <div className="bg-slate-800 border border-white/10 rounded-2xl p-6 shadow-xl hover:shadow-2xl hover:scale-[1.02] transition-all duration-300 group">
            <div className="flex items-start justify-between mb-4">
                <div className="p-3 rounded-xl bg-slate-900 border border-white/5 group-hover:border-teal-500/30 transition-colors">
                    <Icon className="w-6 h-6 text-teal-500" />
                </div>
                {trend && (
                    <div className={cn(
                        "flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-lg",
                        trend.isUp ? "text-emerald-400 bg-emerald-400/10" : "text-rose-400 bg-rose-400/10"
                    )}>
                        {trend.isUp ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                        {trend.value}%
                    </div>
                )}
            </div>
            <div>
                <p className="text-slate-400 text-sm font-medium mb-1">{title}</p>
                <h3 className="text-2xl font-black text-white tracking-tight">
                    <AnimatedCounter
                        value={value}
                        prefix={prefix}
                        suffix={suffix}
                        decimals={decimals}
                    />
                </h3>
            </div>
        </div>
    );
}

export function KPIGrid({ children }: { children: React.ReactNode }) {
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {children}
        </div>
    );
}
