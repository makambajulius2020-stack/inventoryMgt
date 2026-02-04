"use client";

import type { DashboardFilters, DateRangePreset } from "@/lib/api/types";
import { useEffect, useMemo, useState } from "react";

const PRESETS: { key: DateRangePreset; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "week", label: "Week" },
  { key: "month", label: "Month" },
  { key: "quarter", label: "Quarter" },
  { key: "q2", label: "2nd Quarter" },
  { key: "q3", label: "3rd Quarter" },
  { key: "q4", label: "4th Quarter" },
  { key: "year", label: "Year" },
  { key: "custom", label: "Custom" },
];

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function isoDate(d: Date) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function monthStartEnd(year: number, monthIndex0: number) {
  const start = new Date(year, monthIndex0, 1);
  const end = new Date(year, monthIndex0 + 1, 0);
  return { from: isoDate(start), to: isoDate(end) };
}

function quarterStartEnd(year: number, quarterIndex1: 1 | 2 | 3 | 4) {
  const startMonth = (quarterIndex1 - 1) * 3;
  const start = new Date(year, startMonth, 1);
  const end = new Date(year, startMonth + 3, 0);
  return { from: isoDate(start), to: isoDate(end) };
}

function weekOfMonthStartEnd(year: number, monthIndex0: number, weekIndex1: number) {
  const start = new Date(year, monthIndex0, 1 + (weekIndex1 - 1) * 7);
  const last = new Date(year, monthIndex0 + 1, 0);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  if (end > last) end.setTime(last.getTime());
  return { from: isoDate(start), to: isoDate(end) };
}

export type GlobalFilterBarProps = {
  filters: DashboardFilters;
  locations: string[];
  onChange: (next: DashboardFilters) => void;
  hideLocation?: boolean;
};

export function GlobalFilterBar({ filters, locations, onChange, hideLocation = false }: GlobalFilterBarProps) {
  const today = useMemo(() => new Date(), []);
  const currentYear = today.getFullYear();
  const currentMonthIndex0 = today.getMonth();

  const yearOptions = useMemo(() => {
    const years: number[] = [];
    for (let y = currentYear; y >= currentYear - 12; y--) years.push(y);
    return years;
  }, [currentYear]);

  const [year, setYear] = useState(currentYear);
  const [month, setMonth] = useState(currentMonthIndex0);
  const [week, setWeek] = useState(1);
  const [quarterMonth, setQuarterMonth] = useState<number | "">("");

  const qIndex = useMemo((): 1 | 2 | 3 | 4 => {
    if (filters.preset === "q2") return 2;
    if (filters.preset === "q3") return 3;
    if (filters.preset === "q4") return 4;
    if (filters.preset === "quarter") return 1;
    return 1;
  }, [filters.preset]);

  const quarterMonths = useMemo(() => {
    const start = (qIndex - 1) * 3;
    return [start, start + 1, start + 2];
  }, [qIndex]);

  function setRangeIfChanged(nextFrom: string | undefined, nextTo: string | undefined) {
    if (filters.fromDate === nextFrom && filters.toDate === nextTo) return;
    onChange({ ...filters, fromDate: nextFrom, toDate: nextTo });
  }

  useEffect(() => {
    if (filters.preset === "custom") return;

    if (filters.preset === "today") {
      const d = new Date();
      const v = isoDate(d);
      setRangeIfChanged(v, v);
      return;
    }

    if (filters.preset === "week") {
      const r = weekOfMonthStartEnd(year, month, week);
      setRangeIfChanged(r.from, r.to);
      return;
    }

    if (filters.preset === "month") {
      const r = monthStartEnd(year, month);
      setRangeIfChanged(r.from, r.to);
      return;
    }

    if (filters.preset === "quarter" || filters.preset === "q2" || filters.preset === "q3" || filters.preset === "q4") {
      if (quarterMonth === "") {
        const r = quarterStartEnd(year, qIndex);
        setRangeIfChanged(r.from, r.to);
        return;
      }

      const r = monthStartEnd(year, quarterMonth);
      setRangeIfChanged(r.from, r.to);
      return;
    }

    if (filters.preset === "year") {
      const r = { from: `${year}-01-01`, to: `${year}-12-31` };
      setRangeIfChanged(r.from, r.to);
    }
  }, [filters, month, onChange, qIndex, quarterMonth, week, year]);

  useEffect(() => {
    if (filters.preset === "quarter" || filters.preset === "q2" || filters.preset === "q3" || filters.preset === "q4") {
      if (quarterMonth !== "" && !quarterMonths.includes(quarterMonth)) {
        setQuarterMonth("");
      }
    } else {
      if (quarterMonth !== "") setQuarterMonth("");
    }
  }, [filters.preset, quarterMonth, quarterMonths]);

  return (
    <div className="sticky top-0 z-50 border-b border-zinc-200 bg-white/90 shadow-sm backdrop-blur">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-2 px-6 py-2">
        <div className="text-sm font-semibold text-zinc-900">Global Filters</div>

        <div className="flex flex-wrap items-center gap-2">
          {PRESETS.map((p) => (
            <button
              key={p.key}
              type="button"
              className={`rounded-full border px-3 py-1 text-xs font-medium ${
                filters.preset === p.key
                  ? "border-zinc-900 bg-zinc-900 text-white"
                  : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50"
              }`}
              onClick={() =>
                onChange({
                  ...filters,
                  preset: p.key,
                  ...(p.key === "custom" ? {} : { fromDate: undefined, toDate: undefined }),
                })
              }
            >
              {p.label}
            </button>
          ))}
        </div>

        {filters.preset !== "custom" ? (
          <div className="flex w-full flex-wrap items-center gap-2">
            {filters.preset === "today" ? (
              <div className="text-xs text-zinc-600">
                Today is <span className="font-medium text-zinc-900">{new Date().toDateString()}</span>
              </div>
            ) : null}

            {filters.preset === "week" ? (
              <div className="flex flex-wrap items-center gap-2">
                <div className="text-xs font-medium text-zinc-500">Year</div>
                <select
                  className="rounded-lg border border-zinc-200 bg-white px-3 py-1 text-sm text-zinc-800"
                  value={year}
                  onChange={(e) => setYear(Number(e.target.value))}
                >
                  {yearOptions.map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
                <div className="text-xs font-medium text-zinc-500">Month</div>
                <input
                  type="month"
                  className="rounded-lg border border-zinc-200 bg-white px-3 py-1 text-sm text-zinc-800"
                  value={`${year}-${pad2(month + 1)}`}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (!v) return;
                    const [yy, mm] = v.split("-");
                    setYear(Number(yy));
                    setMonth(Math.max(0, Math.min(11, Number(mm) - 1)));
                  }}
                />
                <div className="text-xs font-medium text-zinc-500">Week</div>
                <select
                  className="rounded-lg border border-zinc-200 bg-white px-3 py-1 text-sm text-zinc-800"
                  value={week}
                  onChange={(e) => setWeek(Number(e.target.value))}
                >
                  {[1, 2, 3, 4, 5].map((w) => (
                    <option key={w} value={w}>
                      Week {w}
                    </option>
                  ))}
                </select>
                <div className="text-xs text-zinc-500">
                  Range: {filters.fromDate ?? "—"} → {filters.toDate ?? "—"}
                </div>
              </div>
            ) : null}

            {filters.preset === "month" ? (
              <div className="flex flex-wrap items-center gap-2">
                <div className="text-xs font-medium text-zinc-500">Month</div>
                <input
                  type="month"
                  className="rounded-lg border border-zinc-200 bg-white px-3 py-1 text-sm text-zinc-800"
                  value={`${year}-${pad2(month + 1)}`}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (!v) return;
                    const [yy, mm] = v.split("-");
                    setYear(Number(yy));
                    setMonth(Math.max(0, Math.min(11, Number(mm) - 1)));
                  }}
                />
                <div className="text-xs text-zinc-500">
                  Range: {filters.fromDate ?? "—"} → {filters.toDate ?? "—"}
                </div>
              </div>
            ) : null}

            {filters.preset === "quarter" || filters.preset === "q2" || filters.preset === "q3" || filters.preset === "q4" ? (
              <div className="flex flex-wrap items-center gap-2">
                <div className="text-xs font-medium text-zinc-500">Year</div>
                <select
                  className="rounded-lg border border-zinc-200 bg-white px-3 py-1 text-sm text-zinc-800"
                  value={year}
                  onChange={(e) => setYear(Number(e.target.value))}
                >
                  {yearOptions.map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
                <div className="text-xs font-medium text-zinc-500">Month (optional)</div>
                <select
                  className="rounded-lg border border-zinc-200 bg-white px-3 py-1 text-sm text-zinc-800"
                  value={quarterMonth === "" ? "" : String(quarterMonth)}
                  onChange={(e) => {
                    const v = e.target.value;
                    setQuarterMonth(v === "" ? "" : Number(v));
                  }}
                >
                  <option value="">All quarter</option>
                  {quarterMonths.map((m) => (
                    <option key={m} value={m}>
                      {new Date(year, m, 1).toLocaleString(undefined, { month: "long" })}
                    </option>
                  ))}
                </select>
                <div className="text-xs text-zinc-500">
                  Range: {filters.fromDate ?? "—"} → {filters.toDate ?? "—"}
                </div>
              </div>
            ) : null}

            {filters.preset === "year" ? (
              <div className="flex flex-wrap items-center gap-2">
                <div className="text-xs font-medium text-zinc-500">Year</div>
                <select
                  className="rounded-lg border border-zinc-200 bg-white px-3 py-1 text-sm text-zinc-800"
                  value={year}
                  onChange={(e) => setYear(Number(e.target.value))}
                >
                  {yearOptions.map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
                <div className="text-xs text-zinc-500">
                  Range: {filters.fromDate ?? "—"} → {filters.toDate ?? "—"}
                </div>
              </div>
            ) : null}
          </div>
        ) : null}

        {filters.preset === "custom" ? (
          <div className="flex flex-wrap items-center gap-2">
            <div className="text-xs font-medium text-zinc-500">From</div>
            <input
              type="date"
              className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm text-zinc-800"
              value={filters.fromDate ?? ""}
              onChange={(e) => onChange({ ...filters, fromDate: e.target.value || undefined })}
            />
            <div className="text-xs font-medium text-zinc-500">To</div>
            <input
              type="date"
              className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm text-zinc-800"
              value={filters.toDate ?? ""}
              onChange={(e) => onChange({ ...filters, toDate: e.target.value || undefined })}
            />
          </div>
        ) : null}

        {!hideLocation ? (
          <div className="ml-auto flex items-center gap-2">
            <div className="text-xs font-medium text-zinc-500">Location</div>
            <select
              className="rounded-lg border border-zinc-200 bg-white px-3 py-1 text-sm text-zinc-800"
              value={filters.location}
              onChange={(e) => onChange({ ...filters, location: e.target.value })}
            >
              {locations.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>
          </div>
        ) : null}
      </div>
    </div>
  );
}
