"use client";

import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer
} from "recharts";

const COLORS = ["#001F3F", "#14b8a6", "#f59e0b", "#ef4444"];

interface Props {
  data: { bucket: string; amount: number; invoiceCount: number }[];
}

export default function LiabilityPieChart({ data }: Props) {
  const totalInvoices = data.reduce((s, a) => s + a.invoiceCount, 0);

  return (
    <div className="h-[300px] flex items-center justify-center relative">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={80}
            paddingAngle={5}
            dataKey="amount"
          >
            {data.map((_, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip />
        </PieChart>
      </ResponsiveContainer>
      <div className="absolute text-center mt-2">
        <p className="text-xl font-black text-[var(--text-primary)] leading-none">{totalInvoices}</p>
        <p className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-widest">Invoices</p>
      </div>
    </div>
  );
}
