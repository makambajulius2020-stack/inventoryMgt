"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { RequireAuth } from "@/components/core/RequireAuth";

export default function StoreDashboardPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/inventory/dashboard");
  }, [router]);

  return (
    <RequireAuth>
      <div className="min-h-screen bg-zinc-50 p-8" />
    </RequireAuth>
  );
}
