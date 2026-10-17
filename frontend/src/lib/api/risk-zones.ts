import { ApiError, request, queryString } from "./client";
import type {
  RiskZone,
  RiskZoneInput,
  RiskZoneQuery,
  RiskZonePage,
  AssessmentStatus,
  assessmentUrgencies,
} from "@/types/risk-zones";
function checkedZone(zone: RiskZone): RiskZone {
  if (
    !zone ||
    typeof zone._id !== "string" ||
    !/^[a-f0-9]{24}$/i.test(zone._id) ||
    typeof zone.communityName !== "string" ||
    typeof zone.district !== "string" ||
    !zone.approximateLocation ||
    typeof zone.approximateLocation.landmarkDescription !== "string" ||
    typeof zone.assessmentStatus !== "string" ||
    !Array.isArray(zone.statusHistory)
  )
    throw new ApiError(
      "The server returned incomplete risk-zone details.",
      0,
      "protocol",
    );
  return zone;
}
const path = "/community-risk-zones";
export const riskZones = {
  list: (query: RiskZoneQuery = {}, signal?: AbortSignal) =>
    request<RiskZonePage>(`${path}${queryString(query)}`, { signal }).then(
      (page) => {
        if (!page || !Array.isArray(page.items) || !page.pagination)
          throw new ApiError(
            "The server returned an invalid risk-zone list.",
            0,
            "protocol",
          );
        page.items.forEach(checkedZone);
        return page;
      },
    ),
  get: (id: string, signal?: AbortSignal) =>
    request<RiskZone>(`${path}/${encodeURIComponent(id)}`, { signal }).then(
      checkedZone,
    ),
  create: (body: RiskZoneInput) =>
    request<RiskZone>(path, { method: "POST", body }).then(checkedZone),
  requestAssessment: (
    id: string,
    body: {
      priorityUrgency: (typeof assessmentUrgencies)[number];
      assignedOfficer?: string;
      assessmentNotes: string;
    },
  ) =>
    request<RiskZone>(`${path}/${encodeURIComponent(id)}/assessment`, {
      method: "POST",
      body,
    }).then(checkedZone),
  updateStatus: (id: string, status: AssessmentStatus, notes: string) =>
    request<RiskZone>(`${path}/${encodeURIComponent(id)}/status`, {
      method: "PATCH",
      body: { status, notes },
    }).then(checkedZone),
};
