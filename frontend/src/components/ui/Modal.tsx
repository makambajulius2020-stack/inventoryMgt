"use client";

import React, { useEffect, useRef, useCallback } from "react";
import { cn } from "@/lib/utils";
import { X } from "lucide-react";

export interface ModalProps {
    open: boolean;
    onClose: () => void;
    title?: string;
    description?: string;
    children: React.ReactNode;
    className?: string;
    size?: "sm" | "md" | "lg" | "xl";
}

const sizeStyles: Record<NonNullable<ModalProps["size"]>, string> = {
    sm: "max-w-sm",
    md: "max-w-md",
    lg: "max-w-lg",
    xl: "max-w-2xl",
};

export function Modal({ open, onClose, title, description, children, className, size = "md" }: ModalProps) {
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
            className="fixed inset-0 z-[100] flex items-center justify-center p-4"
            onClick={(e) => {
                if (e.target === overlayRef.current) onClose();
            }}
        >
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" aria-hidden="true" />

            {/* Panel */}
            <div
                className={cn(
                    "relative w-full rounded-[var(--radius-xl)] border border-[var(--card-border)]",
                    "bg-[var(--card)] text-[var(--card-foreground)] shadow-[var(--shadow-xl)]",
                    "animate-in fade-in zoom-in-95 duration-200",
                    sizeStyles[size],
                    className,
                )}
            >
                {/* Header */}
                {(title || description) && (
                    <div className="flex items-start justify-between px-6 pt-6 pb-0">
                        <div>
                            {title && <h2 className="text-base font-bold text-[var(--text-primary)]">{title}</h2>}
                            {description && <p className="text-sm text-[var(--text-muted)] mt-1">{description}</p>}
                        </div>
                        <button
                            onClick={onClose}
                            aria-label="Close dialog"
                            className="shrink-0 rounded-[var(--radius-md)] p-1.5 text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-raised)] transition-colors"
                        >
                            <X className="h-4 w-4" />
                        </button>
                    </div>
                )}

                {/* Body */}
                <div className="p-6">{children}</div>
            </div>
        </div>
    );
}

export function ModalFooter({ children, className }: { children: React.ReactNode; className?: string }) {
    return (
        <div className={cn("flex items-center justify-end gap-3 pt-4 border-t border-[var(--border-subtle)]", className)}>
            {children}
        </div>
    );
}
