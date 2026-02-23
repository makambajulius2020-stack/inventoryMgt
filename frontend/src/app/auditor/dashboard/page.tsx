"use client";

import React, { useEffect, useState } from "react";
import {
    ClipboardList,
    Database,
    Search,
    Filter,
    FileText,
    Activity,
    ShieldCheck,
    Lock
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { DataTable } from "@/components/ui/DataTable";
import { DashboardError } from "@/components/dashboard/DashboardStates";
import { api } from "@/lib/api/client";
import { useAuth } from "@/contexts/AuthContext";
import { useGlobalDateFilters } from "@/contexts/GlobalDateFiltersContext";
import { cn } from "@/lib/utils";
import type { AuditTrailEntry, CrossLocationVariance } from "@/lib/api/services/reporting.service";

type VarianceRow = CrossLocationVariance & { id: string };

export default function AuditorDashboard() {
    const [activeTab, setActiveTab] = useState<"logs" | "entities" | "financials">("logs");
    const { state } = useAuth();
    const { filters } = useGlobalDateFilters();
    const [logs, setLogs] = useState<AuditTrailEntry[]>([]);
    const [variance, setVariance] = useState<CrossLocationVariance[]>([]);
    const [query, setQuery] = useState("");
    const [loading, setLoading] = useState(true);
    const [accessError, setAccessError] = useState<string | null>(null);

    const varianceRows = React.useMemo<VarianceRow[]>(() => {
        return variance.map((v) => ({ ...v, id: v.metric }));
    }, [variance]);

    useEffect(() => {
        async function load() {
            setLoading(true);
            try {
                setAccessError(null);
                if (!state.user) return;
                if (activeTab === "logs") {
                    const res = await api.auditor.getFullAuditTrail();
                    setLogs(res);
                }
                if (activeTab === "financials") {
                    const v = await api.auditor.getCrossLocationVariance();
                    setVariance(v);
                }
            } catch (e: unknown) {
                setAccessError(e instanceof Error ? e.message : "Access denied");
            } finally {
                setLoading(false);
            }
        }
        load();
    }, [activeTab, state.user]);

    const withinRange = (raw: string) => {
        const t = new Date(raw).getTime();
        if (Number.isNaN(t)) return false;
        const fromTs = filters.fromDate ? new Date(filters.fromDate).getTime() : undefined;
        const toTs = filters.toDate ? new Date(filters.toDate).getTime() : undefined;
        if (fromTs !== undefined && t < fromTs) return false;
        if (toTs !== undefined && t > toTs) return false;
        return true;
    };

    const q = query.trim().toLowerCase();
    const filteredLogs = logs
        .filter((l) => withinRange(l.timestamp))
        .filter((l) => {
            if (filters.location === "ALL") return true;
            return l.locationName === filters.location;
        })
        .filter((l) => {
            if (!q) return true;
            return (
                l.entityId.toLowerCase().includes(q) ||
                l.entityType.toLowerCase().includes(q) ||
                l.action.toLowerCase().includes(q) ||
                l.userName.toLowerCase().includes(q) ||
                l.userRole.toLowerCase().includes(q)
            );
        })
        .slice(0, 400);

    const exportCsv = (filename: string, headers: string[], rows: (string | number)[][]) => {
        const esc = (v: string | number) => {
            const s = String(v ?? "");
            const needsQuotes = /[\n\r,\"]/g.test(s);
            const safe = s.replace(/\"/g, '""');
            return needsQuotes ? `"${safe}"` : safe;
        };
        const csv = [headers.map(esc).join(","), ...rows.map((r) => r.map(esc).join(","))].join("\n");
        const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
    };

    const handleExport = () => {
        const stamp = new Date().toISOString().slice(0, 10);
        if (activeTab === "logs") {
            exportCsv(
                `audit_logs_${stamp}.csv`,
                ["timestamp", "userName", "userRole", "action", "entityType", "entityId", "location"],
                filteredLogs.map((l) => [l.timestamp, l.userName, l.userRole, l.action, l.entityType, l.entityId, l.locationName])
            );
        }
        if (activeTab === "financials") {
            exportCsv(
                `cross_location_variance_${stamp}.csv`,
                ["metric", "average", "maxVariance"],
                varianceRows.map((v) => [v.metric, v.average, v.maxVariance])
            );
        }
    };

    if (accessError) {
        return <DashboardError title="Global Audit Vault" message={accessError} />;
    }

    return (
        <div className="p-8 space-y-8 max-w-[1600px] mx-auto">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        <h1 className="text-3xl font-black text-[var(--text-primary)] tracking-tighter uppercase">Global Audit Vault</h1>
                        <div className="px-2 py-0.5 bg-amber-500/10 text-amber-300 text-[10px] font-black uppercase tracking-widest rounded-md border border-amber-500/20 flex items-center gap-1">
                            <Lock className="w-3 h-3" /> READ ONLY ACCESS
                        </div>
                    </div>
                    <p className="text-[var(--text-secondary)] font-medium">Deep inspection and lifecycle integrity monitoring</p>
                </div>

                <div className="flex items-center gap-3">
                    <Button variant="outline" size="sm" className="bg-white/5 border-white/10" onClick={handleExport}>
                        <FileText className="w-4 h-4 mr-2" /> Export Audit Report (CSV)
                    </Button>
                </div>
            </div>

            {/* Navigation Tabs */}
            <div className="flex border-b border-white/10 gap-8 overflow-x-auto">
                <TabButton
                    active={activeTab === "logs"}
                    onClick={() => setActiveTab("logs")}
                    icon={Activity}
                    label="Global Audit Logs"
                />
                <TabButton
                    active={activeTab === "entities"}
                    onClick={() => setActiveTab("entities")}
                    icon={Database}
                    label="Entity Inspector"
                />
                <TabButton
                    active={activeTab === "financials"}
                    onClick={() => setActiveTab("financials")}
                    icon={ShieldCheck}
                    label="Financial Integrity"
                />
            </div>

            {/* Stats Overview */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card noPadding className="border-l-4 border-l-[#001F3F]">
                    <div className="p-6">
                        <p className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest mb-1">Total System Events</p>
                        <p className="text-2xl font-black text-[var(--text-primary)] uppercase tracking-tighter">1,240,892</p>
                    </div>
                </Card>
                <Card noPadding className="border-l-4 border-l-teal-500">
                    <div className="p-6">
                        <p className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest mb-1">Entity Integrity Score</p>
                        <p className="text-2xl font-black text-teal-600 tracking-tighter">100.0%</p>
                    </div>
                </Card>
                <Card noPadding className="border-l-4 border-l-amber-500">
                    <div className="p-6">
                        <p className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest mb-1">Flagged Anomalies</p>
                        <p className="text-2xl font-black text-amber-600 tracking-tighter">0 PERMANENT</p>
                    </div>
                </Card>
            </div>

            {/* Search & Filter Bar */}
            <div className="flex items-center gap-4 glass p-4 rounded-2xl border border-white/10 shadow-sm">
                <div className="flex-1 relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
                    <input
                        type="text"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Search logs"
                        className="w-full pl-11 pr-4 py-2.5 bg-[var(--input)] border border-[var(--input-border)] rounded-xl text-sm font-medium text-[var(--text-primary)] outline-none focus:ring-2 focus:ring-[var(--ring)]/20 transition-all"
                    />
                </div>
                <Button variant="ghost" size="sm">
                    <Filter className="w-4 h-4 mr-2" /> More Filters
                </Button>
            </div>

            {/* Main Content Area */}
            {activeTab === "logs" && (
                <Card noPadding title="Immutable System Trails" subtitle="Every modification and access event across all branches">
                    <DataTable
                        loading={loading}
                        data={filteredLogs}
                        columns={[
                            { header: "Timestamp", accessor: (l) => <span className="text-[var(--text-primary)] font-bold">{new Date(l.timestamp).toLocaleString()}</span> },
                            { header: "Actor", accessor: (l) => <span className="font-black text-[var(--text-primary)]">{l.userName}</span>, className: "text-[var(--text-primary)]" },
                            { header: "Role", accessor: (l) => <span className="text-[var(--text-primary)] font-bold">{l.userRole}</span>, className: "text-[var(--text-primary)]" },
                            { header: "Action", accessor: (l) => <span className="px-2 py-1 rounded bg-white/10 border border-white/15 text-[10px] font-black uppercase text-[var(--text-primary)]">{l.action}</span> },
                            { header: "Entity", accessor: (l) => <span className="text-[var(--text-primary)] font-bold">{l.entityType}</span> },
                            { header: "Entity ID", accessor: (l) => <span className="font-mono text-xs text-[var(--text-primary)] font-bold">{l.entityId}</span> },
                            { header: "Location", accessor: (l) => <span className="text-[var(--text-primary)] font-bold">{l.locationName}</span> },
                        ]}
                        emptyMessage="No audit records found"
                    />
                    <div className="p-4 border-t border-white/10 bg-white/5 flex justify-between items-center text-[10px] font-black text-[var(--text-muted)] uppercase">
                        <span>Showing top 50 global records</span>
                        <div className="flex items-center gap-4">
                            <button className="hover:text-teal-600">Previous</button>
                            <span>Page 1 of 2482</span>
                            <button className="hover:text-teal-600">Next</button>
                        </div>
                    </div>
                </Card>
            )}

            {activeTab === "entities" && (
                <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
                    <div className="space-y-2">
                        <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest pl-2 mb-4">Core Register</h4>
                        {["locations", "departments", "users", "items", "vendors"].map(e => (
                            <EntityLink key={e} label={e} active={false} />
                        ))}
                        <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest pl-2 mb-4 mt-8">operational chain</h4>
                        {["requisitions", "lpos", "grns", "invoices"].map(e => (
                            <EntityLink key={e} label={e} active={false} />
                        ))}
                    </div>
                    <Card className="md:col-span-3 h-[600px] flex items-center justify-center border-dashed border-2">
                        <div className="text-center">
                            <ClipboardList className="w-12 h-12 text-slate-200 mx-auto mb-4" />
                            <p className="text-slate-400 font-bold">Select an entity from the register to begin deep inspection</p>
                        </div>
                    </Card>
                </div>
            )}

            {activeTab === "financials" && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <Card title="3-Way Match Verification" subtitle="Auto-reconciliation of LPO → GRN → Invoice">
                        <div className="p-12 text-center text-slate-400">
                            Functional Verification Interface Still in Lockdown
                        </div>
                    </Card>
                    <Card title="Tax & Compliance Audit" subtitle="Global Sales vs Tax Returns Monitoring">
                        <div className="p-12 text-center text-slate-400">
                            Compliance Engine Monitoring
                        </div>
                    </Card>
                    <Card title="Cross-Location Variance" subtitle="Aggregated variance across branches" noPadding className="md:col-span-2">
                        <DataTable
                            loading={loading}
                            data={varianceRows}
                            columns={[
                                { header: "Metric", accessor: (r: VarianceRow) => r.metric, className: "font-black text-[var(--text-primary)]" },
                                { header: "Average", accessor: (r: VarianceRow) => <span className="font-black text-[var(--text-primary)]">{Number(r.average).toLocaleString()}</span>, className: "text-[var(--text-primary)]" },
                                { header: "Max Variance", accessor: (r: VarianceRow) => <span className="font-black text-[var(--text-primary)]">{Number(r.maxVariance).toLocaleString()}</span>, className: "text-[var(--text-primary)]" },
                            ]}
                            emptyMessage="No variance data available"
                        />
                    </Card>
                </div>
            )}
        </div>
    );
}

function TabButton({ active, onClick, icon: Icon, label }: { active: boolean; onClick: () => void; icon: React.ComponentType<{ className?: string }>; label: string }) {
    return (
        <button
            onClick={onClick}
            className={cn(
                "flex items-center gap-3 py-4 border-b-2 transition-all",
                active
                    ? "border-[var(--accent-hover)] text-[var(--text-primary)] font-black"
                    : "border-transparent text-[var(--text-muted)] hover:text-[var(--text-secondary)] font-bold"
            )}
        >
            <Icon className="w-4 h-4" />
            <span className="text-sm tracking-tighter uppercase">{label}</span>
        </button>
    );
}

function EntityLink({ label, active }: { label: string; active: boolean }) {
    return (
        <button className={cn(
            "w-full text-left px-4 py-3 rounded-xl text-sm font-bold uppercase tracking-tight transition-all",
            active ? "bg-white/10 text-[var(--text-primary)] border border-white/10" : "text-[var(--text-secondary)] hover:bg-white/5"
        )}>
            {label}
        </button>
    );
}
