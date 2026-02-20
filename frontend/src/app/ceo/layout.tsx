import type { Metadata } from "next";
import { WithRoleGuard } from "@/lib/auth/withRoleGuard";
import { Role } from "@/lib/auth/roles";
import { MainLayout } from "@/components/layout/MainLayout";

export const metadata: Metadata = {
    title: "CEO Office • HUGAMARA",
};

export default function CEOLayout({ children }: { children: React.ReactNode }) {
    return (
        <WithRoleGuard requirements={{ roles: [Role.CEO], requireScope: "GLOBAL" }}>
            <MainLayout>{children}</MainLayout>
        </WithRoleGuard>
    );
}
