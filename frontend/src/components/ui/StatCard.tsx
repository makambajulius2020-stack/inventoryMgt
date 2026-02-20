import React from "react";
import { cn } from "@/lib/utils";

export interface StatCardProps {
    label: string;
    value: React.ReactNode;
    icon?: React.ComponentType<{ className?: string }>;
    trend?: string;
    trendDirection?: "up" | "down" | "neutral";
    className?: string;
    variant?: "default" | "accent" | "danger" | "warning";
}

const variantStyles: Record<NonNullable<StatCardProps["variant"]>, { bg: string; icon: string }> = {
    default: {
        bg: "bg-[var(--card)]",
        icon: "text-[var(--text-muted)]",
    },
    accent: {
        bg: "bg-[var(--card)]",
        icon: "text-[var(--accent)]",
    },
    danger: {
        bg: "bg-[var(--card)]",
        icon: "text-[var(--danger)]",
    },
    warning: {
        bg: "bg-[var(--card)]",
        icon: "text-[var(--warning)]",
    },
};

const trendColors: Record<NonNullable<StatCardProps["trendDirection"]>, string> = {
    up: "text-[var(--success)]",
    down: "text-[var(--danger)]",
    neutral: "text-[var(--text-muted)]",
};

export function StatCard({
    label,
    value,
    icon: Icon,
    trend,
    trendDirection = "neutral",
    className,
    variant = "default",
}: StatCardProps) {
    const styles = variantStyles[variant];

    return (
        <div
            className={cn(
                styles.bg,
                "rounded-[var(--radius-xl)] border border-[var(--card-border)] p-5 shadow-[var(--shadow-sm)]",
                className,
            )}
        >
            <div className="flex items-start justify-between">
                <div className="space-y-2">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                        {label}
                    </p>
                    <p className="text-2xl font-bold text-[var(--text-primary)] tracking-tight">
                        {value}
                    </p>
                </div>
                {Icon && (
                    <div className={cn("rounded-[var(--radius-lg)] p-2.5 bg-[var(--surface-raised)]", styles.icon)}>
                        <Icon className="h-5 w-5" />
                    </div>
                )}
            </div>
            {trend && (
                <p className={cn("text-xs font-medium mt-3", trendColors[trendDirection])}>
                    {trendDirection === "up" && "↑ "}
                    {trendDirection === "down" && "↓ "}
                    {trend}
                </p>
            )}
        </div>
    );
}
