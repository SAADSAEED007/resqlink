"use client";
import type { Incident } from "@/types/api";
import { AlertTriangle, MapPin, ArrowUpRight } from "lucide-react";
const titles: Record<string, string> = {
  FLOOD: "Flooding",
  MEDICAL: "Medical emergency",
  FIRE: "Fire",
  STRANDED: "Stranded / evacuation",
  SUPPLIES: "Essential supplies",
  OTHER: "Other emergency",
};
export function PriorityIncidentQueue({
  incidents,
  selectedIncident,
  onSelectIncident,
  loading = false,
}: {
  incidents: Incident[];
  selectedIncident: Incident | null;
  onSelectIncident: (incident: Incident) => void;
  loading?: boolean;
}) {
  const sorted = [...incidents].sort(
    (a, b) => b.priorityScore - a.priorityScore,
  );
  return (
    <section className="rqCommandQueue rqCommandCard" aria-busy={loading}>
      <header>
        <h2>Priority Incident Queue</h2>
        <span>{sorted.length} reports</span>
      </header>
      <div className="rqCommandQueueList">
        {loading ? (
          <p className="rqCommandEmpty">Loading incidents...</p>
        ) : sorted.length === 0 ? (
          <p className="rqCommandEmpty">No incidents match current filter.</p>
        ) : (
          sorted.map((inc) => (
            <button
              key={inc._id}
              className={`rqCommandIncident ${selectedIncident?._id === inc._id ? "is-selected" : ""}`}
              onClick={() => onSelectIncident(inc)}
            >
              <div className="rqCommandIncidentTop">
                <span
                  className={`rqCommandSeverity ${inc.priorityLevel.toLowerCase()}`}
                >
                  {inc.priorityLevel}
                </span>
                <span>{inc.status.replaceAll("_", " ")}</span>
              </div>
              <h3>
                <AlertTriangle size={16} aria-hidden="true" />
                {titles[inc.emergencyType] || inc.emergencyType}
                <ArrowUpRight size={16} aria-hidden="true" />
              </h3>
              <p className="rqCommandIncidentDescription">{inc.description}</p>
              <p>
                <MapPin size={13} aria-hidden="true" />
                {inc.location?.address || "Location unverified"}
              </p>
              <div className="rqCommandIncidentMeta">
                <span>Priority score {inc.priorityScore}</span>
                <time dateTime={inc.createdAt}>
                  {new Date(inc.createdAt).toLocaleString(undefined, {
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </time>
              </div>
              <small>
                {inc.verification?.status.replaceAll("_", " ") ||
                  "Verification not recorded"}
                {inc.assignedTeam ? " / Team assigned" : ""}
              </small>
            </button>
          ))
        )}
      </div>
    </section>
  );
}
