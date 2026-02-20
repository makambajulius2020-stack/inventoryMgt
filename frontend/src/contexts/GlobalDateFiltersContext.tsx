"use client";

import React, { createContext, useContext, useMemo, useState } from "react";

import type { DateRangePreset } from "@/lib/api/types";

export type GlobalDateFilters = {
  preset: DateRangePreset;
  fromDate?: string;
  toDate?: string;
  location: string;
};

type GlobalDateFiltersContextValue = {
  filters: GlobalDateFilters;
  setFilters: (next: GlobalDateFilters) => void;
};

const GlobalDateFiltersContext = createContext<GlobalDateFiltersContextValue | null>(null);

export function GlobalDateFiltersProvider({ children }: { children: React.ReactNode }) {
  const [filters, setFilters] = useState<GlobalDateFilters>({ preset: "month", location: "ALL" });

  const value = useMemo<GlobalDateFiltersContextValue>(() => ({ filters, setFilters }), [filters]);

  return <GlobalDateFiltersContext.Provider value={value}>{children}</GlobalDateFiltersContext.Provider>;
}

export function useGlobalDateFilters() {
  const ctx = useContext(GlobalDateFiltersContext);
  if (!ctx) throw new Error("useGlobalDateFilters must be used within GlobalDateFiltersProvider");
  return ctx;
}
