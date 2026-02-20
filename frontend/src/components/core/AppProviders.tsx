"use client";

import React from "react";

import { AuthProvider } from "@/contexts/AuthContext";
import { GlobalDateFiltersProvider } from "@/contexts/GlobalDateFiltersContext";

function GlobalFiltersHeader() {
  // Disabling legacy filter bar for the new premium UI
  return null;
}


export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <GlobalDateFiltersProvider>
        <GlobalFiltersHeader />
        {children}
      </GlobalDateFiltersProvider>
    </AuthProvider>
  );
}
