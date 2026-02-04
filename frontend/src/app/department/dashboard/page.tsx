"use client";

import { useEffect, useMemo, useState } from "react";

import { GlobalFilterBar } from "@/components/core/GlobalFilterBar";
import { PaginatedDataTable } from "@/components/core/PaginatedDataTable";
import { PortalSidebar } from "@/components/core/PortalSidebar";
import { RequireAuth } from "@/components/core/RequireAuth";
import { StatusBadge } from "@/components/core/StatusBadge";
import { useAuth } from "@/contexts/AuthContext";
import { getApiClient } from "@/lib/api/client";
import type { DashboardFilters, DepartmentActivityRowDTO, DepartmentSpendRowDTO } from "@/lib/api/types";

const DEPARTMENTS = ["All Departments", "Kitchen", "Bar", "Housekeeping", "Front Office", "Maintenance"];

function toneForVariance(v: number): "neutral" | "good" | "warn" | "bad" {
  if (v <= -5) return "good";
  if (v <= 5) return "neutral";
  if (v <= 15) return "warn";
  return "bad";
}

export default function DepartmentDashboardPage() {
  const api = useMemo(() => getApiClient(), []);
  const { state } = useAuth();

  const initialLocation = state.allowedLocations?.[0] || "All Branches";

  const [filters, setFilters] = useState<DashboardFilters>({
    preset: "month",
    location: initialLocation,
  });

  const [department, setDepartment] = useState<string>("All Departments");

  const [loading, setLoading] = useState(false);
  const [spendRows, setSpendRows] = useState<DepartmentSpendRowDTO[]>([]);
  const [activityRows, setActivityRows] = useState<DepartmentActivityRowDTO[]>([]);

  useEffect(() => {
    if (!state.allowedLocations?.length) return;
    if (filters.location) return;
    setFilters((f) => ({ ...f, location: state.allowedLocations[0] }));
  }, [state.allowedLocations, filters.location]);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      setLoading(true);
      try {
        const dept = department === "All Departments" ? undefined : department;
        const [s, a] = await Promise.all([
          api.departmentDashboard.getSpendSummary(filters, { department: dept }),
          api.departmentDashboard.getActivityFeed(filters, { department: dept }),
        ]);
        if (cancelled) return;
        setSpendRows(s.rows);
        setActivityRows(a.rows);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    run();
    return () => {
      cancelled = true;
    };
  }, [api, department, filters]);

  return (
    <RequireAuth>
      <div className="min-h-screen bg-zinc-50">
        <GlobalFilterBar
          filters={filters}
          locations={state.allowedLocations?.length ? state.allowedLocations : ["All Branches"]}
          onChange={setFilters}
        />

        <div className="mx-auto flex max-w-7xl">
          <PortalSidebar />

          <main className="w-full px-6 py-8">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h1 className="text-2xl font-semibold text-zinc-900">Department Oversight (Super Admin View)</h1>
              </div>

              <div className="flex items-center gap-2">
                <div className="text-xs font-medium text-zinc-500">Department</div>
                <select
                  className="rounded-lg border border-zinc-200 bg-white px-3 py-1 text-sm text-zinc-800"
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                >
                  {DEPARTMENTS.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
                {loading ? <div className="ml-2 text-xs text-zinc-500">Refreshing…</div> : null}
              </div>
            </div>

            <section className="mt-6">
              <PaginatedDataTable
                title="Department Spend Summary"
                rows={spendRows}
                columns={[
                  { key: "department", header: "Department", render: (r) => r.department },
                  { key: "branch", header: "Branch", render: (r) => r.branch },
                  { key: "requisitionsCount", header: "Requisitions", render: (r) => r.requisitionsCount, className: "text-right" },
                  { key: "approvedSpend", header: "Approved Spend", render: (r) => r.approvedSpendDisplay, className: "text-right" },
                  { key: "actualSpend", header: "Actual Spend", render: (r) => r.actualSpendDisplay, className: "text-right" },
                  {
                    key: "variancePct",
                    header: "Variance %",
                    render: (r) => <StatusBadge label={`${r.variancePct.toFixed(1)}%`} tone={toneForVariance(r.variancePct)} />,
                    className: "text-right",
                  },
                ]}
              />
            </section>

            <section className="mt-6">
              <PaginatedDataTable
                title="Department Activity Feed"
                rows={activityRows}
                columns={[
                  { key: "date", header: "Date", render: (r) => r.date },
                  { key: "department", header: "Department", render: (r) => r.department },
                  { key: "branch", header: "Branch", render: (r) => r.branch },
                  { key: "action", header: "Action", render: (r) => r.action },
                  { key: "amount", header: "Amount", render: (r) => r.amountDisplay, className: "text-right" },
                  { key: "status", header: "Status", render: (r) => <StatusBadge label={r.status} /> },
                ]}
                pageSize={10}
              />
            </section>
          </main>
        </div>
      </div>
    </RequireAuth>
  );
}
