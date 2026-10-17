import type {
  Assignment,
  Incident,
  RescueTeam,
  IncidentLocation,
} from "@/types/api";

export type AssignmentRecord = Omit<Assignment, "incidentId" | "teamId"> & {
  incidentId:
    | string
    | Pick<
        Incident,
        | "_id"
        | "emergencyType"
        | "priorityLevel"
        | "status"
        | "location"
        | "peopleAffected"
        | "createdAt"
      >
    | null;
  teamId:
    | string
    | Pick<
        RescueTeam,
        | "_id"
        | "name"
        | "teamCode"
        | "capabilities"
        | "status"
        | "capacity"
        | "location"
      >
    | null;
};
export const incidentNames = {
  FLOOD: "Flooding",
  FIRE: "Fire emergency",
  MEDICAL: "Medical emergency",
  STRANDED: "Stranded / rescue needed",
  SUPPLIES: "Essential supplies",
  OTHER: "Other emergency",
};
export function recordId(record: string | { _id: string } | null) {
  return typeof record === "string" ? record : record?._id;
}
export function teamName(record: AssignmentRecord) {
  return typeof record.teamId === "object" && record.teamId
    ? record.teamId.name
    : "Team record unavailable";
}
export function incidentName(record: AssignmentRecord) {
  return typeof record.incidentId === "object" && record.incidentId
    ? incidentNames[record.incidentId.emergencyType]
    : "Incident record unavailable";
}
export function coordinates(
  location: IncidentLocation | null | undefined,
): location is IncidentLocation {
  return (
    !!location &&
    Number.isFinite(location.latitude) &&
    Number.isFinite(location.longitude) &&
    Math.abs(location.latitude) <= 90 &&
    Math.abs(location.longitude) <= 180
  );
}
export function timestamp(value: string | null) {
  return value
    ? new Date(value).toLocaleString("en-GB", {
        timeZone: "Asia/Karachi",
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "Not recorded";
}
export function todayRange(now = new Date()) {
  const shifted = new Date(now.getTime() + 5 * 3600000);
  const start =
    Date.UTC(
      shifted.getUTCFullYear(),
      shifted.getUTCMonth(),
      shifted.getUTCDate(),
    ) -
    5 * 3600000;
  return {
    completedFrom: new Date(start).toISOString(),
    completedBefore: new Date(start + 86400000).toISOString(),
  };
}
