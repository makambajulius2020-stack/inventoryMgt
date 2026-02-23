import React from "react";
import { cn } from "@/lib/utils";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: "primary" | "secondary" | "outline" | "ghost" | "danger";
    size?: "sm" | "md" | "lg" | "icon";
    isLoading?: boolean;
    asChild?: boolean;
}

const variantStyles: Record<NonNullable<ButtonProps["variant"]>, string> = {
    primary:
        "bg-[var(--primary)] text-[var(--primary-foreground)] hover:bg-[var(--primary-hover)]",
    secondary:
        "bg-[var(--accent)] text-[var(--accent-foreground)] hover:bg-[var(--accent-hover)]",
    outline:
        "border border-[var(--border)] text-[var(--text-primary)] bg-transparent hover:bg-[var(--surface-raised)]",
    ghost:
        "text-[var(--text-secondary)] bg-transparent hover:bg-[var(--surface-raised)] hover:text-[var(--text-primary)]",
    danger:
        "bg-[var(--danger)] text-white hover:opacity-90",
};

const sizeStyles: Record<NonNullable<ButtonProps["size"]>, string> = {
    sm:   "h-8 px-3 text-xs gap-1.5",
    md:   "h-9 px-4 text-sm gap-2",
    lg:   "h-11 px-6 text-sm gap-2",
    icon: "h-9 w-9 p-0",
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
    ({ className, variant = "primary", size = "md", isLoading, disabled, asChild, children, ...props }, ref) => {
        const mergedClassName = cn(
            "inline-flex items-center justify-center rounded-[var(--radius-lg)] font-semibold",
            "transition-all duration-150 active:scale-[0.97]",
            "focus-visible:outline-2 focus-visible:outline-[var(--ring)] focus-visible:outline-offset-2",
            "disabled:pointer-events-none disabled:opacity-50",
            variantStyles[variant],
            sizeStyles[size],
            className,
        );

        if (asChild) {
            if (!React.isValidElement(children)) {
                throw new Error("Button with asChild expects a single valid React element child");
            }

            type ChildProps = { className?: string } & Record<string, unknown>;
            const child = children as React.ReactElement<ChildProps>;
            const childClassName = (child.props as { className?: string }).className;

            return React.cloneElement(child, {
                ...((props as unknown) as Partial<ChildProps>),
                className: cn(mergedClassName, childClassName),
                "aria-busy": isLoading || undefined,
                "aria-disabled": disabled || isLoading || undefined,
            } as unknown as Partial<ChildProps> & React.Attributes);
        }

        return (
            <button
                ref={ref}
                disabled={disabled || isLoading}
                aria-busy={isLoading || undefined}
                className={mergedClassName}
                {...props}
            >
                {isLoading && (
                    <svg className="animate-spin h-4 w-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                )}
                {children}
            </button>
        );
    },
);

Button.displayName = "Button";
