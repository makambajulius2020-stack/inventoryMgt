"use client";

import React from "react";
import { ResponsiveContainer } from "recharts";
import { SectionCard } from "./SectionCard";

export const CHART_TOOLTIP_STYLE = {
    contentStyle: {
        backgroundColor: '#0f172a',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: '16px',
        padding: '12px',
        boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)'
    },
    itemStyle: { color: '#fff', fontSize: '12px', fontWeight: 700 },
    labelStyle: { color: '#64748b', fontSize: '10px', fontWeight: 800, textTransform: 'uppercase' as const, marginBottom: '4px' }
};

interface ChartCardProps {
    title: string;
    children: React.ReactElement;
    height?: number;
    action?: React.ReactNode;
}

export function ChartCard({ title, children, height = 300, action }: ChartCardProps) {
    return (
        <SectionCard title={title} action={action}>
            <div style={{ width: "100%", height }}>
                <ResponsiveContainer width="100%" height="100%">
                    {children}
                </ResponsiveContainer>
            </div>
        </SectionCard>
    );
}
