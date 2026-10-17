import {
  hazardTypes,
  hazardSeverities,
  connectivityStatuses,
  type RiskZoneInput,
} from "@/types/risk-zones";
export interface ZoneDraft {
  communityName: string;
  district: string;
  tehsil: string;
  landmark: string;
  latitude: string;
  longitude: string;
  hazardType: string;
  hazardSeverity: string;
  connectivity: string;
  confidence: string;
  notes: string;
  population: string;
  vulnerable: string;
  obstacles: string;
  confidenceReasons: string;
}
export const emptyZone: ZoneDraft = {
  communityName: "",
  district: "",
  tehsil: "",
  landmark: "",
  latitude: "",
  longitude: "",
  hazardType: "",
  hazardSeverity: "",
  connectivity: "UNKNOWN",
  confidence: "",
  notes: "",
  population: "",
  vulnerable: "",
  obstacles: "",
  confidenceReasons: "",
};
export function text(value: string, min: number, max: number, label: string) {
  const clean = value.trim().replace(/\s+/g, " ");
  if (
    clean.length < min ||
    clean.length > max ||
    /[<>\u0000-\u001f]/.test(clean)
  )
    throw new Error(
      `${label}: use ${min} to ${max} characters without angle brackets or control characters.`,
    );
  return clean;
}
export function zoneInput(draft: ZoneDraft): RiskZoneInput {
  if (
    !hazardTypes.includes(draft.hazardType as RiskZoneInput["hazardType"]) ||
    !hazardSeverities.includes(
      draft.hazardSeverity as RiskZoneInput["hazardSeverity"],
    ) ||
    !connectivityStatuses.includes(
      draft.connectivity as RiskZoneInput["connectivityStatus"],
    ) ||
    !["HIGH", "MEDIUM", "LOW"].includes(draft.confidence)
  )
    throw new Error("Select hazard type, severity and information confidence.");
  const hasPoint = !!(draft.latitude.trim() || draft.longitude.trim());
  const latitude = Number(draft.latitude),
    longitude = Number(draft.longitude);
  if (
    hasPoint &&
    (!draft.latitude.trim() ||
      !draft.longitude.trim() ||
      !Number.isFinite(latitude) ||
      !Number.isFinite(longitude) ||
      Math.abs(latitude) > 90 ||
      Math.abs(longitude) > 180)
  )
    throw new Error(
      "Enter both valid coordinates, or leave both blank for a landmark-only location.",
    );
  function count(value: string) {
    if (!value.trim()) return undefined;
    const n = Number(value);
    if (!Number.isInteger(n) || n < 0 || n > 1000000)
      throw new Error(
        "Population estimates must be whole numbers from 0 to 1,000,000, or blank if unknown.",
      );
    return n;
  }
  const population = count(draft.population),
    vulnerable = count(draft.vulnerable);
  const list = (value: string, max: number) => {
    const items = value
      .split(";")
      .map((s) => s.trim())
      .filter(Boolean);
    if (items.length > 10)
      throw new Error("Use up to ten list items separated by semicolons.");
    return items.map((item) => text(item, 1, max, "List item"));
  };
  return {
    communityName: text(draft.communityName, 2, 150, "Community name"),
    district: text(draft.district, 2, 100, "District"),
    ...(draft.tehsil.trim()
      ? { tehsil: text(draft.tehsil, 1, 100, "Tehsil") }
      : {}),
    approximateLocation: {
      landmarkDescription: text(draft.landmark, 3, 400, "Landmark"),
      isLocationEstimated: true,
      ...(hasPoint ? { latitude, longitude } : {}),
    },
    hazardType: draft.hazardType as RiskZoneInput["hazardType"],
    hazardSeverity: draft.hazardSeverity as RiskZoneInput["hazardSeverity"],
    connectivityStatus:
      draft.connectivity as RiskZoneInput["connectivityStatus"],
    informationConfidence:
      draft.confidence as RiskZoneInput["informationConfidence"],
    ...(population !== undefined || vulnerable !== undefined
      ? {
          vulnerablePopulation: {
            ...(population !== undefined
              ? { estimatedTotalPopulation: population }
              : {}),
            ...(vulnerable !== undefined
              ? { estimatedVulnerableCount: vulnerable }
              : {}),
          },
        }
      : {}),
    ...(draft.notes.trim()
      ? { notes: text(draft.notes, 1, 1000, "Notes") }
      : {}),
    ...(draft.obstacles.trim()
      ? { accessObstacles: list(draft.obstacles, 100) }
      : {}),
    ...(draft.confidenceReasons.trim()
      ? { confidenceReasons: list(draft.confidenceReasons, 200) }
      : {}),
  };
}
