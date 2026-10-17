import type { ReactNode } from "react";
import type {
  AssignmentStatus,
  IncidentStatus,
  PriorityLevel,
  TeamStatus,
} from "@/types/api";
export type BadgeTone = "neutral" | "info" | "success" | "warning" | "critical";
export function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: BadgeTone;
}) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}
const priorities: Record<PriorityLevel, BadgeTone> = {
  CRITICAL: "critical",
  HIGH: "warning",
  MEDIUM: "info",
  LOW: "neutral",
};
export function PriorityBadge({ priority }: { priority: PriorityLevel }) {
  return (
    <Badge tone={priorities[priority]}>
      {priority.charAt(0) + priority.slice(1).toLowerCase()} priority
    </Badge>
  );
}
const tones: Record<IncidentStatus | TeamStatus | AssignmentStatus, BadgeTone> =
  {
    PENDING: "warning",
    ASSIGNED: "info",
    IN_PROGRESS: "info",
    RESOLVED: "success",
    CANCELLED: "neutral",
    AVAILABLE: "success",
    BUSY: "warning",
    OFFLINE: "neutral",
    ACTIVE: "info",
    COMPLETED: "success",
  };
export function StatusBadge({ status }: { status: keyof typeof tones }) {
  return (
    <Badge tone={tones[status]}>
      {status.charAt(0) + status.slice(1).toLowerCase().replaceAll("_", " ")}
    </Badge>
  );
}
