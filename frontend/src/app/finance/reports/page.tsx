"use client";

import React from "react";
import { FileText, Download, Filter, Search, Calendar, ChevronRight } from "lucide-react";
import { motion } from "framer-motion";

const MOCK_REPORTS = [
    { id: "REP-001", name: "Monthly Performance Audit", type: "Financial", date: "2026-02-01", size: "2.4 MB" },
    { id: "REP-002", name: "Inventory Reconciliation Q1", type: "Inventory", date: "2026-01-28", size: "1.8 MB" },
    { id: "REP-003", name: "Vendor Settlement Summary", type: "Payables", date: "2026-02-15", size: "950 KB" },
    { id: "REP-004", name: "Branch Profitability Map", type: "General", date: "2026-02-10", size: "3.2 MB" },
    { id: "REP-005", name: "Tax Compliance Draft", type: "Regulatory", date: "2026-02-18", size: "4.1 MB" },
];

export default function FinanceReports() {
    return (
        <div className="space-y-8">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-black text-white mb-2">Reports Repository</h1>
                        <p className="text-slate-400 text-sm">Centralized library for all generated financial and operational records.</p>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="hidden md:flex items-center gap-2 bg-white/5 border border-white/10 px-4 py-2 rounded-xl text-slate-400">
                            <Search className="w-4 h-4" />
                            <input type="text" placeholder="Search report library..." className="bg-transparent border-none outline-none text-xs w-48 text-white" />
                        </div>
                        <button className="p-2.5 rounded-xl bg-white/5 border border-white/10 text-slate-400 hover:text-white hover:bg-white/10 transition-all">
                            <Filter className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <div className="bg-brand-card/5 backdrop-blur-md rounded-2xl p-6 border border-white/10 flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-brand-accent/20 text-brand-accent flex items-center justify-center">
                            <Calendar className="w-6 h-6" />
                        </div>
                        <div>
                            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest leading-none mb-1">Last Generated</p>
                            <h4 className="text-lg font-bold text-white leading-none">Today, 2:45 PM</h4>
                        </div>
                    </div>
                    <div className="bg-brand-card/5 backdrop-blur-md rounded-2xl p-6 border border-white/10 flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 text-emerald-500 flex items-center justify-center">
                            <FileText className="w-6 h-6" />
                        </div>
                        <div>
                            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest leading-none mb-1">Total Artifacts</p>
                            <h4 className="text-lg font-bold text-white leading-none">148 Reports</h4>
                        </div>
                    </div>
                </div>

                <div className="bg-brand-card/5 backdrop-blur-md rounded-[32px] border border-white/10 shadow-premium overflow-hidden">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-white/5 border-b border-white/10">
                                <th className="p-6 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Report Name</th>
                                <th className="p-6 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Type</th>
                                <th className="p-6 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Created Date</th>
                                <th className="p-6 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Size</th>
                                <th className="p-6 text-[10px] font-bold text-slate-500 uppercase tracking-widest text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {MOCK_REPORTS.map((report, idx) => (
                                <motion.tr
                                    initial={{ opacity: 0, x: -10 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: idx * 0.05 }}
                                    key={report.id}
                                    className="group hover:bg-white/5 transition-all cursor-default"
                                >
                                    <td className="p-6">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-brand-accent group-hover:scale-110 transition-transform">
                                                <FileText className="w-5 h-5" />
                                            </div>
                                            <div>
                                                <p className="text-sm font-bold text-white group-hover:text-brand-accent transition-colors">{report.name}</p>
                                                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-tighter">{report.id}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="p-6">
                                        <span className="px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 text-[10px] font-black uppercase text-slate-300">
                                            {report.type}
                                        </span>
                                    </td>
                                    <td className="p-6 text-sm font-medium text-slate-400">{report.date}</td>
                                    <td className="p-6 text-sm font-bold text-slate-500">{report.size}</td>
                                    <td className="p-6 text-right">
                                        <div className="flex items-center justify-end gap-2">
                                            <button className="p-2.5 rounded-xl bg-brand-accent text-white shadow-lg shadow-brand-accent/20 hover:scale-110 transition-all">
                                                <Download className="w-4 h-4" />
                                            </button>
                                            <button className="p-2.5 rounded-xl bg-white/5 border border-white/10 text-slate-400 hover:text-white transition-all">
                                                <ChevronRight className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </td>
                                </motion.tr>
                            ))}
                        </tbody>
                    </table>

                    <div className="p-6 bg-white/5 border-t border-white/10 flex items-center justify-between">
                        <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Showing 5 of 148 reports</p>
                        <div className="flex items-center gap-2">
                            <button className="px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-xs font-bold text-slate-400 hover:text-white transition-all">Next Page</button>
                        </div>
                    </div>
                </div>
        </div>
    );
}
