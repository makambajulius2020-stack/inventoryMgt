"use client";

import React, { useEffect } from "react";

interface AnimatedCounterProps {
    value: number;
    prefix?: string;
    suffix?: string;
    decimals?: number;
}

export function AnimatedCounter({ value, prefix = "", suffix = "", decimals = 0 }: AnimatedCounterProps) {
    const [display, setDisplay] = React.useState(() => {
        return prefix + (0).toLocaleString(undefined, {
            minimumFractionDigits: decimals,
            maximumFractionDigits: decimals,
        }) + suffix;
    });

    useEffect(() => {
        const durationMs = 1200;
        const start = performance.now();
        const from = 0;
        let rafId = 0;

        const tick = (now: number) => {
            const t = Math.min(1, (now - start) / durationMs);
            const eased = 1 - Math.pow(1 - t, 3);
            const current = from + (value - from) * eased;
            setDisplay(prefix + current.toLocaleString(undefined, {
                minimumFractionDigits: decimals,
                maximumFractionDigits: decimals,
            }) + suffix);
            if (t < 1) rafId = requestAnimationFrame(tick);
        };

        rafId = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(rafId);
    }, [value, prefix, suffix, decimals]);

    return <span>{display}</span>;
}
