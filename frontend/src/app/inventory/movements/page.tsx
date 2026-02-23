"use client";

import React, { useEffect, useState } from "react";

import { Card } from "@/components/ui/Card";
import { DataTable } from "@/components/ui/DataTable";
import { DashboardEmpty, DashboardError, DashboardLoading } from "@/components/dashboard/DashboardStates";
import { api } from "@/lib/api/client";
import { useAuth } from "@/contexts/AuthContext";
import type { StockMovementRow } from "@/lib/api/services/inventory.service";

export default function InventoryMovementsPage() {
  const { state } = useAuth();
  const [data, setData] = useState<StockMovementRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [accessError, setAccessError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        setAccessError(null);
        if (!state.user) return;
        const res = await api.inventory.getMovementHistory(state.user);
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
  if (accessError) return <DashboardError title="Movement Ledger" message={accessError} />;
  if (!data) return <DashboardEmpty title="Movement Ledger" message="No movement data available." />;

  return (
    <div className="p-8 space-y-8 max-w-[1600px] mx-auto">
      <Card title="Movement Ledger" subtitle="Stock movement history" noPadding>
        <DataTable
          data={data.map((m) => ({ ...m, id: `${m.referenceId}::${m.createdAt}` }))}
          columns={[
            { header: "Date", accessor: (m: StockMovementRow) => new Date(m.createdAt).toLocaleString(), className: "text-[var(--text-muted)]" },
            { header: "Type", accessor: "type", className: "font-black" },
            { header: "Item", accessor: "itemName", className: "font-black text-[var(--text-primary)]" },
            {
              header: "Qty",
              accessor: (m: StockMovementRow) => (
                <span className="font-black">{m.quantity > 0 ? `+${m.quantity}` : m.quantity}</span>
              ),
            },
            { header: "By", accessor: "performedByName", className: "text-[var(--text-muted)]" },
            { header: "Ref", accessor: "referenceId", className: "font-mono text-xs" },
          ]}
          emptyMessage="No movements found"
        />
      </Card>
    </div>
  );
}
