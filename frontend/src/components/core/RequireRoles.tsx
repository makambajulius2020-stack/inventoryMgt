"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { useAuth } from "@/contexts/AuthContext";
import { getLandingRouteForRoles } from "@/lib/auth/roleRouting";
import type { RoleName } from "@/lib/auth/types";

export function RequireRoles({ roles, children }: { roles: RoleName[]; children: React.ReactNode }) {
  const router = useRouter();
  const { state } = useAuth();

  useEffect(() => {
    if (!state.token) {
      router.replace("/login");
      return;
    }

    const allowed = roles.some((r) => state.roles.includes(r));
    if (!allowed) {
      router.replace(getLandingRouteForRoles(state.roles));
    }
  }, [state.token, state.roles, roles, router]);

  if (!state.token) return null;
  const allowed = roles.some((r) => state.roles.includes(r));
  if (!allowed) return null;

  return <>{children}</>;
}
