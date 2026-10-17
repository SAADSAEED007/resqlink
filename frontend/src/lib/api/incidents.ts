import { request, queryString } from "./client";
import type {
  CreateIncidentInput,
  Incident,
  IncidentStatus,
  Paginated,
  PriorityLevel,
  Recommendations,
  VerificationStatus,
} from "@/types/api";
export interface IncidentQuery {
  unassigned?: boolean;
  isSimulated?: boolean;
  search?: string;
  emergencyType?: import('@/types/api').EmergencyType;
  page?: number;
  limit?: number;
  status?: IncidentStatus;
  priorityLevel?: PriorityLevel;
  verificationStatus?: VerificationStatus;
  sort?: "priority" | "oldest" | "newest";
}
export const incidents = {
  create: (body: CreateIncidentInput, signal?: AbortSignal) =>
    request<Incident>("/incidents", {
      method: "POST",
      body,
      signal,
      protected: false,
    }),
  list: (query: IncidentQuery = {}, signal?: AbortSignal) =>
    request<Paginated<Incident>>(`/incidents${queryString(query)}`, { signal }),
  get: (id: string, signal?: AbortSignal) =>
    request<Incident>(`/incidents/${encodeURIComponent(id)}`, { signal }),
  updateStatus: (id: string, status: IncidentStatus) =>
    request<Incident>(`/incidents/${encodeURIComponent(id)}/status`, {
      method: "PATCH",
      body: { status },
    }),
  overridePriority: (
    id: string,
    priorityLevel: PriorityLevel,
    reason: string,
  ) =>
    request<Incident>(`/incidents/${encodeURIComponent(id)}/priority`, {
      method: "PATCH",
      body: { priorityLevel, reason },
    }),
  updateVerification: (
    id: string,
    status: VerificationStatus,
    notes: string,
  ) =>
    request<Incident>(`/incidents/${encodeURIComponent(id)}/verification`, {
      method: "PATCH",
      body: { status, notes },
    }),
  recommendations: (id: string, signal?: AbortSignal) =>
    request<Recommendations>(
      `/incidents/${encodeURIComponent(id)}/recommendations`,
      { signal },
    ),
};
