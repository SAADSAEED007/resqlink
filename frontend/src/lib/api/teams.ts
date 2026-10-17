import { request, queryString } from "./client";
import type {
  CreateTeamInput,
  Paginated,
  RescueTeam,
  TeamStatus,
  Capability,
} from "@/types/api";
export const teams = {
  list: (
    query: { page?: number; limit?: number; status?: TeamStatus; capability?: Capability; search?: string; isSimulated?: boolean } = {},
    signal?: AbortSignal,
  ) =>
    request<Paginated<RescueTeam>>(`/rescue-teams${queryString(query)}`, {
      signal,
    }),
  get: (id: string, signal?: AbortSignal) =>
    request<RescueTeam>(`/rescue-teams/${encodeURIComponent(id)}`, { signal }),
  create: (body: CreateTeamInput) =>
    request<RescueTeam>("/rescue-teams", { method: "POST", body }),
  update: (id: string, body: Partial<Omit<CreateTeamInput, "teamCode">>) =>
    request<RescueTeam>(`/rescue-teams/${encodeURIComponent(id)}`, { method: "PATCH", body }),
};
