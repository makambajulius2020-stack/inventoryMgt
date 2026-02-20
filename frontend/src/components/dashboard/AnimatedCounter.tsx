"use client";

import React, { useEffect } from "react";
import { animate, useMotionValue, useTransform, motion } from "framer-motion";

interface AnimatedCounterProps {
    value: number;
    prefix?: string;
    suffix?: string;
    decimals?: number;
}

export function AnimatedCounter({ value, prefix = "", suffix = "", decimals = 0 }: AnimatedCounterProps) {
    const count = useMotionValue(0);
    const rounded = useTransform(count, (latest) => {
        return prefix + latest.toLocaleString(undefined, {
            minimumFractionDigits: decimals,
            maximumFractionDigits: decimals,
        }) + suffix;
    });

    useEffect(() => {
        const controls = animate(count, value, {
            duration: 1.5,
            ease: "easeOut",
        });
        return controls.stop;
    }, [value, count]);

    return <motion.span>{rounded}</motion.span>;
}
