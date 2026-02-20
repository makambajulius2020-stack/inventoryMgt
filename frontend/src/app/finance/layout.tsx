import type { Metadata } from "next";
import { WithRoleGuard } from "@/lib/auth/withRoleGuard";
import { Role } from "@/lib/auth/roles";
import { MainLayout } from "@/components/layout/MainLayout";

export const metadata: Metadata = {
    title: "Finance Hub • HUGAMARA",
};

export default function FinanceLayout({ children }: { children: React.ReactNode }) {
    return (
        <WithRoleGuard requirements={{ roles: [Role.FINANCE_MANAGER], requireScope: "LOCATION" }}>
            <MainLayout>{children}</MainLayout>
        </WithRoleGuard>
    );
}
