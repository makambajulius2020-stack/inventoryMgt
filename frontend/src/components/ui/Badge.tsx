import React from "react";
import { cn } from "@/lib/utils";

export type BadgeVariant = "default" | "success" | "warning" | "danger" | "info" | "accent" | "outline";

export interface BadgeProps {
    children: React.ReactNode;
    variant?: BadgeVariant;
    className?: string;
    dot?: boolean;
}

const variantStyles: Record<BadgeVariant, string> = {
    default:  "bg-[var(--surface-raised)] text-[var(--text-secondary)]",
    success:  "bg-[var(--success-muted)] text-[var(--success)]",
    warning:  "bg-[var(--warning-muted)] text-[var(--warning)]",
    danger:   "bg-[var(--danger-muted)] text-[var(--danger)]",
    info:     "bg-[var(--info-muted)] text-[var(--info)]",
    accent:   "bg-[var(--accent-muted)] text-[var(--accent)]",
    outline:  "border border-[var(--border)] text-[var(--text-secondary)] bg-transparent",
};

export function Badge({ children, variant = "default", className, dot }: BadgeProps) {
    return (
        <span
            className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold leading-none whitespace-nowrap",
                variantStyles[variant],
                className,
            )}
        >
            {dot && (
                <span className="h-1.5 w-1.5 rounded-full bg-current shrink-0" aria-hidden="true" />
            )}
            {children}
        </span>
    );
}

/** Maps common status strings to badge variants */
export function statusToBadgeVariant(status: string): BadgeVariant {
    const s = status.toUpperCase();
    if (["ACTIVE", "APPROVED", "PAID", "COMPLETED", "RECEIVED", "HEALTHY"].includes(s)) return "success";
    if (["PENDING", "DRAFT", "LOW"].includes(s)) return "warning";
    if (["REJECTED", "CANCELLED", "OVERDUE", "OUT_OF_STOCK", "CRITICAL"].includes(s)) return "danger";
    if (["ISSUED", "IN_PROGRESS", "PROCESSING"].includes(s)) return "info";
    return "default";
}
