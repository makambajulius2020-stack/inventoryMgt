import React from "react";
import { cn } from "@/lib/utils";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
    label?: string;
    error?: string;
    hint?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
    ({ className, label, error, hint, id, ...props }, ref) => {
        const inputId = id || label?.toLowerCase().replace(/\s+/g, "-");
        return (
            <div className="space-y-1.5">
                {label && (
                    <label
                        htmlFor={inputId}
                        className="block text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider"
                    >
                        {label}
                    </label>
                )}
                <input
                    ref={ref}
                    id={inputId}
                    aria-invalid={!!error || undefined}
                    aria-describedby={error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined}
                    className={cn(
                        "flex h-9 w-full rounded-[var(--radius-md)] px-3 text-sm",
                        "bg-[var(--input)] border border-[var(--input-border)]",
                        "text-[var(--text-primary)] placeholder:text-[var(--text-muted)]",
                        "focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] focus:border-transparent",
                        "disabled:cursor-not-allowed disabled:opacity-50",
                        "transition-colors duration-150",
                        error && "border-[var(--danger)] focus:ring-[var(--danger)]",
                        className,
                    )}
                    {...props}
                />
                {error && (
                    <p id={`${inputId}-error`} className="text-xs text-[var(--danger)]" role="alert">
                        {error}
                    </p>
                )}
                {hint && !error && (
                    <p id={`${inputId}-hint`} className="text-xs text-[var(--text-muted)]">
                        {hint}
                    </p>
                )}
            </div>
        );
    },
);

Input.displayName = "Input";
