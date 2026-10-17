import type { ReactNode } from "react";
import { CoordinatorGuard } from "@/components/auth/coordinator-guard";
import { DashboardShell } from "@/components/layout/dashboard-shell";
export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <CoordinatorGuard>
      <DashboardShell>{children}</DashboardShell>
    </CoordinatorGuard>
  );
}
