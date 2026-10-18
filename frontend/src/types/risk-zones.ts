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
  assessments?: NonNullable<RiskZone["fieldAssessment"]>[];
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
  search?: string;
  isSimulated?: boolean;
  sort?: "severity" | "oldest" | "newest";
}
export type RiskZonePage = Paginated<RiskZone>;

export interface CommunityWeather {
  provider: string;
  latitude: number;
  longitude: number;
  timezone: string;
  retrievedAt: string;
  freshness: "fresh" | "cached" | "stale";
  current: {
    time: string;
    temperatureC: number;
    weatherCode: number;
    windKmh: number;
    condition?: string;
    providerConditionCode?: number;
    feelsLikeC?: number;
    humidityPercent?: number;
    gustKmh?: number;
    precipitationMm?: number;
  };
  next24Hours: {
    start: string;
    end: string;
    precipitationMm: number;
    maxProbabilityPercent: number;
    hourlyPeriods: number;
    maxWindKmh?: number;
    maxGustKmh?: number;
    peakHourlyPrecipitationMm?: number;
  };
  hourly?: {
    time: string;
    precipitationMm: number;
    probabilityPercent: number;
    windKmh: number;
  }[];
  days: {
    time: string;
    weatherCode: number;
    maxC: number;
    minC: number;
    precipitationMm: number;
    probabilityPercent: number;
  }[];
  limitations?: string[];
}
export type AttentionLevel =
  | "ROUTINE"
  | "ELEVATED"
  | "URGENT_REVIEW"
  | "DATA_UNAVAILABLE";
export interface MonitoredDistrict {
  id: string;
  name: string;
  monitoringLocation: string;
  latitude: number;
  longitude: number;
  coordinateSource: string;
  districtNameSource: string;
  datasetVersion: string;
  limitation: string;
  weather?: CommunityWeather | null;
  attention?: {
    level: AttentionLevel;
    reasonCode: string;
    reasons: string[];
    missingEvidence?: string[];
    limitations?: string[];
    policy: {
      version: string;
      elevatedRainMm: number;
      urgentRainMm: number;
      disclaimer: string;
    };
  };
  providerState?: string;
  error?: string;
  aiConfigured?: boolean;
  model?: string;
}
export interface MonitoringOverview {
  provider?: {
    provider?: string;
    configured?: boolean;
    state: "READY" | "COOLDOWN";
    reason: "RATE_LIMITED" | "UNAVAILABLE" | null;
    retryAt: string | null;
    cacheTtlSeconds: number;
  };
  items: MonitoredDistrict[];
  datasetVersion: string;
  coverage: string;
  retrievedAt: string;
  unavailable: number;
}
export interface CommunityAnalysis {
  assessmentHeadline: string;
  attentionLevel: string;
  recommendedDecision: string;
  decisionLabel: string;
  decisionReason: string;
  evidenceSummary: string;
  reassessmentTriggers: string[];
  summary: string;
  reviewLevel: string;
  keyInsights: {
    title: string;
    explanation: string;
    evidenceReferences: string[];
  }[];
  preparednessActions: { action: string; reason: string; priority: string }[];
  missingInformation: string[];
  limitations: string[];
  provider: string;
  model: string;
  generatedAt: string;
  weatherRetrievedAt: string | null;
  evidenceFingerprint: string;
  sessionOnly: boolean;
  disclaimer: string;
  evidence?: { id: string; text: string }[];
}
export type PreparednessAction =
  | "CONTINUE_MONITORING"
  | "REQUEST_FIELD_ASSESSMENT"
  | "REVIEW_RESOURCES"
  | "ESCALATE_REVIEW";
export interface PreparednessDecision {
  _id: string;
  districtId: string;
  coordinatorId: string;
  action: PreparednessAction;
  notes: string;
  status: "RECORDED";
  createdAt: string;
  weatherEvidence: {
    provider: string | null;
    retrievedAt: string | null;
    attention: AttentionLevel;
    freshness: string;
  };
}
export interface NearbyShelter {
  _id: string;
  name: string;
  address: string;
  location: { latitude: number; longitude: number };
  status: string;
  totalCapacity: number;
  currentOccupancy: number;
  availableSpaces: number;
  approximateDistanceKm?: number;
  isSimulated: boolean;
}
