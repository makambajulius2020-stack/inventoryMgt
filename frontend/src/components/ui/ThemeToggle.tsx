"use client";

import React, { useState } from "react";
import { Sun, Moon } from "lucide-react";
import { cn } from "@/lib/utils";

export function ThemeToggle({ className }: { className?: string }) {
    const [isDark, setIsDark] = useState(() => {
        if (typeof document === "undefined") return true;
        return !document.documentElement.classList.contains("light");
    });

    const toggle = () => {
        const html = document.documentElement;
        if (isDark) {
            html.classList.add("light");
            html.style.colorScheme = "light";
        } else {
            html.classList.remove("light");
            html.style.colorScheme = "dark";
        }
        setIsDark(!isDark);
    };

    return (
        <button
            onClick={toggle}
            aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
            className={cn(
                "inline-flex items-center justify-center h-9 w-9 rounded-[var(--radius-lg)]",
                "text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-raised)]",
                "transition-colors duration-150",
                className,
            )}
        >
            {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </button>
    );
}
