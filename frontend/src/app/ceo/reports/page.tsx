"use client";

import React from "react";
import Link from "next/link";

import { Card } from "@/components/ui/Card";

export default function CeoReportsPage() {
  return (
    <div className="p-8 space-y-6 max-w-[1200px] mx-auto">
      <div>
        <h1 className="text-3xl font-black text-[var(--text-primary)] tracking-tighter uppercase">Executive Reports</h1>
        <p className="text-[var(--text-secondary)] font-medium">High-level reporting for global oversight.</p>
      </div>

      <Card title="Reports" subtitle="This section is reserved for executive reporting only.">
        <div className="pt-2">
          <Link href="/ceo/dashboard" className="text-sm font-bold text-[var(--accent-hover)] hover:underline">
            Back to Executive Dashboard
          </Link>
        </div>
      </Card>
    </div>
  );
}
