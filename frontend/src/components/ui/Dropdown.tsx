"use client";

import React, { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";

export interface DropdownItem {
    label: string;
    onClick: () => void;
    icon?: React.ComponentType<{ className?: string }>;
    variant?: "default" | "danger";
    disabled?: boolean;
}

export interface DropdownProps {
    trigger: React.ReactNode;
    items: DropdownItem[];
    align?: "left" | "right";
    className?: string;
}

export function Dropdown({ trigger, items, align = "right", className }: DropdownProps) {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) {
                setOpen(false);
            }
        };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, []);

    return (
        <div ref={ref} className={cn("relative inline-block", className)}>
            <div onClick={() => setOpen(!open)}>{trigger}</div>

            {open && (
                <div
                    role="menu"
                    className={cn(
                        "absolute z-50 mt-1 min-w-[160px] rounded-[var(--radius-lg)] border border-[var(--card-border)]",
                        "bg-[var(--popover)] text-[var(--popover-foreground)] shadow-[var(--shadow-lg)]",
                        "py-1",
                        align === "right" ? "right-0" : "left-0",
                    )}
                >
                    {items.map((item, i) => (
                        <button
                            key={i}
                            role="menuitem"
                            disabled={item.disabled}
                            onClick={() => {
                                item.onClick();
                                setOpen(false);
                            }}
                            className={cn(
                                "flex w-full items-center gap-2 px-3 py-2 text-sm transition-colors",
                                "disabled:opacity-50 disabled:pointer-events-none",
                                item.variant === "danger"
                                    ? "text-[var(--danger)] hover:bg-[var(--danger-muted)]"
                                    : "text-[var(--text-secondary)] hover:bg-[var(--surface-raised)] hover:text-[var(--text-primary)]",
                            )}
                        >
                            {item.icon && <item.icon className="h-4 w-4 shrink-0" />}
                            {item.label}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
