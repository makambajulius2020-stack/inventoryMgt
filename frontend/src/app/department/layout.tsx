import type { Metadata } from "next";
import { WithRoleGuard } from "@/lib/auth/withRoleGuard";
import { Role } from "@/lib/auth/roles";
import { MainLayout } from "@/components/layout/MainLayout";

export const metadata: Metadata = {
  title: "Department Head • HUGAMARA",
};

export default function DepartmentLayout({ children }: { children: React.ReactNode }) {
  return (
    <WithRoleGuard requirements={{ roles: [Role.DEPARTMENT_HEAD], requireScope: "DEPARTMENT" }}>
      <MainLayout>{children}</MainLayout>
    </WithRoleGuard>
  );
}
