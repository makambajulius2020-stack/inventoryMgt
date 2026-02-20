"use client";

import React, { createContext, useContext, useState, useCallback } from "react";
import { cn } from "@/lib/utils";
import { X, CheckCircle, AlertTriangle, Info, XCircle } from "lucide-react";

type ToastVariant = "success" | "warning" | "danger" | "info";

interface Toast {
    id: string;
    message: string;
    variant: ToastVariant;
}

interface ToastContextValue {
    toast: (message: string, variant?: ToastVariant) => void;
}

const ToastContext = createContext<ToastContextValue>({ toast: () => {} });

export function useToast() {
    return useContext(ToastContext);
}

const icons: Record<ToastVariant, React.ComponentType<{ className?: string }>> = {
    success: CheckCircle,
    warning: AlertTriangle,
    danger: XCircle,
    info: Info,
};

const variantStyles: Record<ToastVariant, string> = {
    success: "border-[var(--success)] bg-[var(--success-muted)] text-[var(--success)]",
    warning: "border-[var(--warning)] bg-[var(--warning-muted)] text-[var(--warning)]",
    danger:  "border-[var(--danger)] bg-[var(--danger-muted)] text-[var(--danger)]",
    info:    "border-[var(--info)] bg-[var(--info-muted)] text-[var(--info)]",
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
    const [toasts, setToasts] = useState<Toast[]>([]);

    const addToast = useCallback((message: string, variant: ToastVariant = "info") => {
        const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
        setToasts((prev) => [...prev, { id, message, variant }]);
        setTimeout(() => {
            setToasts((prev) => prev.filter((t) => t.id !== id));
        }, 4000);
    }, []);

    const removeToast = useCallback((id: string) => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
    }, []);

    return (
        <ToastContext.Provider value={{ toast: addToast }}>
            {children}
            {/* Toast container */}
            <div
                aria-live="polite"
                className="fixed bottom-4 right-4 z-[200] flex flex-col gap-2 pointer-events-none"
            >
                {toasts.map((t) => {
                    const Icon = icons[t.variant];
                    return (
                        <div
                            key={t.id}
                            role="alert"
                            className={cn(
                                "pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-[var(--radius-lg)]",
                                "border shadow-[var(--shadow-lg)] min-w-[280px] max-w-sm",
                                "animate-in slide-in-from-right fade-in duration-200",
                                variantStyles[t.variant],
                            )}
                        >
                            <Icon className="h-4 w-4 shrink-0" />
                            <span className="text-sm font-medium flex-1">{t.message}</span>
                            <button
                                onClick={() => removeToast(t.id)}
                                aria-label="Dismiss"
                                className="shrink-0 opacity-60 hover:opacity-100 transition-opacity"
                            >
                                <X className="h-3.5 w-3.5" />
                            </button>
                        </div>
                    );
                })}
            </div>
        </ToastContext.Provider>
    );
}
