import type { ReactNode } from "react";
import { CoordinatorGuard } from "@/components/auth/coordinator-guard";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { DashboardProvider } from "@/components/dashboard/dashboard-context";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <CoordinatorGuard>
      <DashboardProvider>
        <DashboardShell>{children}</DashboardShell>
      </DashboardProvider>
    </CoordinatorGuard>
  );
}
