"use client";

import React, { useEffect, useState } from "react";

import { Card } from "@/components/ui/Card";
import { DataTable } from "@/components/ui/DataTable";
import { DashboardEmpty, DashboardError, DashboardLoading } from "@/components/dashboard/DashboardStates";
import { api } from "@/lib/api/client";
import { useAuth } from "@/contexts/AuthContext";
import type { VendorRow } from "@/lib/api/services/procurement.service";

export default function ProcurementVendorsPage() {
  const { state } = useAuth();
  const [data, setData] = useState<VendorRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [accessError, setAccessError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        setAccessError(null);
        if (!state.user) return;
        const res = await api.procurement.getVendors();
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
  if (accessError) return <DashboardError title="Vendors" message={accessError} />;
  if (!data) return <DashboardEmpty title="Vendors" message="No vendor data available." />;

  return (
    <div className="p-8 space-y-8 max-w-[1600px] mx-auto">
      <Card title="Vendors" subtitle="Approved supplier registry" noPadding>
        <DataTable
          data={data}
          columns={[
            { header: "Vendor", accessor: "name", className: "font-black text-[var(--text-primary)]" },
            { header: "Category", accessor: "categoryName", className: "text-[var(--text-muted)]" },
            { header: "Coverage", accessor: (v: VendorRow) => `${v.itemCount} items`, className: "font-bold" },
            { header: "Rating", accessor: (v: VendorRow) => `${Math.round(v.rating * 100)}%`, className: "font-black" },
            { header: "Email", accessor: "contactEmail", className: "text-[var(--text-muted)]" },
          ]}
          emptyMessage="No vendors found"
        />
      </Card>
    </div>
  );
}
