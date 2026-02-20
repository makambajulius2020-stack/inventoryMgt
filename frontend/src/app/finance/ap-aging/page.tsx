"use client";

import React from "react";
import { DashboardCard } from "@/components/dashboard/DashboardCard";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { Clock, AlertTriangle, CheckCircle2, TrendingUp } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

const MOCK_DATA = [
    { range: "0-30 Days", amount: 125000, color: "#2C6BED", status: "Healthy" },
    { range: "31-60 Days", amount: 45000, color: "#fbbf24", status: "Warning" },
    { range: "61-90 Days", amount: 25000, color: "#f97316", status: "Overdue" },
    { range: "90+ Days", amount: 12000, color: "#e11d48", status: "Critical" },
];

export default function FinanceAPAging() {
    const totalAP = MOCK_DATA.reduce((acc, curr) => acc + curr.amount, 0);

    return (
        <div className="space-y-8">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-black text-white mb-2">Accounts Payable Aging</h1>
                        <p className="text-slate-400">Deep analysis of settlement timelines and liquidity requirements.</p>
                    </div>
                    <div className="flex items-center gap-3">
                        <button className="px-5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white font-bold hover:bg-white/10 transition-all text-sm">
                            Export Ledger
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <DashboardCard title="Total Payable" value={`UGX ${(totalAP / 1000).toFixed(1)}k`} icon={Clock} />
                    <DashboardCard title="Current (0-30)" value={`UGX ${(MOCK_DATA[0].amount / 1000).toFixed(1)}k`} icon={CheckCircle2} />
                    <DashboardCard title="Overdue (60+)" value={`UGX ${((MOCK_DATA[2].amount + MOCK_DATA[3].amount) / 1000).toFixed(1)}k`} icon={AlertTriangle} />
                    <DashboardCard title="Days Payable Avg" value="42 Days" icon={TrendingUp} />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    <div className="bg-brand-card/5 backdrop-blur-md rounded-[32px] border border-white/10 shadow-premium p-8">
                        <h3 className="text-xl font-black text-white mb-2">Settlement Curve</h3>
                        <p className="text-slate-400 text-sm mb-6">Distribution of AP by overdue bucket</p>
                        <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">Aggregate View</span>
                        <div className="h-[350px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={MOCK_DATA}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" vertical={false} />
                                    <XAxis dataKey="range" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} dy={10} />
                                    <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} dx={-10} />
                                    <Tooltip
                                        cursor={{ fill: 'rgba(255,255,255,0.03)' }}
                                        contentStyle={{ backgroundColor: '#102B52', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '16px', boxShadow: '0 10px 30px rgba(0,0,0,0.5)' }}
                                        itemStyle={{ color: '#fff' }}
                                    />
                                    <Bar dataKey="amount" radius={[8, 8, 0, 0]} barSize={60}>
                                        {MOCK_DATA.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.color} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    <div className="bg-[#102B52] rounded-[32px] p-8 border border-white/10 shadow-premium">
                        <h3 className="text-xl font-bold text-white mb-6">Status Breakdown</h3>
                        <div className="space-y-6">
                            {MOCK_DATA.map((item) => (
                                <div key={item.range} className="group cursor-default">
                                    <div className="flex items-center justify-between mb-2">
                                        <div className="flex items-center gap-3">
                                            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }}></div>
                                            <span className="text-sm font-bold text-slate-300 group-hover:text-white transition-colors">{item.range}</span>
                                        </div>
                                        <span className="text-sm font-black text-white">UGX {(item.amount / 1000).toFixed(1)}k</span>
                                    </div>
                                    <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
                                        <motion.div
                                            initial={{ width: 0 }}
                                            animate={{ width: `${(item.amount / totalAP) * 100}%` }}
                                            className="h-full rounded-full"
                                            style={{ backgroundColor: item.color }}
                                        />
                                    </div>
                                    <div className="mt-1 flex justify-end">
                                        <span className={cn(
                                            "text-[10px] font-black uppercase tracking-tighter",
                                            item.status === 'Healthy' ? 'text-emerald-400' :
                                                item.status === 'Warning' ? 'text-amber-400' : 'text-rose-400'
                                        )}>{item.status}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                        <button className="w-full mt-8 py-3 rounded-2xl bg-white/5 border border-white/10 text-white text-xs font-bold hover:bg-brand-accent hover:border-brand-accent transition-all">
                            Review Critical Invoices
                        </button>
                    </div>
                </div>
        </div>
    );
}
