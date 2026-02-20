"use client";

import React from "react";
import { motion, animate } from "framer-motion";
import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function AnimatedCounter({ value, prefix = "", suffix = "" }: { value: number, prefix?: string, suffix?: string }) {
    const nodeRef = React.useRef<HTMLSpanElement>(null);

    React.useEffect(() => {
        const node = nodeRef.current;
        if (!node) return;

        const controls = animate(0, value, {
            duration: 1.5,
            ease: "easeOut",
            onUpdate(value) {
                node.textContent = prefix + Math.round(value).toLocaleString() + suffix;
            }
        });

        return () => controls.stop();
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
        <motion.div
            whileHover={{ scale: 1.05, translateY: -5 }}
            className="bg-brand-card/5 backdrop-blur-md rounded-[28px] p-8 border border-white/10 shadow-premium group relative overflow-hidden transition-all duration-300"
        >
            <div className="absolute top-0 right-0 w-24 h-24 bg-brand-accent/5 blur-3xl -mr-12 -mt-12 group-hover:bg-brand-accent/10 transition-colors"></div>

            <div className="flex items-center justify-between mb-4">
                <div className="p-3 rounded-2xl bg-white/5 border border-white/10 text-brand-accent group-hover:scale-110 transition-transform duration-500">
                    <Icon className="w-6 h-6" />
                </div>
                {trend && (
                    <span className={cn(
                        "text-[10px] font-black px-2 py-1 rounded-lg uppercase tracking-tighter",
                        trend.isUp ? "bg-emerald-500/10 text-emerald-500" : "bg-rose-500/10 text-rose-500"
                    )}>
                        {trend.isUp ? "↑" : "↓"} {trend.value}%
                    </span>
                )}
            </div>

            <div>
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-1">{title}</p>
                <p className="text-3xl font-black text-white tracking-tighter">
                    <AnimatedCounter value={value} prefix={prefix} suffix={suffix} />
                </p>
            </div>
        </motion.div>
    );
}
