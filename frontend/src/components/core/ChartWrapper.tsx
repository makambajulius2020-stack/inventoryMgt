"use client";

import type { PropsWithChildren, ReactNode } from "react";

export type ChartWrapperProps = PropsWithChildren<{
  title: string;
  subtitle?: string;
  rightSlot?: ReactNode;
}>;

export function ChartWrapper({ title, subtitle, rightSlot, children }: ChartWrapperProps) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-sm font-semibold text-zinc-900">{title}</div>
          {subtitle ? <div className="mt-0.5 text-xs text-zinc-500">{subtitle}</div> : null}
        </div>
        {rightSlot ? <div className="shrink-0">{rightSlot}</div> : null}
      </div>
      <div className="mt-4 h-80 w-full">{children}</div>
    </div>
  );
}
