"use client";

import React, { useState } from "react";
import { cn } from "@/lib/utils";

export interface Tab {
    id: string;
    label: string;
    icon?: React.ComponentType<{ className?: string }>;
}

export interface TabsProps {
    tabs: Tab[];
    defaultTab?: string;
    activeTab?: string;
    onTabChange?: (tabId: string) => void;
    children: (activeTab: string) => React.ReactNode;
    className?: string;
}

export function Tabs({ tabs, defaultTab, activeTab: controlledTab, onTabChange, children, className }: TabsProps) {
    const [internalTab, setInternalTab] = useState(defaultTab || tabs[0]?.id || "");
    const active = controlledTab ?? internalTab;

    const handleChange = (id: string) => {
        if (!controlledTab) setInternalTab(id);
        onTabChange?.(id);
    };

    return (
        <div className={className}>
            <div
                role="tablist"
                aria-orientation="horizontal"
                className="flex gap-1 border-b border-[var(--border-subtle)] pb-px"
            >
                {tabs.map((tab) => {
                    const isActive = active === tab.id;
                    return (
                        <button
                            key={tab.id}
                            role="tab"
                            aria-selected={isActive}
                            aria-controls={`tabpanel-${tab.id}`}
                            onClick={() => handleChange(tab.id)}
                            className={cn(
                                "inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-t-[var(--radius-md)] transition-colors",
                                "focus-visible:outline-2 focus-visible:outline-[var(--ring)] focus-visible:outline-offset-2",
                                isActive
                                    ? "text-[var(--accent)] border-b-2 border-[var(--accent)] -mb-px"
                                    : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]",
                            )}
                        >
                            {tab.icon && <tab.icon className="h-3.5 w-3.5" />}
                            {tab.label}
                        </button>
                    );
                })}
            </div>
            <div role="tabpanel" id={`tabpanel-${active}`} className="pt-4">
                {children(active)}
            </div>
        </div>
    );
}
