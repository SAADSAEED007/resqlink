import Image from "next/image";
import {
  AlertTriangle,
  Cross,
  Droplets,
  Flame,
  HeartPulse,
  Package,
  type LucideIcon,
} from "lucide-react";
import type { Incident } from "@/types/api";

const demoImages: Partial<Record<Incident["emergencyType"], string>> = {
  FLOOD: "/images/incidents/urban-flooding.jpg",
  STRANDED: "/images/incidents/building-collapse.jpg",
  OTHER: "/images/incidents/fallen-tree.jpg",
  SUPPLIES: "/images/incidents/water-logging.jpg",
};

const iconByEmergency: Record<string, LucideIcon> = {
  FLOOD: Droplets,
  MEDICAL: HeartPulse,
  FIRE: Flame,
  STRANDED: Cross,
  SUPPLIES: Package,
  OTHER: AlertTriangle,
};

export function incidentTitle(incident: Incident) {
  const titles: Record<string, string> = {
    FLOOD: "Flooding",
    MEDICAL: "Medical emergency",
    FIRE: "Fire",
    STRANDED: "Stranded / evacuation",
    SUPPLIES: "Essential supplies",
    OTHER: "Other emergency",
  };
  return titles[incident.emergencyType] || incident.emergencyType;
}

export function IncidentVisual({
  incident,
  variant = "card",
}: {
  incident: Incident;
  variant?: "card" | "hero";
}) {
  const image = incident.isSimulated ? demoImages[incident.emergencyType] : undefined;
  const Icon = iconByEmergency[incident.emergencyType] || AlertTriangle;

  if (image) {
    return (
      <div className={`rqIncidentVisual rqIncidentVisual-${variant} is-demo`}>
        <Image
          src={image}
          alt="Illustrative emergency image for this simulated report"
          fill
          sizes={variant === "hero" ? "(max-width: 600px) 100vw, 600px" : "64px"}
          className="object-cover"
        />
        <span>Illustrative demo image</span>
      </div>
    );
  }

  return (
    <div
      className={`rqIncidentVisual rqIncidentVisual-${variant} rqIncidentVisual-${incident.emergencyType.toLowerCase()}`}
      aria-label={`${incidentTitle(incident)} category`}
    >
      <Icon aria-hidden="true" />
      <span>{incidentTitle(incident)}</span>
    </div>
  );
}
