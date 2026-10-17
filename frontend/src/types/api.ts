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
  elderly?: number;
  children?: number;
  disabled?: number;
  medicalNeeds?: number;
}
export interface CreateIncidentInput {
  reporterName: string;
  reporterPhone?: string;
  emergencyType: EmergencyType;
  description: string;
  location?: IncidentLocation | null;
  peopleAffected: number;
  vulnerablePeople?: VulnerabilityIndicators;
  waterLevel?: "NONE" | "LOW" | "MODERATE" | "HIGH" | "UNKNOWN";
  immediateDanger?: boolean;
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
  priorityScore: number;
  priorityLevel: PriorityLevel;
  priorityReasons: string[];
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
