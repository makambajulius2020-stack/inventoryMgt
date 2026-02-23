"use client";

import React from "react";

import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { useGlobalDateFilters } from "@/contexts/GlobalDateFiltersContext";

import type { AiInsight } from "@/lib/ai/ai.service";

export function AiInsightsPanel({ className }: { className?: string }) {
  const { state } = useAuth();
  const { filters } = useGlobalDateFilters();
  const [insights, setInsights] = React.useState<AiInsight[] | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    async function load() {
      try {
        setError(null);
        setLoading(true);
        if (!state.user) return;

        const from = filters.fromDate ? `${filters.fromDate}T00:00:00Z` : "2026-02-01T00:00:00Z";
        const to = filters.toDate ? `${filters.toDate}T23:59:59Z` : "2026-02-28T23:59:59Z";

        const mod = await import("@/lib/ai/ai.service");
        const res = await mod.aiService.getInsights(state.user, { from, to });
        setInsights(res);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Unable to load insights");
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, [state.user, filters.fromDate, filters.toDate]);

  return (
    <Card
      title="AI Insight Brief"
      subtitle="Deterministic, read-only signals"
      className={cn(className)}
    >
      {loading && <div className="h-24 bg-[var(--surface-raised)] rounded-[var(--radius-lg)] animate-pulse" />}

      {!loading && error && (
        <div className="text-sm font-bold text-[var(--danger)]">{error}</div>
      )}

      {!loading && !error && insights && (
        <div className="space-y-3">
          {insights.map((i) => (
            <div
              key={i.id}
              className={cn(
                "rounded-[var(--radius-lg)] border border-[var(--card-border)] p-4",
                i.severity === "HIGH"
                  ? "bg-[color-mix(in_oklab,var(--danger)_10%,transparent)]"
                  : i.severity === "WARN"
                    ? "bg-[color-mix(in_oklab,var(--warning)_10%,transparent)]"
                    : "bg-[var(--surface-raised)]",
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-black uppercase tracking-widest text-[var(--text-muted)]">
                    {i.kind}
                  </p>
                  <p className="text-sm font-black text-[var(--text-primary)]">{i.title}</p>
                  <p className="text-xs font-medium text-[var(--text-muted)] mt-1">
                    {i.message}
                  </p>
                </div>
                <span
                  className={cn(
                    "text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-[var(--radius-md)]",
                    i.severity === "HIGH"
                      ? "bg-[color-mix(in_oklab,var(--danger)_14%,transparent)] text-[var(--danger)]"
                      : i.severity === "WARN"
                        ? "bg-[color-mix(in_oklab,var(--warning)_14%,transparent)] text-[var(--warning)]"
                        : "bg-[color-mix(in_oklab,var(--accent)_14%,transparent)] text-[var(--accent)]",
                  )}
                >
                  {i.severity}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && !error && (!insights || insights.length === 0) && (
        <div className="text-sm font-bold text-[var(--text-muted)]">No insights available.</div>
      )}
    </Card>
  );
}
