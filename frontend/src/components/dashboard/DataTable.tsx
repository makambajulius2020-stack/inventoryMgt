"use client";

import React, { useState, useMemo } from "react";
import { cn } from "@/lib/utils";
import { ChevronUp, ChevronDown, ChevronsUpDown } from "lucide-react";

export interface Column<T> {
    header: string;
    accessor: keyof T | ((item: T, index: number) => React.ReactNode);
    className?: string;
    sortable?: boolean;
    sortKey?: keyof T;
}

interface DataTableProps<T> {
    columns: Column<T>[];
    data: T[];
    loading?: boolean;
    emptyMessage?: string;
    onRowClick?: (item: T) => void;
    pageSize?: number;
}

export function DataTable<T extends { id: string | number }>({
    columns,
    data,
    loading,
    emptyMessage = "No records found",
    onRowClick,
    pageSize = 10,
}: DataTableProps<T>) {
    const [sortCol, setSortCol] = useState<keyof T | null>(null);
    const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
    const [page, setPage] = useState(0);

    const sorted = useMemo(() => {
        if (!sortCol) return data;
        return [...data].sort((a, b) => {
            const av = a[sortCol];
            const bv = b[sortCol];
            if (av == null && bv == null) return 0;
            if (av == null) return 1;
            if (bv == null) return -1;
            const cmp = av < bv ? -1 : av > bv ? 1 : 0;
            return sortDir === "asc" ? cmp : -cmp;
        });
    }, [data, sortCol, sortDir]);

    const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
    const safePage = Math.min(page, totalPages - 1);
    const paged = sorted.slice(safePage * pageSize, (safePage + 1) * pageSize);
    const isEmpty = data.length === 0;

    const handleSort = (col: Column<T>) => {
        const key = col.sortKey ?? (typeof col.accessor === "string" ? col.accessor : null);
        if (!col.sortable || !key) return;
        if (sortCol === key) {
            setSortDir((d) => (d === "asc" ? "desc" : "asc"));
        } else {
            setSortCol(key);
            setSortDir("asc");
        }
        setPage(0);
    };

    return (
        <div>
            <div className="overflow-x-auto">
                <table className="w-full text-left border-separate border-spacing-0" role="table">
                    <thead>
                        <tr>
                            {columns.map((col, i) => {
                                const key = col.sortKey ?? (typeof col.accessor === "string" ? col.accessor : null);
                                const isSorted = col.sortable && sortCol === key;
                                return (
                                    <th
                                        key={i}
                                        scope="col"
                                        onClick={() => handleSort(col)}
                                        className={cn(
                                            "px-4 py-3 text-[10px] font-bold uppercase tracking-widest",
                                            "text-[var(--text-muted)] border-b border-[var(--border-subtle)]",
                                            "bg-[var(--surface-muted)]",
                                            col.sortable && "cursor-pointer select-none hover:text-[var(--text-secondary)]",
                                            col.className,
                                        )}
                                        aria-sort={isSorted ? (sortDir === "asc" ? "ascending" : "descending") : undefined}
                                    >
                                        <span className="inline-flex items-center gap-1">
                                            {col.header}
                                            {col.sortable && (
                                                <span className="shrink-0" aria-hidden="true">
                                                    {isSorted ? (
                                                        sortDir === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />
                                                    ) : (
                                                        <ChevronsUpDown className="h-3 w-3 opacity-40" />
                                                    )}
                                                </span>
                                            )}
                                        </span>
                                    </th>
                                );
                            })}
                        </tr>
                    </thead>
                    <tbody>
                        {paged.map((item, i) => (
                            <tr
                                key={item.id ?? i}
                                onClick={() => onRowClick?.(item)}
                                className={cn(
                                    "border-b border-[var(--border-subtle)] transition-colors",
                                    "hover:bg-[var(--surface-raised)]",
                                    onRowClick && "cursor-pointer",
                                )}
                            >
                                {columns.map((col, j) => (
                                    <td
                                        key={j}
                                        className={cn(
                                            "px-4 py-3 text-sm text-[var(--text-secondary)]",
                                            col.className,
                                        )}
                                    >
                                        {typeof col.accessor === "function"
                                            ? col.accessor(item, safePage * pageSize + i)
                                            : (item[col.accessor] as React.ReactNode)}
                                    </td>
                                ))}
                            </tr>
                        ))}
                        {(loading || isEmpty) && (
                            <tr>
                                <td
                                    colSpan={columns.length}
                                    className="px-4 py-10 text-center text-sm text-[var(--text-muted)]"
                                >
                                    {loading ? "Loading…" : emptyMessage}
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
                <div className="flex items-center justify-between px-4 py-3 border-t border-[var(--border-subtle)]">
                    <p className="text-xs text-[var(--text-muted)]">
                        {safePage * pageSize + 1}–{Math.min((safePage + 1) * pageSize, sorted.length)} of {sorted.length}
                    </p>
                    <div className="flex gap-1">
                        <button
                            disabled={safePage === 0}
                            onClick={() => setPage((p) => Math.max(0, p - 1))}
                            aria-label="Previous page"
                            className="px-2.5 py-1 text-xs font-medium rounded-[var(--radius-md)] text-[var(--text-secondary)] hover:bg-[var(--surface-raised)] disabled:opacity-40 disabled:pointer-events-none transition-colors"
                        >
                            Prev
                        </button>
                        <button
                            disabled={safePage >= totalPages - 1}
                            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                            aria-label="Next page"
                            className="px-2.5 py-1 text-xs font-medium rounded-[var(--radius-md)] text-[var(--text-secondary)] hover:bg-[var(--surface-raised)] disabled:opacity-40 disabled:pointer-events-none transition-colors"
                        >
                            Next
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
