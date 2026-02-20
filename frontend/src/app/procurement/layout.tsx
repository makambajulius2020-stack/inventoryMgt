import type { Metadata } from "next";
import { WithRoleGuard } from "@/lib/auth/withRoleGuard";
import { Role } from "@/lib/auth/roles";
import { MainLayout } from "@/components/layout/MainLayout";

export const metadata: Metadata = {
    title: "Procurement Hub • HUGAMARA",
};

export default function ProcurementLayout({ children }: { children: React.ReactNode }) {
    return (
        <WithRoleGuard requirements={{ roles: [Role.PROCUREMENT_OFFICER], requireScope: "LOCATION" }}>
            <MainLayout>{children}</MainLayout>
        </WithRoleGuard>
    );
}
