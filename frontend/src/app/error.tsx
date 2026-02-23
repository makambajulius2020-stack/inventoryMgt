"use client";

import React, { useEffect } from "react";

import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    void error;
  }, [error]);

  return (
    <div className="p-8 max-w-[900px] mx-auto">
      <Card title="System Error" subtitle="A route failed to render">
        <div className="p-6 space-y-4">
          <p className="text-sm font-bold text-[var(--danger)]">
            {error.message || "An unexpected error occurred."}
          </p>
          <Button onClick={reset} size="sm">
            Retry
          </Button>
        </div>
      </Card>
    </div>
  );
}
