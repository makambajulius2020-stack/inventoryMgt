"use client";

import React from "react";
import { DashboardCard } from "@/components/dashboard/DashboardCard";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { Wallet, Target, TrendingDown, Landmark, Plus, ArrowUpRight } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

const BUDGET_DATA = [
    { name: "Patiobela", allocated: 250000, spent: 180000, color: "#2C6BED" },
    { name: "Maze Bistro", allocated: 180000, spent: 165000, color: "#8b5cf6" },
    { name: "Eateroo", allocated: 150000, spent: 142000, color: "#ec4899" },
    { name: "Rosa Dames", allocated: 200000, spent: 85000, color: "#10b981" },
];

export default function FinanceBudget() {
    const totalAllocated = BUDGET_DATA.reduce((acc, curr) => acc + curr.allocated, 0);
    const totalSpent = BUDGET_DATA.reduce((acc, curr) => acc + curr.spent, 0);

    return (
        <div className="space-y-8">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-black text-white mb-2">Budget Governance</h1>
                        <p className="text-slate-400">Monitoring expenditure against planned capital allocations.</p>
                    </div>
                    <button className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-brand-accent text-white font-bold shadow-xl shadow-brand-accent/30 hover:translate-y-[-2px] transition-all">
                        <Plus className="w-5 h-5" />
                        Adjust Allocations
                    </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <DashboardCard title="Global Budget" value="UGX 1.2M" icon={Landmark} />
                    <DashboardCard title="Total Allocated" value={`UGX ${(totalAllocated / 1000).toFixed(1)}k`} icon={Wallet} />
                    <DashboardCard title="Budget Burn Rate" value={`${((totalSpent / totalAllocated) * 100).toFixed(1)}%`} icon={Target} />
                    <DashboardCard title="Saved vs Budget" value="UGX 220k" icon={TrendingDown} />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Detailed Budget Table */}
                    <div className="lg:col-span-2 bg-brand-card/5 backdrop-blur-md rounded-[32px] p-8 border border-white/10 shadow-premium overflow-hidden">
                        <h3 className="text-xl font-bold text-white mb-8 text-center md:text-left">Branch Allocation Status</h3>
                        <div className="space-y-6">
                            {BUDGET_DATA.map((branch) => {
                                const burn = (branch.spent / branch.allocated) * 100;
                                return (
                                    <div key={branch.name} className="p-6 rounded-[28px] bg-white/5 border border-white/5 hover:border-brand-accent/30 transition-all group">
                                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                                            <div className="flex items-center gap-4">
                                                <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-white font-black text-xl">
                                                    {branch.name[0]}
                                                </div>
                                                <div>
                                                    <h4 className="text-lg font-bold text-white tracking-tight">{branch.name}</h4>
                                                    <p className="text-xs font-medium text-slate-500">Expenditure Control Level 4</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-8">
                                                <div className="text-right">
                                                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Spent</p>
                                                    <p className="text-sm font-black text-white">UGX {(branch.spent / 1000).toFixed(0)}k</p>
                                                </div>
                                                <div className="text-right">
                                                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Limit</p>
                                                    <p className="text-sm font-black text-slate-400">UGX {(branch.allocated / 1000).toFixed(0)}k</p>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="space-y-2">
                                            <div className="flex justify-between items-end">
                                                <span className="text-[10px] font-black text-slate-500 uppercase">Usage Velocity</span>
                                                <span className={cn(
                                                    "text-sm font-black",
                                                    burn > 90 ? "text-rose-400" : burn > 70 ? "text-amber-400" : "text-emerald-400"
                                                )}>{burn.toFixed(1)}%</span>
                                            </div>
                                            <div className="h-3 w-full bg-white/5 rounded-full overflow-hidden p-0.5 border border-white/5">
                                                <motion.div
                                                    initial={{ width: 0 }}
                                                    animate={{ width: `${burn}%` }}
                                                    transition={{ duration: 1.5, ease: "circOut" }}
                                                    className={cn(
                                                        "h-full rounded-full shadow-[0_0_15px_rgba(0,0,0,0.5)]",
                                                        burn > 90 ? "bg-rose-500" : burn > 70 ? "bg-amber-500" : "bg-brand-accent"
                                                    )}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Budget Breakdown Pie Chart */}
                    <div className="bg-[#102B52] rounded-[32px] p-8 border border-white/10 shadow-premium flex flex-col">
                        <h3 className="text-xl font-bold text-white mb-6">Allocation Mix</h3>
                        <div className="h-[280px] w-full relative mb-8">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={BUDGET_DATA}
                                        innerRadius={70}
                                        outerRadius={95}
                                        paddingAngle={4}
                                        dataKey="allocated"
                                    >
                                        {BUDGET_DATA.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.color} stroke="none" />
                                        ))}
                                    </Pie>
                                    <Tooltip
                                        contentStyle={{ backgroundColor: '#102B52', border: 'none', borderRadius: '12px', boxShadow: '0 10px 40px rgba(0,0,0,0.5)' }}
                                        itemStyle={{ color: '#fff' }}
                                    />
                                </PieChart>
                            </ResponsiveContainer>
                            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                                <p className="text-[10px] font-bold text-slate-500 uppercase">Total CapEx</p>
                                <p className="text-2xl font-black text-white">UGX 0.8M</p>
                            </div>
                        </div>

                        <div className="space-y-3 flex-1">
                            {BUDGET_DATA.map((branch) => (
                                <div key={branch.name} className="flex items-center justify-between p-3 rounded-2xl bg-white/5 border border-white/5 hover:bg-white/10 transition-all cursor-default group">
                                    <div className="flex items-center gap-3">
                                        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: branch.color }}></div>
                                        <span className="text-xs font-bold text-slate-400 group-hover:text-white transition-colors">{branch.name}</span>
                                    </div>
                                    <span className="text-xs font-black text-white">{((branch.allocated / totalAllocated) * 100).toFixed(0)}%</span>
                                </div>
                            ))}
                        </div>

                        <div className="mt-8 p-4 rounded-2xl bg-brand-accent/10 border border-brand-accent/20 flex items-center justify-between group cursor-pointer hover:bg-brand-accent/20 transition-all">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg bg-brand-accent flex items-center justify-center text-white">
                                    <Landmark className="w-4 h-4" />
                                </div>
                                <span className="text-xs font-bold text-white">Consolidated Audit</span>
                            </div>
                            <ArrowUpRight className="w-4 h-4 text-brand-accent group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
                        </div>
                    </div>
                </div>
        </div>
    );
}
