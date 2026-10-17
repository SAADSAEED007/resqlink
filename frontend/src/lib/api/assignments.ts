import { request, queryString } from "./client";
import type { Assignment, AssignmentStatus, Paginated } from "@/types/api";
export const assignments = {
  list: (
    query: { page?: number; limit?: number; status?: AssignmentStatus } = {},
    signal?: AbortSignal,
  ) =>
    request<Paginated<Assignment>>(`/assignments${queryString(query)}`, {
      signal,
    }),
  create: (body: { incidentId: string; teamId: string; notes?: string }) =>
    request<Assignment>("/assignments", { method: "POST", body }),
};
