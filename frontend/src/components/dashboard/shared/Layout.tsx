"use client";

import React from "react";

export function DashboardShell({ children }: { children: React.ReactNode }) {
    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            {children}
        </div>
    );
}

export function KPIGrid({ children }: { children: React.ReactNode }) {
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-4 gap-6">
            {children}
        </div>
    );
}

export function SectionCard({ title, children, className }: { title?: string, children: React.ReactNode, className?: string }) {
    return (
        <div className={`bg-brand-card/5 backdrop-blur-md rounded-[28px] border border-white/10 shadow-premium overflow-hidden ${className}`}>
            {title && (
                <div className="px-8 py-6 border-b border-white/5 bg-white/[0.02]">
                    <h3 className="text-sm font-black text-white uppercase tracking-widest">{title}</h3>
                </div>
            )}
            <div className="p-8">
                {children}
            </div>
        </div>
    );
}
