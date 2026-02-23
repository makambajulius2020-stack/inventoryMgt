"use client";

import type { DashboardFilters, DateRangePreset } from "@/lib/api/types";
import { useCallback, useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { mockDB } from "@/lib/mock-db";
import { Calendar, MapPin } from "lucide-react";

const PRESETS: { key: DateRangePreset; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "week", label: "Week" },
  { key: "month", label: "Month" },
  { key: "quarter", label: "Quarter" },
  { key: "q2", label: "Q2" },
  { key: "q3", label: "Q3" },
  { key: "q4", label: "Q4" },
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

  const safeQuarterMonth = useMemo<number | "">(() => {
    if (filters.preset === "quarter" || filters.preset === "q2" || filters.preset === "q3" || filters.preset === "q4") {
      if (quarterMonth === "") return "";
      return quarterMonths.includes(quarterMonth) ? quarterMonth : "";
    }
    return "";
  }, [filters.preset, quarterMonth, quarterMonths]);

  const setRangeIfChanged = useCallback((nextFrom: string | undefined, nextTo: string | undefined) => {
    if (filters.fromDate === nextFrom && filters.toDate === nextTo) return;
    onChange({ ...filters, fromDate: nextFrom, toDate: nextTo });
  }, [filters, onChange]);

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
      if (safeQuarterMonth === "") {
        const r = quarterStartEnd(year, qIndex);
        setRangeIfChanged(r.from, r.to);
        return;
      }

      const r = monthStartEnd(year, safeQuarterMonth);
      setRangeIfChanged(r.from, r.to);
      return;
    }

    if (filters.preset === "year") {
      const r = { from: `${year}-01-01`, to: `${year}-12-31` };
      setRangeIfChanged(r.from, r.to);
    }
  }, [filters.preset, filters.fromDate, filters.toDate, month, qIndex, safeQuarterMonth, setRangeIfChanged, week, year]);

  return (
    <div className="sticky top-0 z-[40] border-b border-white/10 bg-brand-bg/80 backdrop-blur-xl shadow-premium">
      <div className="mx-auto flex flex-col md:flex-row items-center gap-4 px-6 py-4">

        <div className="flex items-center gap-2 pr-4 border-r border-white/10">
          <Calendar className="w-4 h-4 text-brand-accent" />
          <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest whitespace-nowrap">Periodic View</span>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 p-1 bg-white/5 rounded-2xl border border-white/5">
          {PRESETS.map((p) => (
            <button
              key={p.key}
              type="button"
              className={cn(
                "rounded-xl px-3.5 py-1.5 text-[10px] font-black uppercase tracking-widest transition-all",
                filters.preset === p.key
                  ? "bg-brand-accent text-white shadow-lg shadow-brand-accent/20"
                  : "text-slate-400 hover:text-white hover:bg-white/5"
              )}
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

        <div className="flex-1 flex flex-wrap items-center gap-4 min-w-0">
          {filters.preset !== "custom" && filters.preset !== "today" && (
            <div className="h-6 w-px bg-white/10 mx-2 hidden md:block"></div>
          )}

          {filters.preset === "week" || filters.preset === "month" || filters.preset === "quarter" || filters.preset === "q2" || filters.preset === "q3" || filters.preset === "q4" || filters.preset === "year" ? (
            <div className="flex items-center gap-3">
              <select
                className="bg-transparent text-xs font-bold text-white outline-none cursor-pointer hover:text-brand-accent transition-colors"
                value={year}
                onChange={(e) => setYear(Number(e.target.value))}
              >
                {yearOptions.map((y) => (
                  <option key={y} value={y} className="bg-[var(--surface)] text-[var(--text-primary)]">{y}</option>
                ))}
              </select>

              {filters.preset === "week" && (
                <select
                  className="bg-transparent text-xs font-bold text-white outline-none cursor-pointer hover:text-brand-accent transition-colors"
                  value={week}
                  onChange={(e) => setWeek(Number(e.target.value))}
                >
                  {[1, 2, 3, 4, 5].map((w) => (
                    <option key={w} value={w} className="bg-[var(--surface)] text-[var(--text-primary)]">Week {w}</option>
                  ))}
                </select>
              )}

              {(filters.preset === "week" || filters.preset === "month") && (
                <input
                  type="month"
                  className="bg-transparent text-xs font-bold text-white outline-none cursor-pointer hover:text-brand-accent transition-colors [color-scheme:dark]"
                  value={`${year}-${pad2(month + 1)}`}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (!v) return;
                    const [yy, mm] = v.split("-");
                    setYear(Number(yy));
                    setMonth(Math.max(0, Math.min(11, Number(mm) - 1)));
                  }}
                />
              )}

              {(filters.preset === "quarter" || filters.preset === "q2" || filters.preset === "q3" || filters.preset === "q4") && (
                <select
                  className="bg-transparent text-xs font-bold text-white outline-none cursor-pointer hover:text-brand-accent transition-colors"
                  value={safeQuarterMonth}
                  onChange={(e) => setQuarterMonth(e.target.value === "" ? "" : Number(e.target.value))}
                >
                  <option value="" className="bg-[var(--surface)] text-[var(--text-primary)]">Full Quarter</option>
                  {quarterMonths.map((mIdx) => (
                    <option key={mIdx} value={mIdx} className="bg-[var(--surface)] text-[var(--text-primary)]">
                      {new Date(2000, mIdx).toLocaleString('default', { month: 'long' })}
                    </option>
                  ))}
                </select>
              )}
            </div>
          ) : null}

          {filters.preset === "custom" && (
            <div className="flex items-center gap-3 animate-in fade-in slide-in-from-left-2 transition-all">
              <input
                type="date"
                className="bg-white/5 border border-white/10 rounded-xl px-3 py-1.5 text-xs font-bold text-white outline-none focus:border-brand-accent [color-scheme:dark]"
                value={filters.fromDate ?? ""}
                onChange={(e) => onChange({ ...filters, fromDate: e.target.value || undefined })}
              />
              <span className="text-slate-600 text-[10px] font-black">TO</span>
              <input
                type="date"
                className="bg-white/5 border border-white/10 rounded-xl px-3 py-1.5 text-xs font-bold text-white outline-none focus:border-brand-accent [color-scheme:dark]"
                value={filters.toDate ?? ""}
                onChange={(e) => onChange({ ...filters, toDate: e.target.value || undefined })}
              />
            </div>
          )}
        </div>

        {!hideLocation && (
          <div className="flex items-center gap-3 pl-4 border-l border-white/10">
            <MapPin className="w-4 h-4 text-emerald-400" />
            <select
              className="bg-transparent text-xs font-bold text-white outline-none cursor-pointer hover:text-brand-accent transition-colors"
              value={filters.location}
              onChange={(e) => onChange({ ...filters, location: e.target.value })}
            >
              {locations.map((l) => (
                <option key={l} value={l} className="bg-[var(--surface)] text-[var(--text-primary)]">
                  {l === "ALL" ? "All Branches" : (mockDB.locations.find((x) => x.id === l)?.name ?? l)}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>
    </div>
  );
}
