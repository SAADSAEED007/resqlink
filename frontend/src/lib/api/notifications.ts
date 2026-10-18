import { request, queryString } from "./client";
import type { Paginated } from "@/types/api";

export type NotificationType =
  | "INCIDENT_CREATED"
  | "CRITICAL_INCIDENT"
  | "INCIDENT_REVIEW_REQUIRED"
  | "TEAM_ASSIGNED"
  | "INCIDENT_IN_PROGRESS"
  | "INCIDENT_RESOLVED"
  | "INCIDENT_CANCELLED";

export type NotificationSeverity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "INFO";

export interface NotificationItem {
  id: string;
  type: NotificationType;
  severity: NotificationSeverity;
  title: string;
  message: string;
  incidentId: string | null;
  teamId: string | null;
  assignmentId: string | null;
  isRead: boolean;
  readAt: string | null;
  createdAt: string;
}

export interface NotificationQuery {
  page?: number;
  limit?: number;
  unreadOnly?: boolean;
  type?: NotificationType;
  isSimulated?: boolean;
}

export interface UnreadCountResponse {
  unreadCount: number;
}

export interface MarkAllResponse {
  success: boolean;
  updatedCount: number;
}

export const notifications = {
  list: (query: NotificationQuery = {}, signal?: AbortSignal) =>
    request<Paginated<NotificationItem>>(`/notifications${queryString(query)}`, { signal }),

  unreadCount: (isSimulated?: boolean, signal?: AbortSignal) => {
    const q = isSimulated !== undefined ? { isSimulated } : {};
    return request<UnreadCountResponse>(`/notifications/unread-count${queryString(q)}`, { signal });
  },

  markRead: (id: string) =>
    request<NotificationItem>(`/notifications/${encodeURIComponent(id)}/read`, {
      method: "PATCH",
    }),

  markAllRead: (isSimulated?: boolean) => {
    const q = isSimulated !== undefined ? { isSimulated } : {};
    return request<MarkAllResponse>(`/notifications/read-all${queryString(q)}`, {
      method: "PATCH",
    });
  },
};
