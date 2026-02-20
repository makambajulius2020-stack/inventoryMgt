"use client";

import React from "react";
import Link from "next/link";

import { Card } from "@/components/ui/Card";

export default function CeoReportsPage() {
  return (
    <div className="p-8 space-y-6 max-w-[1200px] mx-auto">
      <div>
        <h1 className="text-3xl font-black text-[#001F3F] dark:text-white tracking-tighter uppercase">Executive Reports</h1>
        <p className="text-slate-500 font-medium">High-level reporting for global oversight.</p>
      </div>

      <Card title="Reports" subtitle="This section is reserved for executive reporting only.">
        <div className="pt-2">
          <Link href="/ceo/dashboard" className="text-sm font-bold text-teal-700 hover:underline">
            Back to Executive Dashboard
          </Link>
        </div>
      </Card>
    </div>
  );
}
