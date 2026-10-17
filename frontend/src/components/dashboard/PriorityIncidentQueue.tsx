"use client";
import type { Incident } from "@/types/api";
import { MapPin, ArrowUpRight, Clock3 } from "lucide-react";
import { IncidentVisual, incidentTitle } from "./incident-visual";
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
              <div className="rqCommandIncidentBody">
                <IncidentVisual incident={inc} />
                <div className="rqCommandIncidentContent">
                  <div className="rqCommandIncidentTop">
                    <span
                      className={`rqCommandSeverity ${inc.priorityLevel.toLowerCase()}`}
                    >
                      {inc.priorityLevel}
                    </span>
                    <span>{inc.status.replaceAll("_", " ")}</span>
                  </div>
                  <h3>
                    {incidentTitle(inc)}
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
                      <Clock3 size={12} aria-hidden="true" />
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
                </div>
              </div>
            </button>
          ))
        )}
      </div>
    </section>
  );
}
