import type { Metadata } from "next";
import { WithRoleGuard } from "@/lib/auth/withRoleGuard";
import { Role } from "@/lib/auth/roles";
import { MainLayout } from "@/components/layout/MainLayout";

export const metadata: Metadata = {
  title: "System Auditor • HUGAMARA",
};

export default function AuditorLayout({ children }: { children: React.ReactNode }) {
  return (
    <WithRoleGuard requirements={{ roles: [Role.SYSTEM_AUDITOR], requireScope: "GLOBAL", readOnly: true }}>
      <MainLayout>{children}</MainLayout>
    </WithRoleGuard>
  );
}
