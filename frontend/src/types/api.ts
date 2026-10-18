export type EmergencyType =
  | "FLOOD"
  | "MEDICAL"
  | "FIRE"
  | "STRANDED"
  | "SUPPLIES"
  | "OTHER";
export type PriorityLevel = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
export type ConfidenceLevel = "HIGH" | "MEDIUM" | "LOW";
export type IncidentStatus =
  | "PENDING"
  | "ASSIGNED"
  | "IN_PROGRESS"
  | "RESOLVED"
  | "CANCELLED";
export type TeamStatus = "AVAILABLE" | "BUSY" | "OFFLINE";
export type Capability =
  | "WATER_RESCUE"
  | "MEDICAL"
  | "EVACUATION"
  | "FIRE_RESPONSE"
  | "SUPPLY_DELIVERY";
export type AssignmentStatus = "ACTIVE" | "COMPLETED" | "CANCELLED";
export interface IncidentLocation {
  latitude: number;
  longitude: number;
  address?: string;
}
export interface VulnerabilityIndicators {
  elderly?: number | null;
  children?: number | null;
  disabled?: number | null;
  medicalNeeds?: number | null;
}
export interface CreateIncidentInput {
  reporterName?: string | null;
  reporterPhone?: string | null;
  emergencyType: EmergencyType;
  description?: string | null;
  location?: IncidentLocation | null;
  peopleAffected?: number | null;
  vulnerablePeople?: VulnerabilityIndicators | null;
  waterLevel?: ("NONE" | "LOW" | "MODERATE" | "HIGH" | "UNKNOWN") | null;
  immediateDanger?: boolean | null;
  safetyAnswer?: "YES" | "NO" | "UNSURE" | "UNANSWERED";
}
export type VerificationStatus =
  | "NEEDS_REVIEW"
  | "VERIFIED"
  | "FLAGGED_DUPLICATE"
  | "DISMISSED";
export interface VerificationDetails {
  status: VerificationStatus;
  requiresManualReview: boolean;
  isPotentialDuplicate: boolean;
  potentialDuplicateIncidents: string[];
  missingFields: string[];
  warnings: string[];
  reviewedBy?: string | null;
  reviewedAt?: string | null;
  reviewNotes?: string | null;
}
interface RecordFields {
  _id: string;
  createdAt: string;
  updatedAt: string;
  isSimulated: boolean;
  demoKey?: string;
}
export interface Incident extends CreateIncidentInput, RecordFields {
  location: IncidentLocation | null;
  locationVerificationRequired: boolean;
  verification?: VerificationDetails;
  priorityScore: number;
  priorityLevel: PriorityLevel;
  priorityReasons: string[];
  statusHistory?: { previousStatus: IncidentStatus; newStatus: IncidentStatus; timestamp: string; changedBy?: string | null }[];
  triage?: {
    safetyAnswer: "YES" | "NO" | "UNSURE" | "UNANSWERED";
    status: "NEEDS_ASSESSMENT" | "PRELIMINARY" | "COORDINATOR_REVIEWED";
    suggestedPriority: PriorityLevel | null;
    immediateDangerReported: boolean | null;
    reasons: { code: string; message: string }[];
    ruleVersion: string;
    reviewedAt?: string | null;
    reviewedBy?: string | null;
  };
  confidenceLevel: ConfidenceLevel;
  status: IncidentStatus;
  assignedTeam: string | null;
  priorityOverrides: {
    previousPriority: PriorityLevel;
    newPriority: PriorityLevel;
    previousScore: number;
    newScore: number;
    reason: string;
    coordinatorId: string;
    timestamp: string;
  }[];
}
export interface CreateTeamInput {
  name: string;
  teamCode: string;
  capabilities: Capability[];
  status?: "AVAILABLE" | "OFFLINE";
  location: IncidentLocation;
  capacity: number;
  contact?: { phone?: string; email?: string; leadName?: string };
}
export interface RescueTeam
  extends Omit<CreateTeamInput, "status">,
    RecordFields {
  status: TeamStatus;
  currentIncident: string | null;
}
export interface Assignment extends RecordFields {
  incidentId: string;
  teamId: string;
  assignedAt: string;
  completedAt: string | null;
  status: AssignmentStatus;
  notes?: string;
}
export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}
export interface Paginated<T> {
  items: T[];
  pagination: Pagination;
}
export interface Recommendations {
  manualSelectionRequired: boolean;
  distanceType: "APPROXIMATE_STRAIGHT_LINE_KM";
  message: string;
  items: {
    team: RescueTeam;
    approximateDistanceKm: number;
    capacityWarning: string | null;
  }[];
}
export interface SessionUser {
  _id: string;
  name: string;
  email: string;
  role: "admin" | "user";
}
export interface ApiErrorResponse {
  success: false;
  statusCode: number;
  message: string;
  errors?: unknown[];
}
export interface ApiResponse<T> {
  success: true;
  statusCode: number;
  message: string;
  data: T;
}
