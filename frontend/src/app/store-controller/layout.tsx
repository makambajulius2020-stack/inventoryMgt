import type { Metadata } from "next";
import { WithRoleGuard } from "@/lib/auth/withRoleGuard";
import { Role } from "@/lib/auth/roles";
import { MainLayout } from "@/components/layout/MainLayout";

export const metadata: Metadata = {
  title: "Store Controller • HUGAMARA",
};

export default function StoreControllerLayout({ children }: { children: React.ReactNode }) {
  return (
    <WithRoleGuard requirements={{ roles: [Role.STORE_CONTROLLER], requireScope: "LOCATION" }}>
      <MainLayout>{children}</MainLayout>
    </WithRoleGuard>
  );
}
