import React from "react";
import { cn } from "@/lib/utils";

export interface CardProps {
    children: React.ReactNode;
    className?: string;
    noPadding?: boolean;
    title?: string;
    subtitle?: string;
    action?: React.ReactNode;
}

export function Card({ children, className, noPadding, title, subtitle, action }: CardProps) {
    return (
        <div
            className={cn(
                "bg-[var(--card)] text-[var(--card-foreground)] rounded-[var(--radius-xl)] border border-[var(--card-border)] overflow-hidden",
                "shadow-[var(--shadow-sm)]",
                className,
            )}
        >
            {(title || subtitle || action) && (
                <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-subtle)]">
                    <div>
                        {title && (
                            <h3 className="text-xs font-bold uppercase tracking-widest text-[var(--text-secondary)]">
                                {title}
                            </h3>
                        )}
                        {subtitle && (
                            <p className="text-xs text-[var(--text-muted)] mt-0.5">{subtitle}</p>
                        )}
                    </div>
                    {action && <div className="shrink-0">{action}</div>}
                </div>
            )}
            <div className={cn(noPadding ? "" : "p-6")}>{children}</div>
        </div>
    );
}

export function CardHeader({ children, className }: { children: React.ReactNode; className?: string }) {
    return (
        <div className={cn("px-6 py-4 border-b border-[var(--border-subtle)]", className)}>
            {children}
        </div>
    );
}

export function CardContent({ children, className }: { children: React.ReactNode; className?: string }) {
    return <div className={cn("p-6", className)}>{children}</div>;
}
