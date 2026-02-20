"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight } from "lucide-react";

export type ColumnDef<Row> = {
  key: string;
  header: string;
  render: (row: Row) => React.ReactNode;
  className?: string;
};

export type PaginatedDataTableProps<Row> = {
  title: string;
  columns: ColumnDef<Row>[];
  rows: Row[];
  pageSize?: number;
};

export function PaginatedDataTable<Row>({ title, columns, rows, pageSize = 8 }: PaginatedDataTableProps<Row>) {
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const [page, setPage] = React.useState(1);

  React.useEffect(() => {
    setPage(1);
  }, [rows, pageSize]);

  const start = (page - 1) * pageSize;
  const pageRows = rows.slice(start, start + pageSize);

  return (
    <div className="rounded-3xl border border-white/10 bg-brand-card/5 backdrop-blur-md p-6 shadow-premium">
      <div className="flex items-center justify-between mb-6">
        <div className="text-lg font-bold text-white tracking-tight">{title}</div>
        <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
          Node {page} <span className="mx-1 text-slate-700">/</span> {totalPages}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-separate border-spacing-0">
          <thead>
            <tr className="bg-white/5">
              {columns.map((c, idx) => (
                <th
                  key={c.key}
                  className={cn(
                    "whitespace-nowrap border-b border-white/5 px-4 py-3 text-left text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]",
                    idx === 0 && "rounded-tl-xl",
                    idx === columns.length - 1 && "rounded-tr-xl",
                    c.className
                  )}
                >
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {pageRows.map((row, idx) => (
              <tr key={idx} className="group hover:bg-white/5 transition-all transition-colors duration-200">
                {columns.map((c) => (
                  <td
                    key={c.key}
                    className={cn(
                      "px-4 py-4 text-sm font-medium text-slate-300 group-hover:text-white transition-colors",
                      c.className
                    )}
                  >
                    {c.render(row)}
                  </td>
                ))}
              </tr>
            ))}
            {pageRows.length === 0 ? (
              <tr>
                <td className="px-4 py-12 text-center text-sm text-slate-500 font-medium italic" colSpan={columns.length}>
                  Zero artifacts found for the selected viewport.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <div className="mt-6 flex items-center justify-between">
        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
          Showing {pageRows.length} of {rows.length} records
        </p>
        <div className="flex items-center gap-2">
          <button
            className="p-2 rounded-xl bg-white/5 border border-white/10 text-slate-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            className="p-2 rounded-xl bg-white/5 border border-white/10 text-slate-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
