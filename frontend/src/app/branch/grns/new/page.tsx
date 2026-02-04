"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { useAuth } from "@/contexts/AuthContext";
import { getApiClient } from "@/lib/api/client";
import type { DashboardFilters } from "@/lib/api/types";

export default function BranchCreateGrnPage() {
  const router = useRouter();
  const { state } = useAuth();
  const branchName = state.allowedLocations?.[0] ?? "Your Branch";

  const api = useMemo(() => getApiClient(), []);

  const [lpoId, setLpoId] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const filters: DashboardFilters = useMemo(
    () => ({
      preset: "month",
      location: branchName,
    }),
    [branchName]
  );

  return (
    <div>
      <div className="flex items-start justify-between gap-6">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900">Create GRN</h1>
          <div className="mt-1 text-sm text-zinc-600">{branchName}</div>
        </div>
        <button
          type="button"
          className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-50"
          onClick={() => router.back()}
        >
          Back
        </button>
      </div>

      <div className="mt-6 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
        <div className="grid gap-4 lg:grid-cols-2">
          <div>
            <label className="text-sm font-medium text-zinc-800">LPO ID</label>
            <input
              className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-zinc-400"
              placeholder="e.g. LPO-0001"
              value={lpoId}
              onChange={(e) => setLpoId(e.target.value)}
            />
          </div>
          <div>
            <label className="text-sm font-medium text-zinc-800">Notes</label>
            <input
              className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-zinc-400"
              placeholder="Optional"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </div>

        <div className="mt-4 flex items-center justify-end gap-2">
          <button
            type="button"
            className="rounded-lg bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60"
            disabled={submitting}
            onClick={async () => {
              setSubmitting(true);
              try {
                // Placeholder until real GRN create API is wired.
                // We keep `api` and `filters` referenced to ensure this page is ready for wiring.
                void api;
                void filters;
                void notes;
                if (!lpoId.trim()) return;
                router.push("/branch/grns");
              } finally {
                setSubmitting(false);
              }
            }}
          >
            {submitting ? "Creating…" : "Create"}
          </button>
        </div>
      </div>
    </div>
  );
}
