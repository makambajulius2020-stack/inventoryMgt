import type { Metadata } from "next";

import { RequireRoles } from "@/components/core/RequireRoles";
import { BranchSidebar } from "@/components/core/BranchSidebar";

export const metadata: Metadata = {
  title: "Branch Portal",
};

export default function BranchLayout({ children }: { children: React.ReactNode }) {
  return (
    <RequireRoles roles={["BRANCH_MANAGER"]}>
      <div className="min-h-screen bg-zinc-50">
        <div className="mx-auto flex max-w-7xl">
          <BranchSidebar />
          <main className="w-full px-6 py-8">{children}</main>
        </div>
      </div>
    </RequireRoles>
  );
}
