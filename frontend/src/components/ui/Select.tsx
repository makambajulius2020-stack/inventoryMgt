import React from "react";
import { cn } from "@/lib/utils";

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
    label?: string;
    error?: string;
    options: { value: string; label: string }[];
    placeholder?: string;
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
    ({ className, label, error, options, placeholder, id, ...props }, ref) => {
        const selectId = id || label?.toLowerCase().replace(/\s+/g, "-");
        return (
            <div className="space-y-1.5">
                {label && (
                    <label
                        htmlFor={selectId}
                        className="block text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider"
                    >
                        {label}
                    </label>
                )}
                <select
                    ref={ref}
                    id={selectId}
                    aria-invalid={!!error || undefined}
                    className={cn(
                        "flex h-9 w-full rounded-[var(--radius-md)] px-3 text-sm appearance-none",
                        "bg-[var(--input)] border border-[var(--input-border)]",
                        "text-[var(--text-primary)]",
                        "focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] focus:border-transparent",
                        "disabled:cursor-not-allowed disabled:opacity-50",
                        "transition-colors duration-150",
                        error && "border-[var(--danger)] focus:ring-[var(--danger)]",
                        className,
                    )}
                    {...props}
                >
                    {placeholder && (
                        <option value="" disabled>
                            {placeholder}
                        </option>
                    )}
                    {options.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                            {opt.label}
                        </option>
                    ))}
                </select>
                {error && (
                    <p className="text-xs text-[var(--danger)]" role="alert">
                        {error}
                    </p>
                )}
            </div>
        );
    },
);

Select.displayName = "Select";
