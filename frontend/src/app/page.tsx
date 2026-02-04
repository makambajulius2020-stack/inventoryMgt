"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { useAuth } from "@/contexts/AuthContext";
import { getLandingRouteForRoles } from "@/lib/auth/roleRouting";

export default function Home() {
  const router = useRouter();
  const { state } = useAuth();

  useEffect(() => {
    if (!state.token) {
      router.replace("/login");
      return;
    }
    router.replace(getLandingRouteForRoles(state.roles));
  }, [state.token, state.roles, router]);

  return null;
}
