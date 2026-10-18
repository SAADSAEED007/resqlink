import { request, queryString } from "./client";

export type TrendRange = "24h" | "7d" | "30d";
export interface DashboardTrendPoint {
  label: string;
  count: number;
  criticalCount: number;
  highCount?: number;
  mediumCount?: number;
  lowCount?: number;
}
export interface DashboardSummary {
  trends: { last24Hours: DashboardTrendPoint[]; last7Days: DashboardTrendPoint[]; last30Days?: DashboardTrendPoint[] };
}
export interface DashboardActivity {
  id: string;
  type: "INCIDENT_REPORTED" | "TEAM_ASSIGNED" | "ASSIGNMENT_COMPLETED" | "INCIDENT_RESOLVED" | "STATUS_CHANGED" | "PRIORITY_OVERRIDE";
  title: string;
  timestamp: string;
  priority?: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  status?: string;
  metadata?: { incidentId?: string; teamId?: string; assignmentId?: string };
}
export const dashboard = {
  summary: (signal?: AbortSignal) => request<DashboardSummary>("/dashboard/summary?isSimulated=false", { signal }),
  activity: (signal?: AbortSignal) => request<{ items: DashboardActivity[] }>(`/dashboard/activity${queryString({ isSimulated: false, limit: 10 })}`, { signal }),
};
