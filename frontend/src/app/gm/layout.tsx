import type { Metadata } from "next";
import { WithRoleGuard } from "@/lib/auth/withRoleGuard";
import { Role } from "@/lib/auth/roles";
import { MainLayout } from "@/components/layout/MainLayout";

export const metadata: Metadata = {
  title: "General Manager • HUGAMARA",
};

export default function GmLayout({ children }: { children: React.ReactNode }) {
  return (
    <WithRoleGuard requirements={{ roles: [Role.GENERAL_MANAGER], requireScope: "LOCATION" }}>
      <MainLayout>{children}</MainLayout>
    </WithRoleGuard>
  );
}
