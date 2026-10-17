import { request, queryString } from "./client";
import type { Assignment, AssignmentStatus, Paginated } from "@/types/api";
export const assignments = {
  list: <T = Assignment>(
    query: { page?: number; limit?: number; status?: AssignmentStatus; teamId?: string; incidentId?: string; isSimulated?: boolean } = {},
    signal?: AbortSignal,
  ) =>
    request<Paginated<T>>(`/assignments${queryString(query)}`, {
      signal,
    }),
  create: (body: { incidentId: string; teamId: string; notes?: string }) =>
    request<Assignment>("/assignments", { method: "POST", body }),
};
