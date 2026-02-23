"use client";

import React from "react";
import { ArrowDownRight, ArrowUpRight, type LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

export type KpiTone = "default" | "accent" | "good" | "warn" | "danger";

const toneStyles: Record<KpiTone, { iconWrap: string; delta: string }> = {
  default: {
    iconWrap: "bg-[var(--surface-raised)] text-[var(--text-muted)]",
    delta: "bg-[var(--surface-raised)] text-[var(--text-muted)]",
  },
  accent: {
    iconWrap: "bg-[color-mix(in_oklab,var(--accent)_14%,transparent)] text-[var(--accent)]",
    delta: "bg-[color-mix(in_oklab,var(--accent)_14%,transparent)] text-[var(--accent)]",
  },
  good: {
    iconWrap: "bg-[color-mix(in_oklab,var(--success)_14%,transparent)] text-[var(--success)]",
    delta: "bg-[color-mix(in_oklab,var(--success)_14%,transparent)] text-[var(--success)]",
  },
  warn: {
    iconWrap: "bg-[color-mix(in_oklab,var(--warning)_14%,transparent)] text-[var(--warning)]",
    delta: "bg-[color-mix(in_oklab,var(--warning)_14%,transparent)] text-[var(--warning)]",
  },
  danger: {
    iconWrap: "bg-[color-mix(in_oklab,var(--danger)_14%,transparent)] text-[var(--danger)]",
    delta: "bg-[color-mix(in_oklab,var(--danger)_14%,transparent)] text-[var(--danger)]",
  },
};

export type KpiDelta = {
  percent: number;
  direction: "up" | "down" | "neutral";
};

export interface KpiCardProps {
  title: string;
  value: React.ReactNode;
  subtitle?: string;
  icon?: LucideIcon;
  delta?: KpiDelta;
  tone?: KpiTone;
  className?: string;
}

export function KpiCard({
  title,
  value,
  subtitle,
  icon: Icon,
  delta,
  tone = "default",
  className,
}: KpiCardProps) {
  const styles = toneStyles[tone];
  const deltaLabel =
    delta &&
    (delta.direction === "neutral"
      ? `${Math.abs(delta.percent).toFixed(1)}%`
      : `${delta.direction === "up" ? "+" : "-"}${Math.abs(delta.percent).toFixed(1)}%`);

  return (
    <div
      className={cn(
        "rounded-[var(--radius-xl)] border border-[var(--card-border)] bg-[var(--card)] p-5 shadow-[var(--shadow-sm)]",
        "transition-shadow hover:shadow-[var(--shadow-md)]",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)] truncate">
            {title}
          </p>
          <div className="text-2xl font-bold text-[var(--text-primary)] tracking-tight">
            {value}
          </div>
          {subtitle && (
            <p className="text-xs font-medium text-[var(--text-muted)] truncate">{subtitle}</p>
          )}
        </div>

        <div className="flex flex-col items-end gap-2 shrink-0">
          {Icon && (
            <div className={cn("rounded-[var(--radius-lg)] p-2.5", styles.iconWrap)}>
              <Icon className="h-5 w-5" />
            </div>
          )}
          {delta && (
            <div className={cn(
              "inline-flex items-center gap-1 rounded-[var(--radius-md)] px-2 py-1 text-[10px] font-black uppercase tracking-widest",
              styles.delta,
            )}>
              {delta.direction === "up" && <ArrowUpRight className="h-3 w-3" />}
              {delta.direction === "down" && <ArrowDownRight className="h-3 w-3" />}
              {deltaLabel}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function KpiGrid({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6", className)}>
      {children}
    </div>
  );
}
