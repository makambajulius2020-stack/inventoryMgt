"use client";

import React from "react";
import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface DashboardCardProps {
    title: string;
    value: string | number;
    subtitle?: string;
    icon?: LucideIcon;
    trend?: {
        value: number;
        isPositive: boolean;
    };
    className?: string;
}

export function DashboardCard({
    title,
    value,
    subtitle,
    icon: Icon,
    trend,
    className,
}: DashboardCardProps) {
    return (
        <div
            className={cn(
                "bg-brand-card/5 backdrop-blur-md rounded-2xl p-6 shadow-premium hover:bg-white/10 transition-all duration-300 border border-white/10 hover:-translate-y-1",
                className
            )}
        >
            <div className="flex items-start justify-between">
                <div>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                        {title}
                    </p>
                    <h3 className="text-3xl font-black text-white mt-2">{value}</h3>


                    {trend && (
                        <div className="flex items-center mt-2">
                            <span
                                className={cn(
                                    "text-xs font-semibold px-2 py-1 rounded-full",
                                    trend.isPositive
                                        ? "bg-emerald-500/10 text-emerald-300 border border-emerald-500/20"
                                        : "bg-rose-500/10 text-rose-300 border border-rose-500/20"
                                )}
                            >
                                {trend.isPositive ? "+" : "-"}{Math.abs(trend.value)}%
                            </span>
                            <span className="text-xs text-slate-400 ml-2 font-medium">
                                vs last month
                            </span>
                        </div>
                    )}

                    {subtitle && (
                        <p className="text-xs text-slate-400 mt-1">{subtitle}</p>
                    )}
                </div>

                {Icon && (
                    <div className="p-3 bg-brand-accent/10 rounded-xl">
                        <Icon className="w-6 h-6 text-brand-accent" />
                    </div>
                )}
            </div>
        </div>
    );
}
