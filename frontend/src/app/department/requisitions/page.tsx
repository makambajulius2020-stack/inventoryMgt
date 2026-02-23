"use client";

import React, { useEffect, useState } from "react";

import { Card } from "@/components/ui/Card";
import { DataTable } from "@/components/ui/DataTable";
import { StatusBadge } from "@/components/core/StatusBadge";
import { DashboardEmpty, DashboardError, DashboardLoading } from "@/components/dashboard/DashboardStates";
import { api } from "@/lib/api/client";
import { useAuth } from "@/contexts/AuthContext";
import type { RequisitionRow } from "@/lib/api/services/procurement.service";

export default function DepartmentRequisitionsPage() {
  const { state } = useAuth();
  const [data, setData] = useState<RequisitionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [accessError, setAccessError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        setAccessError(null);
        if (!state.user) return;
        const res = await api.procurement.getRequisitions(state.user);
        setData(res);
      } catch (e: unknown) {
        setAccessError(e instanceof Error ? e.message : "Access denied");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [state.user]);

  if (loading) return <DashboardLoading titleWidthClassName="w-1/3" />;
  if (accessError) return <DashboardError title="Requisitions" message={accessError} />;
  if (!data) return <DashboardEmpty title="Requisitions" message="No requisitions available." />;

  return (
    <div className="p-8 space-y-8 max-w-[1600px] mx-auto">
      <Card title="Requisitions" subtitle="Department fulfillment chain" noPadding>
        <DataTable
          data={data}
          columns={[
            { header: "REQ ID", accessor: "id", className: "font-mono font-bold" },
            { header: "Dept", accessor: "departmentName", className: "font-bold text-[var(--text-primary)]" },
            { header: "Requested By", accessor: "requestedByName", className: "text-[var(--text-muted)]" },
            {
              header: "Value",
              accessor: (r: RequisitionRow) => `UGX ${r.totalAmount.toLocaleString()}`,
              className: "font-black",
            },
            {
              header: "Status",
              accessor: (r: RequisitionRow) => (
                <StatusBadge label={r.status} tone={r.status === "SUBMITTED" ? "warn" : "good"} />
              ),
            },
            { header: "Created", accessor: (r: RequisitionRow) => new Date(r.createdAt).toLocaleDateString(), className: "text-[var(--text-muted)]" },
          ]}
          emptyMessage="No requisitions found"
        />
      </Card>
    </div>
  );
}
