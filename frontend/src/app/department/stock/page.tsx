"use client";

import React, { useEffect, useState } from "react";

import { Card } from "@/components/ui/Card";
import { DataTable } from "@/components/ui/DataTable";
import { DashboardEmpty, DashboardError, DashboardLoading } from "@/components/dashboard/DashboardStates";
import { api } from "@/lib/api/client";
import { useAuth } from "@/contexts/AuthContext";
import type { DepartmentStockRow } from "@/lib/api/services/inventory.service";

export default function DepartmentStockPage() {
  const { state } = useAuth();
  const [data, setData] = useState<DepartmentStockRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [accessError, setAccessError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        setAccessError(null);
        if (!state.user) return;
        const res = await api.inventory.getDepartmentStock(state.user);
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
  if (accessError) return <DashboardError title="Department Stock" message={accessError} />;
  if (!data) return <DashboardEmpty title="Department Stock" message="No stock data available." />;

  return (
    <div className="p-8 space-y-8 max-w-[1600px] mx-auto">
      <Card title="Department Stock" subtitle="Derived from department issue ledger" noPadding>
        <DataTable
          data={data}
          columns={[
            { header: "Item", accessor: "itemName", className: "font-black text-[var(--text-primary)]" },
            { header: "SKU", accessor: "sku", className: "font-mono text-xs" },
            {
              header: "Quantity",
              accessor: (r: DepartmentStockRow) => (
                <div className="flex items-center gap-2">
                  <span className="font-black">{r.currentQuantity}</span>
                  <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase">{r.uom}</span>
                </div>
              ),
            },
            { header: "Department", accessor: "departmentName", className: "text-[var(--text-muted)]" },
          ]}
          emptyMessage="No department stock movements found"
        />
      </Card>
    </div>
  );
}
