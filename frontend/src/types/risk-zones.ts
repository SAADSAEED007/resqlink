import type { Paginated } from "./api";
export const hazardTypes = [
  "FLOOD_INUNDATION",
  "FLASH_FLOOD",
  "RIVER_BREACH",
  "HEATWAVE",
  "WATER_SHORTAGE",
  "OTHER",
] as const;
export const hazardSeverities = [
  "CRITICAL",
  "HIGH",
  "MODERATE",
  "LOW",
] as const;
export const connectivityStatuses = [
  "NO_CELL_COVERAGE",
  "INTERMITTENT_SIGNAL",
  "NORMAL_NETWORK",
  "UNKNOWN",
] as const;
export const assessmentStatuses = [
  "PENDING_ASSESSMENT",
  "ASSESSMENT_DISPATCHED",
  "ASSESSMENT_COMPLETED",
  "MONITORING_ONLY",
  "INACTIVE",
] as const;
export const assessmentUrgencies = ["CRITICAL", "URGENT", "ROUTINE"] as const;
export type AssessmentStatus = (typeof assessmentStatuses)[number];
export interface RiskZoneInput {
  communityName: string;
  district: string;
  tehsil?: string;
  approximateLocation: {
    latitude?: number | null;
    longitude?: number | null;
    landmarkDescription: string;
    isLocationEstimated?: boolean;
  };
  hazardType: (typeof hazardTypes)[number];
  hazardSeverity: (typeof hazardSeverities)[number];
  connectivityStatus: (typeof connectivityStatuses)[number];
  informationConfidence: "HIGH" | "MEDIUM" | "LOW";
  confidenceReasons?: string[];
  accessObstacles?: string[];
  notes?: string;
  vulnerablePopulation?: {
    estimatedTotalPopulation?: number | null;
    estimatedVulnerableCount?: number | null;
    vulnerabilityDetails?: string | null;
  };
}
export interface RiskZone extends RiskZoneInput {
  _id: string;
  assessmentStatus: AssessmentStatus;
  isSimulated: boolean;
  createdAt: string;
  updatedAt: string;
  fieldAssessment?: {
    priorityUrgency: (typeof assessmentUrgencies)[number];
    assignedOfficer?: string | null;
    assessmentNotes: string;
    requestedAt: string;
    completedAt?: string | null;
    requestedBy: string;
  } | null;
  statusHistory: {
    previousStatus: AssessmentStatus;
    newStatus: AssessmentStatus;
    notes: string;
    changedBy: string;
    changedAt: string;
  }[];
}
export interface RiskZoneQuery {
  page?: number;
  limit?: number;
  district?: string;
  hazardSeverity?: RiskZoneInput["hazardSeverity"];
  assessmentStatus?: AssessmentStatus;
  connectivityStatus?: RiskZoneInput["connectivityStatus"];
  sort?: "severity" | "oldest" | "newest";
}
export type RiskZonePage = Paginated<RiskZone>;
