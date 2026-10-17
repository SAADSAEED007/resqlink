import { Ambulance, Flame, Package, Search, Ship, Truck } from "lucide-react";
import type { Capability, RescueTeam, IncidentLocation } from "@/types/api";
export const capabilities: Record<Capability, string> = { WATER_RESCUE: "Water Rescue", MEDICAL: "Medical Response", EVACUATION: "Evacuation", FIRE_RESPONSE: "Fire Response", SUPPLY_DELIVERY: "Supply Delivery" };
export const statusText = { AVAILABLE: "Available", BUSY: "On Mission", OFFLINE: "Offline" };
export function validCoordinates(location?: IncidentLocation | null): location is IncidentLocation {
  return !!location && Number.isFinite(location.latitude) && Number.isFinite(location.longitude) && Math.abs(location.latitude) <= 90 && Math.abs(location.longitude) <= 180;
}
export function referenceId(value: unknown): string {
  return typeof value === "string" ? value : value && typeof value === "object" && "_id" in value && typeof value._id === "string" ? value._id : "";
}
export function TeamIllustration({ team }: { team: RescueTeam }) {
  const caps = Array.isArray(team.capabilities) ? team.capabilities : [];
  const Icon = caps.includes("WATER_RESCUE") ? Ship : caps.includes("MEDICAL") ? Ambulance : caps.includes("FIRE_RESPONSE") ? Flame : caps.includes("SUPPLY_DELIVERY") ? Package : caps.includes("EVACUATION") ? Search : Truck;
  return <span className={`rtTeamIllustration rtVisual-${caps[0] || "general"}`} aria-label="Team capability illustration"><Icon size={30} strokeWidth={1.6}/></span>;
}
export function TeamStatus({ team }: { team: RescueTeam }) { return <span className={`rtStatus status-${team.status}`}>{statusText[team.status] || "Unknown"}</span>; }
export function capabilityLabels(team: RescueTeam) { return Array.isArray(team.capabilities) ? team.capabilities.map(cap => capabilities[cap] || cap).join(" · ") : "Capabilities not provided"; }
export function teamDate(value?: string | null) { return value && Number.isFinite(new Date(value).getTime()) ? new Intl.DateTimeFormat("en-PK", { timeZone: "Asia/Karachi", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(value)) : "Time not recorded"; }
