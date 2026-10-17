import { request, queryString } from "./client";
import type { Assignment, AssignmentStatus, Paginated } from "@/types/api";
export const assignments = {
  get: <T = Assignment>(id: string, signal?: AbortSignal) =>
    request<T>(`/assignments/${encodeURIComponent(id)}`, { signal }),
  list: <T = Assignment>(
    query: { page?: number; limit?: number; status?: AssignmentStatus; teamId?: string; incidentId?: string; isSimulated?: boolean; completedFrom?: string; completedBefore?: string; sort?: 'assigned' | 'completed' } = {},
    signal?: AbortSignal,
  ) =>
    request<Paginated<T>>(`/assignments${queryString(query)}`, {
      signal,
    }),
  create: (body: { incidentId: string; teamId: string; notes?: string }) =>
    request<Assignment>("/assignments", { method: "POST", body }),
};
