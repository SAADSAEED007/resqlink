"use client";

import type { Incident } from "@/types/api";
import { MapPin, ArrowUpRight, Clock3 } from "lucide-react";
import { IncidentVisual, incidentTitle } from "./incident-visual";
import {
  getIncidentLocationInfo,
  formatIncidentTime,
} from "./incident-location-utils";

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
  const triageRank = (incident: Incident) =>
    incident.triage?.safetyAnswer === "YES" &&
    incident.triage.status !== "COORDINATOR_REVIEWED"
      ? 2
      : incident.triage?.status === "NEEDS_ASSESSMENT"
        ? 1
        : 0;
  const sorted = [...incidents].sort(
    (a, b) =>
      triageRank(b) - triageRank(a) ||
      b.priorityScore - a.priorityScore ||
      new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
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
          sorted.map((inc) => {
            const locationInfo = getIncidentLocationInfo(inc);
            const timeInfo = formatIncidentTime(inc.createdAt);
            const isNeedsReview =
              !inc.verification?.status ||
              inc.verification.status === "NEEDS_REVIEW";

            return (
              <button
                key={inc._id}
                type="button"
                className={`rqCommandIncident ${selectedIncident?._id === inc._id ? "is-selected" : ""}`}
                onClick={() => onSelectIncident(inc)}
                aria-label={`Open quick preview for ${inc.priorityLevel} ${incidentTitle(inc)} incident`}
              >
                <div className="rqCommandIncidentBody">
                  <IncidentVisual incident={inc} />
                  <div className="rqCommandIncidentContent">
                    <div className="rqCommandIncidentTop">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span
                          className={`rqCommandSeverity ${inc.priorityLevel.toLowerCase()}`}
                        >
                          {inc.priorityLevel}
                        </span>
                        <span className="rqCommandDetailStatus">
                          {inc.status.replaceAll("_", " ")}
                        </span>
                        {isNeedsReview && (
                          <span
                            className="rqQuickPreviewVerifBadge is-needs-review text-[9px] py-0.5 px-1.5"
                            title="Verification required"
                          >
                            Needs Review
                          </span>
                        )}
                        {inc.triage?.status === "NEEDS_ASSESSMENT" && (
                          <span className="rqQuickPreviewVerifBadge is-needs-review text-[9px] py-0.5 px-1.5">Needs Triage</span>
                        )}
                        {inc.triage?.suggestedPriority === "CRITICAL" && inc.triage.status !== "COORDINATOR_REVIEWED" && (
                          <span className="rqQuickPreviewVerifBadge is-needs-review text-[9px] py-0.5 px-1.5">Critical Suggested · Unverified</span>
                        )}
                      </div>
                      <time dateTime={inc.createdAt} title={timeInfo.formatted}>
                        <Clock3 size={11} aria-hidden="true" />
                        {timeInfo.relative || timeInfo.formatted}
                      </time>
                    </div>

                    <h3>
                      <span>{incidentTitle(inc)}</span>
                      <ArrowUpRight size={15} aria-hidden="true" className="shrink-0 text-[var(--command-muted)]" />
                    </h3>

                    {inc.description && (
                      <p className="rqCommandIncidentDescription">{inc.description}</p>
                    )}

                    <p title={locationInfo.label}>
                      <MapPin size={12} aria-hidden="true" className="text-[var(--command-blue)] shrink-0" />
                      <span className="truncate">
                        {locationInfo.addressText || locationInfo.label}
                      </span>
                    </p>

                    <div className="rqCommandIncidentMeta">
                      <span className="text-[10px] text-[var(--command-muted)]">
                        {locationInfo.label}
                      </span>
                      {inc.priorityScore > 0 && (
                        <span className="text-[10px] text-[var(--command-muted)]">
                          Score {inc.priorityScore}
                        </span>
                      )}
                      {inc.assignedTeam && (
                        <span className="text-[10px] text-[var(--command-blue)] font-medium">
                          Team Assigned
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </button>
            );
          })
        )}
      </div>
    </section>
  );
}
