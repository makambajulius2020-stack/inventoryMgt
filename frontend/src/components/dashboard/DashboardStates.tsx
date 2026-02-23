"use client";

import React from "react";

import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/utils";

export function DashboardLoading({ titleWidthClassName }: { titleWidthClassName?: string }) {
  return (
    <div className="p-8 animate-pulse space-y-8">
      <div className={cn("h-12 bg-[var(--surface-raised)] rounded-[var(--radius-xl)]", titleWidthClassName ?? "w-64")} />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-28 bg-[var(--surface-raised)] rounded-[var(--radius-xl)]" />
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="h-[360px] bg-[var(--surface-raised)] rounded-[var(--radius-xl)] lg:col-span-2" />
        <div className="h-[360px] bg-[var(--surface-raised)] rounded-[var(--radius-xl)]" />
      </div>
    </div>
  );
}

export function DashboardError({ title, message }: { title: string; message: string }) {
  return (
    <div className="p-8 space-y-6 max-w-[1600px] mx-auto">
      <Card title={title} subtitle="Overview">
        <div className="p-6 text-sm font-bold text-[var(--danger)]">{message}</div>
      </Card>
    </div>
  );
}

export function DashboardEmpty({ title, message }: { title: string; message: string }) {
  return (
    <div className="p-8 space-y-6 max-w-[1600px] mx-auto">
      <Card title={title} subtitle="Overview">
        <div className="p-6 text-sm font-bold text-[var(--text-muted)]">{message}</div>
      </Card>
    </div>
  );
}
