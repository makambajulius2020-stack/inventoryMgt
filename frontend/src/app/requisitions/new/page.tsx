"use client";

import { RequireRoles } from "@/components/core/RequireRoles";

export default function NewRequisitionPage() {
  return (
    <RequireRoles roles={["DEPARTMENT_STAFF"]}>
      <div className="min-h-screen bg-zinc-50 p-8">
        <h1 className="text-2xl font-semibold text-zinc-900">New Requisition</h1>
        <p className="mt-2 text-sm text-zinc-600">Portal skeleton (structure-only).</p>
      </div>
    </RequireRoles>
  );
}
