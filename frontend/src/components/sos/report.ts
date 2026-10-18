import type {
  CreateIncidentInput,
  EmergencyType,
  IncidentLocation,
} from "@/types/api";
export const emergencyChoices: { value: EmergencyType; label: string }[] = [
  { value: "FLOOD", label: "Flooding" },
  { value: "MEDICAL", label: "Medical emergency" },
  { value: "FIRE", label: "Fire" },
  { value: "STRANDED", label: "Stranded / evacuation" },
  { value: "SUPPLIES", label: "Essential supplies" },
  { value: "OTHER", label: "Other emergency" },
];
export type LocationChoice = "unset" | "manual" | "map" | "gps" | "unknown";
export interface SOSDraft {
  locationChoice: LocationChoice;
  area: string;
  latitude: string;
  longitude: string;
  reporterName: string;
  reporterPhone: string;
  reportingFor: "myself" | "someone-else";
  emergencyType: EmergencyType | "";
  description: string;
  notes: string;
  peopleAffected: string;
  immediateDanger: "unknown" | "yes" | "no";
  safetyAnswer: "YES" | "NO" | "UNSURE" | "UNANSWERED";
  safetyEmergencyType: EmergencyType | "";
  waterLevel: "UNKNOWN" | "NONE" | "LOW" | "MODERATE" | "HIGH";
  elderly: string;
  children: string;
  disabled: string;
  medicalNeeds: string;
}
export const emptyDraft: SOSDraft = {
  locationChoice: "unset",
  area: "",
  latitude: "",
  longitude: "",
  reporterName: "",
  reporterPhone: "",
  reportingFor: "myself",
  emergencyType: "",
  description: "",
  notes: "",
  peopleAffected: "",
  immediateDanger: "unknown",
  safetyAnswer: "UNANSWERED",
  safetyEmergencyType: "",
  waterLevel: "UNKNOWN",
  elderly: "",
  children: "",
  disabled: "",
  medicalNeeds: "",
};
export type DraftErrors = Partial<Record<keyof SOSDraft, string>>;
export const cleanText = (value: string) => value.trim().replace(/\s+/g, " ");
const unsafeText = (value: string) =>
  /[<>\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value);
const integer = (value: string, min: number) =>
  value.trim() !== "" &&
  Number.isInteger(Number(value)) &&
  Number(value) >= min &&
  Number(value) <= 10000;
export function selectedLocation(draft: SOSDraft): IncidentLocation | null {
  if (!draft.latitude.trim() || !draft.longitude.trim()) return null;
  const latitude = Number(draft.latitude);
  const longitude = Number(draft.longitude);
  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    Math.abs(latitude) > 90 ||
    Math.abs(longitude) > 180
  )
    return null;
  return {
    latitude,
    longitude,
    ...(cleanText(draft.area) ? { address: cleanText(draft.area) } : {}),
  };
}
export function reportDescription(draft: SOSDraft) {
  return [
    draft.reportingFor === "someone-else"
      ? "Reporting on behalf of someone else."
      : "",
    draft.area.trim() && !selectedLocation(draft)
      ? `Reported location (coordinates unverified): ${cleanText(draft.area)}.`
      : "",
    cleanText(draft.description),
    draft.notes.trim() ? `Additional notes: ${cleanText(draft.notes)}` : "",
  ]
    .filter(Boolean)
    .join(" ");
}
export function validateLocation(draft: SOSDraft): DraftErrors {
  const errors: DraftErrors = {};
  if (draft.area.length > 300 || unsafeText(draft.area))
    errors.area =
      "Use up to 300 characters, without angle brackets or control characters.";
  const hasCoordinates = !!(draft.latitude.trim() || draft.longitude.trim());
  if (hasCoordinates) {
    if (
      !draft.latitude.trim() ||
      !Number.isFinite(Number(draft.latitude)) ||
      Math.abs(Number(draft.latitude)) > 90
    )
      errors.latitude = "Enter a latitude between -90 and 90.";
    if (
      !draft.longitude.trim() ||
      !Number.isFinite(Number(draft.longitude)) ||
      Math.abs(Number(draft.longitude)) > 180
    )
      errors.longitude = "Enter a longitude between -180 and 180.";
  } else if (draft.locationChoice === "manual" && !draft.area.trim())
    errors.area = "Enter an area, address, or nearby landmark.";
  else if (draft.locationChoice !== "unknown" && !draft.area.trim())
    errors.locationChoice =
      "Select a point, enter an address, or explicitly mark the location as unknown.";
  return errors;
}
export function validateDetails(draft: SOSDraft): DraftErrors {
  const errors: DraftErrors = {};
  if (draft.reporterName.trim() && (cleanText(draft.reporterName).length < 2 || cleanText(draft.reporterName).length > 100 || unsafeText(draft.reporterName)))
    errors.reporterName =
      "Enter your name using 2 to 100 characters, without angle brackets.";
  if (!emergencyChoices.some((item) => item.value === draft.emergencyType))
    errors.emergencyType = "Choose the type of emergency.";
  if (draft.description.trim() && (cleanText(draft.description).length < 1 || unsafeText(draft.description)))
    errors.description =
      "Describe what happened in at least 5 characters, without angle brackets.";
  if (unsafeText(draft.notes) || reportDescription(draft).length > 2000)
    errors.description =
      "Keep the combined report, location description, and notes within 2,000 characters and avoid angle brackets.";
  if (draft.peopleAffected.trim() && !integer(draft.peopleAffected, 1))
    errors.peopleAffected =
      "Enter an estimate from 1 to 10,000. A positive number is required to record a report.";
  if (
    draft.reporterPhone.trim() &&
    !/^[+\d ()-]{5,32}$/.test(draft.reporterPhone.trim())
  )
    errors.reporterPhone =
      "Use 5 to 32 phone characters: numbers, spaces, +, parentheses, or hyphens.";
  for (const key of [
    "elderly",
    "children",
    "disabled",
    "medicalNeeds",
  ] as const)
    if (draft[key].trim() && !integer(draft[key], 0))
      errors[key] = "Enter a whole number from 0 to 10,000, or leave unknown.";
  return errors;
}
export function toIncidentInput(draft: SOSDraft): CreateIncidentInput {
  const vulnerablePeople: NonNullable<CreateIncidentInput["vulnerablePeople"]> =
    {};
  for (const key of [
    "elderly",
    "children",
    "disabled",
    "medicalNeeds",
  ] as const)
    if (draft[key].trim()) vulnerablePeople[key] = Number(draft[key]);
  return {
    ...(draft.reporterName.trim() ? { reporterName: cleanText(draft.reporterName) } : {}),
    ...(draft.reporterPhone.trim()
      ? { reporterPhone: draft.reporterPhone.trim() }
      : {}),
    emergencyType: draft.emergencyType as EmergencyType,
    ...(reportDescription(draft) ? { description: reportDescription(draft) } : {}),
    location: selectedLocation(draft),
    ...(draft.peopleAffected.trim() ? { peopleAffected: Number(draft.peopleAffected) } : {}),
    ...(Object.keys(vulnerablePeople).length ? { vulnerablePeople } : {}),
    waterLevel: draft.waterLevel,
    safetyAnswer: draft.safetyEmergencyType === draft.emergencyType ? draft.safetyAnswer : draft.immediateDanger === "yes" ? "YES" : draft.immediateDanger === "no" ? "NO" : "UNANSWERED",
    ...((draft.safetyEmergencyType === draft.emergencyType && draft.safetyAnswer === "YES") || draft.immediateDanger === "yes" ? { immediateDanger: true } : (draft.safetyEmergencyType === draft.emergencyType && draft.safetyAnswer === "NO") || draft.immediateDanger === "no" ? { immediateDanger: false } : {}),
  };
}
export function locationSummary(draft: SOSDraft) {
  const point = selectedLocation(draft);
  return point
    ? `${draft.area.trim() ? cleanText(draft.area) + " / " : ""}${point.latitude.toFixed(5)}, ${point.longitude.toFixed(5)}`
    : draft.area.trim()
      ? `${cleanText(draft.area)} (coordinates unknown)`
      : "Location unknown - coordinator review needed";
}
