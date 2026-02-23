"use client";

import React from "react";
import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function AnimatedCounter({ value, prefix = "", suffix = "" }: { value: number, prefix?: string, suffix?: string }) {
    const nodeRef = React.useRef<HTMLSpanElement>(null);

    React.useEffect(() => {
        const node = nodeRef.current;
        if (!node) return;

        const durationMs = 1200;
        const start = performance.now();
        let rafId = 0;

        const tick = (now: number) => {
            const t = Math.min(1, (now - start) / durationMs);
            const eased = 1 - Math.pow(1 - t, 3);
            const current = value * eased;
            node.textContent = prefix + Math.round(current).toLocaleString() + suffix;
            if (t < 1) rafId = requestAnimationFrame(tick);
        };

        rafId = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(rafId);
    }, [value, prefix, suffix]);

    return <span ref={nodeRef} className="tabular-nums">0</span>;
}

export function ASICard({ title, value, icon: Icon, trend, prefix = "", suffix = "" }: {
    title: string,
    value: number,
    icon: LucideIcon,
    trend?: { value: number, isUp: boolean },
    prefix?: string,
    suffix?: string
}) {
    return (
        <div className="bg-brand-card/5 backdrop-blur-md rounded-[28px] p-8 border border-white/10 shadow-premium group relative overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:scale-[1.02]">
            <div className="absolute top-0 right-0 w-24 h-24 bg-brand-accent/5 blur-3xl -mr-12 -mt-12 group-hover:bg-brand-accent/10 transition-colors"></div>

            <div className="flex items-center justify-between mb-4">
                <div className="p-3 rounded-2xl bg-white/5 border border-white/10 text-[var(--accent-hover)] group-hover:scale-110 transition-transform duration-500">
                    <Icon className="w-6 h-6" />
                </div>
                {trend && (
                    <span className={cn(
                        "text-[10px] font-black px-2 py-1 rounded-lg uppercase tracking-tighter",
                        trend.isUp ? "bg-emerald-500/10 text-emerald-300 border border-emerald-500/20" : "bg-rose-500/10 text-rose-300 border border-rose-500/20"
                    )}>
                        {trend.isUp ? "↑" : "↓"} {trend.value}%
                    </span>
                )}
            </div>

            <div>
                <p className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-[0.2em] mb-1">{title}</p>
                <p className="text-3xl font-black text-white tracking-tighter">
                    <AnimatedCounter value={value} prefix={prefix} suffix={suffix} />
                </p>
            </div>
        </div>
    );
}
