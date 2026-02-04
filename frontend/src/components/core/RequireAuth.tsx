"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { useAuth } from "@/contexts/AuthContext";

export function RequireAuth({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { state } = useAuth();

  useEffect(() => {
    if (!state.token) {
      router.replace("/login");
    }
  }, [state.token, router]);

  if (!state.token) return null;
  return <>{children}</>;
}
