"use client";

import React, { useEffect, useRef, useCallback } from "react";
import { cn } from "@/lib/utils";
import { X } from "lucide-react";

export interface DrawerProps {
    open: boolean;
    onClose: () => void;
    title?: string;
    children: React.ReactNode;
    className?: string;
    side?: "right" | "left";
}

export function Drawer({ open, onClose, title, children, className, side = "right" }: DrawerProps) {
    const overlayRef = useRef<HTMLDivElement>(null);

    const handleKeyDown = useCallback(
        (e: KeyboardEvent) => {
            if (e.key === "Escape") onClose();
        },
        [onClose],
    );

    useEffect(() => {
        if (open) {
            document.addEventListener("keydown", handleKeyDown);
            document.body.style.overflow = "hidden";
        }
        return () => {
            document.removeEventListener("keydown", handleKeyDown);
            document.body.style.overflow = "";
        };
    }, [open, handleKeyDown]);

    if (!open) return null;

    return (
        <div
            ref={overlayRef}
            role="dialog"
            aria-modal="true"
            aria-label={title}
            className="fixed inset-0 z-[100]"
            onClick={(e) => {
                if (e.target === overlayRef.current) onClose();
            }}
        >
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" aria-hidden="true" />

            <div
                className={cn(
                    "absolute top-0 bottom-0 w-full max-w-md",
                    "bg-[var(--card)] border-[var(--card-border)] shadow-[var(--shadow-xl)]",
                    "flex flex-col",
                    side === "right" ? "right-0 border-l" : "left-0 border-r",
                    className,
                )}
            >
                {title && (
                    <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-subtle)] shrink-0">
                        <h2 className="text-sm font-bold text-[var(--text-primary)]">{title}</h2>
                        <button
                            onClick={onClose}
                            aria-label="Close drawer"
                            className="rounded-[var(--radius-md)] p-1.5 text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-raised)] transition-colors"
                        >
                            <X className="h-4 w-4" />
                        </button>
                    </div>
                )}
                <div className="flex-1 overflow-y-auto p-6">{children}</div>
            </div>
        </div>
    );
}
