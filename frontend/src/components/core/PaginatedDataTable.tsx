"use client";

import React from "react";

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
    <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold text-zinc-900">{title}</div>
        <div className="text-xs text-zinc-500">
          Page {page} of {totalPages}
        </div>
      </div>

      <div className="mt-3 overflow-x-auto">
        <table className="w-full border-separate border-spacing-0">
          <thead>
            <tr>
              {columns.map((c) => (
                <th
                  key={c.key}
                  className={`whitespace-nowrap border-b border-zinc-200 px-3 py-2 text-left text-xs font-medium text-zinc-500 ${
                    c.className ?? ""
                  }`}
                >
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pageRows.map((row, idx) => (
              <tr key={idx} className="hover:bg-zinc-50">
                {columns.map((c) => (
                  <td
                    key={c.key}
                    className={`border-b border-zinc-100 px-3 py-2 text-sm text-zinc-800 ${c.className ?? ""}`}
                  >
                    {c.render(row)}
                  </td>
                ))}
              </tr>
            ))}
            {pageRows.length === 0 ? (
              <tr>
                <td className="px-3 py-10 text-center text-sm text-zinc-500" colSpan={columns.length}>
                  No data for selected filters
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <div className="mt-3 flex items-center justify-end gap-2">
        <button
          className="rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-xs text-zinc-700 disabled:opacity-50"
          onClick={() => setPage((p) => Math.max(1, p - 1))}
          disabled={page <= 1}
        >
          Prev
        </button>
        <button
          className="rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-xs text-zinc-700 disabled:opacity-50"
          onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          disabled={page >= totalPages}
        >
          Next
        </button>
      </div>
    </div>
  );
}
