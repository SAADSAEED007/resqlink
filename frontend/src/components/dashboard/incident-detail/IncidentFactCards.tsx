"use client";

import Image from "next/image";
import {
  Activity,
  AlertOctagon,
  AlertTriangle,
  Building2,
  Clock3,
  Flame,
  HeartPulse,
  Info,
  MapPin,
  Package,
  Shield,
  ShieldAlert,
  User,
  Users,
  Waves,
} from "lucide-react";
import type { Incident, Assignment, EmergencyType } from "@/types/api";

export function formatIncidentDate(value?: string | null) {
  if (!value || !Number.isFinite(new Date(value).getTime()))
    return "Not recorded";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(value));
}

export function formatTimeOnly(value?: string | null) {
  if (!value || !Number.isFinite(new Date(value).getTime())) return "";
  return new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(value));
}

const EMERGENCY_ICONS = {
  FLOOD: Waves,
  FIRE: Flame,
  MEDICAL: HeartPulse,
  STRANDED: AlertOctagon,
  SUPPLIES: Package,
  OTHER: AlertTriangle,
} as const;

export function EmergencyCategoryIcon({
  type,
  size = 18,
}: {
  type?: EmergencyType;
  size?: number;
}) {
  const Icon = type && type in EMERGENCY_ICONS ? EMERGENCY_ICONS[type] : AlertTriangle;
  return <Icon size={size} />;
}

// 1. INCIDENT DETAILS CARD
export function IncidentInformationCard({ incident }: { incident: Incident }) {
  const typeTitle = incident.emergencyType
    ? incident.emergencyType.replaceAll("_", " ")
    : "Emergency Incident";
  const typeSub = incident.waterLevel && incident.waterLevel !== "NONE"
    ? `Water level: ${incident.waterLevel.toLowerCase()}`
    : "Active incident report";

  const locationTitle =
    incident.location?.address ||
    (incident.location
      ? `${incident.location.latitude.toFixed(4)}, ${incident.location.longitude.toFixed(4)}`
      : "Address not provided");

  const locationSub = incident.location
    ? `Coordinates: ${incident.location.latitude.toFixed(4)}, ${incident.location.longitude.toFixed(4)}`
    : "Location coordinates required";

  const timeTitle = formatIncidentDate(incident.createdAt);
  const timeSub = incident.updatedAt && incident.updatedAt !== incident.createdAt
    ? `Updated ${formatIncidentDate(incident.updatedAt)}`
    : "Initial report time";

  const sourceTitle = incident.reporterName || "Not reported";
  const sourceSub = incident.reporterPhone
    ? `Contact: ${incident.reporterPhone}`
    : "Direct platform submission";

  const isDemo = incident.isSimulated || incident._id === "INC-2024-0814-001";

  return (
    <section className="rqDetailCard rqDetailInformation">
      <header className="rqCardHeader">
        <h2>Incident Details</h2>
        <span className="rqDetailBadge">
          {incident.emergencyType || "GENERAL"}
        </span>
      </header>

      <div className="rqDetailInformationBody">
        {/* Left icon rows */}
        <div className="rqDetailFactList">
          <div className="rqDetailFactRow">
            <div className="rqFactIconBox">
              <EmergencyCategoryIcon type={incident.emergencyType} size={18} />
            </div>
            <div className="rqFactText">
              <span className="rqFactLabel">Type</span>
              <strong className="rqFactValue">{typeTitle}</strong>
              <span className="rqFactSub">{typeSub}</span>
            </div>
          </div>

          <div className="rqDetailFactRow">
            <div className="rqFactIconBox">
              <MapPin size={18} />
            </div>
            <div className="rqFactText">
              <span className="rqFactLabel">Location</span>
              <strong className="rqFactValue">{locationTitle}</strong>
              <span className="rqFactSub">{locationSub}</span>
            </div>
          </div>

          <div className="rqDetailFactRow">
            <div className="rqFactIconBox">
              <Clock3 size={18} />
            </div>
            <div className="rqFactText">
              <span className="rqFactLabel">Reported</span>
              <strong className="rqFactValue">{timeTitle}</strong>
              <span className="rqFactSub">{timeSub}</span>
            </div>
          </div>

          <div className="rqDetailFactRow">
            <div className="rqFactIconBox">
              <Users size={18} />
            </div>
            <div className="rqFactText">
              <span className="rqFactLabel">Reporter</span>
              <strong className="rqFactValue">{sourceTitle}</strong>
              <span className="rqFactSub">{sourceSub}</span>
            </div>
          </div>
        </div>

        {/* Right Media / Category Panel */}
        <div className="rqDetailMediaPanel rqDetailMedia">
          {isDemo ? (
            <div className="rqMediaWrapper" style={{ position: "relative", minHeight: 180, width: "100%", height: "100%" }}>
              <Image
                src="/images/incidents/urban-flooding.jpg"
                alt="Simulated flood illustration"
                fill
                sizes="(max-width: 1024px) 100vw, 420px"
                className="rqMediaImg"
                style={{ objectFit: "cover" }}
              />
              <div className="rqMediaSimulationTag" style={{ position: "absolute", bottom: 8, left: 8, background: "rgba(15,23,42,0.85)", color: "#fff", padding: "2px 8px", borderRadius: 4, fontSize: 10 }}>Simulation Preview</div>
            </div>
          ) : (
            <div className="rqMediaPlaceholderBox">
              <div className="rqMediaCategoryIconWrap">
                <EmergencyCategoryIcon type={incident.emergencyType} size={36} />
              </div>
              <strong className="rqMediaPlaceholderTitle">No attached media supplied</strong>
              <p className="rqMediaPlaceholderDesc">
                {incident.description || "No detailed field narrative provided by reporter."}
              </p>
              <div className="rqMediaVerificationTag">
                <Shield size={12} />
                <span>
                  {incident.verification?.status
                    ? incident.verification.status.replaceAll("_", " ")
                    : "Verification pending"}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

// 2. RISK ASSESSMENT & PRIORITY CARD
export function IncidentPriorityCard({
  incident,
  onAdjust,
}: {
  incident: Incident;
  onAdjust?: () => void;
}) {
  const priorityLevel = incident.priorityLevel || "LOW";
  const priorityClass = priorityLevel.toLowerCase();

  const hasScore =
    typeof incident.priorityScore === "number" &&
    Number.isFinite(incident.priorityScore);

  const displayScore = hasScore ? incident.priorityScore : null;
  const scorePercent = hasScore
    ? Math.min(100, Math.max(0, incident.priorityScore))
    : 0;

  const reasons =
    Array.isArray(incident.priorityReasons) && incident.priorityReasons.length > 0
      ? incident.priorityReasons
      : [];

  const reasonIcons = [Waves, Building2, AlertTriangle, ShieldAlert, Activity];
  const lastOverride = Array.isArray(incident.priorityOverrides) && incident.priorityOverrides.length > 0
    ? incident.priorityOverrides[incident.priorityOverrides.length - 1]
    : null;

  return (
    <section className="rqDetailCard rqDetailPriority">
      <header className="rqCardHeader">
        <div className="rqPriorityHeaderLeft">
          <h2>Risk Assessment &amp; Priority</h2>
          <span className={`rqPriorityBadge rqPriority-${priorityClass}`}>
            {priorityLevel} PRIORITY
          </span>
        </div>
        {incident.confidenceLevel && (
          <div className="rqConfidenceBadge">
            <span className="rqConfidenceDot" />
            <span>{incident.confidenceLevel} Confidence</span>
            <Info size={13} className="rqInfoIcon" />
          </div>
        )}
      </header>

      <div className="rqPriorityBody">
        {/* Left Risk Gauge */}
        <div className="rqRiskGaugeContainer">
          <span className="rqRiskGaugeLabel">Priority Score</span>
          <div
            className="rqCircularGauge"
            role="img"
            aria-label={
              displayScore !== null
                ? `Priority score ${displayScore} out of 100`
                : `CRITICAL priority, numeric score unavailable`
            }
          >
            <svg viewBox="0 0 120 120" className="rqGaugeSvg" aria-hidden="true">
              <circle
                cx="60"
                cy="60"
                r="48"
                className="rqGaugeTrackCircle"
              />
              {hasScore && (
                <circle
                  cx="60"
                  cy="60"
                  r="48"
                  pathLength="100"
                  strokeDasharray={`${scorePercent} 100`}
                  className={`rqGaugeValueCircle is-${priorityClass}`}
                />
              )}
            </svg>
            <div className="rqGaugeCenterText">
              <span className="rqGaugeNumber">
                {displayScore !== null ? displayScore : "—"}
              </span>
              <span className="rqGaugeMax">/ 100</span>
            </div>
          </div>
        </div>

        {/* Right Explanatory List */}
        <div className="rqWhyPrioritySection">
          <h3 className="rqWhyPriorityHeading">Priority Assessment Factors</h3>
          {reasons.length > 0 ? (
            <ul className="rqWhyPriorityList">
              {reasons.map((reason, idx) => {
                const ReasonIcon = reasonIcons[idx % reasonIcons.length];
                return (
                  <li key={idx} className="rqWhyPriorityItem">
                    <div className="rqWhyIconBox">
                      <ReasonIcon size={14} />
                    </div>
                    <span className="rqWhyText">{reason}</span>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="rqWhyEmptyText">
              Priority reasons were not supplied.
            </p>
          )}

          {lastOverride && (
            <p className="rqDetailOverrideNote">
              Override rationale: {lastOverride.reason}
            </p>
          )}
        </div>
      </div>

      {onAdjust && (
        <div className="rqAdjustPriorityRow">
          <button type="button" className="rqAdjustPriorityBtn" onClick={onAdjust}>
            Adjust Priority
          </button>
        </div>
      )}
    </section>
  );
}

// 3. AFFECTED PEOPLE & VULNERABILITY CARD
export function IncidentVulnerabilityCard({ incident }: { incident: Incident }) {
  const hasPeopleCount =
    typeof incident.peopleAffected === "number" && Number.isFinite(incident.peopleAffected);
  const peopleCount = hasPeopleCount
    ? incident.peopleAffected >= 1000
      ? incident.peopleAffected.toLocaleString("en-US")
      : `${incident.peopleAffected}`
    : "Not reported";

  const vuln = incident.vulnerablePeople;
  const hasSpecificVuln =
    vuln &&
    (typeof vuln.children === "number" ||
      typeof vuln.elderly === "number" ||
      typeof vuln.medicalNeeds === "number" ||
      typeof vuln.disabled === "number");

  const childrenCount = vuln?.children !== undefined ? `${vuln.children}` : "—";
  const elderlyCount = vuln?.elderly !== undefined ? `${vuln.elderly}` : "—";
  const medicalCount = vuln?.medicalNeeds !== undefined ? `${vuln.medicalNeeds}` : "—";
  const disabledCount = vuln?.disabled !== undefined ? `${vuln.disabled}` : "—";

  const hasHighWarning =
    incident.immediateDanger || incident.waterLevel === "HIGH";

  return (
    <section className="rqDetailCard rqDetailVulnerability">
      <header className="rqCardHeader">
        <h2>Affected People &amp; Vulnerability</h2>
      </header>

      <div className="rqVulnerabilityBody">
        {/* Hero Figure */}
        <div className="rqPeopleHero">
          <div className="rqPeopleHeroIcon">
            <Users size={28} />
          </div>
          <div className="rqPeopleHeroText">
            <div className="rqPeopleHeroCount rqDetailPeople">
              <strong>{peopleCount}</strong>
            </div>
            <div className="rqPeopleHeroLabel">Reported affected people</div>
            <div className="rqPeopleHeroSub">
              {hasPeopleCount ? "From intake report" : "Community count not submitted"}
            </div>
          </div>
        </div>

        {/* 4 Stat Tiles */}
        <div className="rqVulnerabilityStatsRow">
          <div className="rqVulnStatTile">
            <div className="rqVulnStatHeader">
              <User size={13} className="rqVulnIcon" />
              <span className="rqVulnValue">{childrenCount}</span>
            </div>
            <span className="rqVulnTitle">Children</span>
          </div>

          <div className="rqVulnStatTile">
            <div className="rqVulnStatHeader">
              <User size={13} className="rqVulnIcon" />
              <span className="rqVulnValue">{elderlyCount}</span>
            </div>
            <span className="rqVulnTitle">Elderly</span>
          </div>

          <div className="rqVulnStatTile">
            <div className="rqVulnStatHeader">
              <HeartPulse size={13} className="rqVulnIcon" />
              <span className="rqVulnValue">{medicalCount}</span>
            </div>
            <span className="rqVulnTitle">Medical</span>
          </div>

          <div className="rqVulnStatTile">
            <div className="rqVulnStatHeader">
              <Activity size={13} className="rqVulnIcon" />
              <span className="rqVulnValue">{disabledCount}</span>
            </div>
            <span className="rqVulnTitle">Disabled</span>
          </div>
        </div>

        {/* Hidden/Fallback Grid for sparse validation */}
        {!hasSpecificVuln && (
          <dl className="rqDetailVulnerabilityGrid sr-only">
            <dt>Demographics</dt>
            <dd>Not reported</dd>
          </dl>
        )}

        {/* Warning Panel */}
        {hasHighWarning ? (
          <div className="rqHighVulnAlertCard">
            <div className="rqVulnAlertIcon">
              <AlertTriangle size={18} />
            </div>
            <div className="rqVulnAlertContent">
              <strong className="rqVulnAlertTitle">Immediate danger reported</strong>
              <p className="rqVulnAlertDesc">
                {incident.immediateDanger && incident.waterLevel === "HIGH"
                  ? "Immediate life hazard and high water level reported."
                  : incident.immediateDanger
                    ? "Immediate danger flagged by reporter."
                    : "High water accumulation reported."}
              </p>
            </div>
          </div>
        ) : (
          <div className="rqStandardVulnCard">
            <p className="rqVulnStandardDesc">
              {hasSpecificVuln
                ? "Vulnerable demographic counts recorded above."
                : "No severe demographic vulnerabilities recorded."}
            </p>
          </div>
        )}
      </div>
    </section>
  );
}

// 4. INCIDENT STATUS TRACKER CARD
export function IncidentStatusTracker({ incident }: { incident: Incident }) {
  const isCancelled = incident.status === "CANCELLED";

  const stages = [
    { key: "PENDING", label: "PENDING", time: formatTimeOnly(incident.createdAt) },
    { key: "ASSIGNED", label: "ASSIGNED", time: "" },
    { key: "IN_PROGRESS", label: "IN PROGRESS", time: "" },
    { key: "RESOLVED", label: "RESOLVED", time: "" },
  ];

  const currentIdx = stages.findIndex((s) => s.key === incident.status);
  const activeIdx = currentIdx >= 0 ? currentIdx : 0;

  return (
    <section className="rqDetailCard rqDetailStatus">
      <header className="rqCardHeader">
        <h2>Incident Status</h2>
        {isCancelled && (
          <span className="rqStatusCancelledBadge">CANCELLED</span>
        )}
      </header>

      <div className="rqStatusBody">
        <div className="rqStatusTrackerTrack">
          {stages.map((stage, idx) => {
            const isCompleted = !isCancelled && idx < activeIdx;
            const isCurrent = !isCancelled && idx === activeIdx;

            return (
              <div
                key={stage.key}
                aria-current={isCurrent ? "step" : undefined}
                className={`rqStatusNode ${
                  isCurrent ? "is-current" : isCompleted ? "is-completed" : "is-future"
                }`}
              >
                {idx < stages.length - 1 && (
                  <div
                    className={`rqStatusLine ${idx < activeIdx && !isCancelled ? "is-filled" : ""}`}
                  />
                )}

                <div className="rqStatusCircle">
                  {isCurrent && <span className="rqStatusInnerDot" />}
                  {isCompleted && <span className="rqStatusCheck">✓</span>}
                </div>

                <span className="rqStatusLabel">{stage.label}</span>
                {stage.time && <span className="rqStatusTime">{stage.time}</span>}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

// 5. TIMELINE & ACTIVITY LOG CARD
export function IncidentActivityTimeline({
  incident,
  assignments,
}: {
  incident: Incident;
  assignments: Assignment[];
}) {
  // Derive legitimate historical events
  type TimelineItem = {
    id: string;
    time: string;
    title: string;
    sub: string;
    type: "report" | "priority" | "verification" | "assignment";
  };

  const events: TimelineItem[] = [];

  // Event 1: Creation
  if (incident.createdAt) {
    events.push({
      id: "intake",
      time: formatIncidentDate(incident.createdAt),
      title: "Incident Intake Recorded",
      sub: `Reported by ${incident.reporterName || "Direct submission"}`,
      type: "report",
    });
  }

  // Event 2: Priority Overrides
  if (Array.isArray(incident.priorityOverrides)) {
    for (const [idx, override] of incident.priorityOverrides.entries()) {
      events.push({
        id: `override-${idx}`,
        time: formatIncidentDate(override.timestamp),
        title: `Priority Changed: ${override.previousPriority} → ${override.newPriority}`,
        sub: `Reason: ${override.reason}`,
        type: "priority",
      });
    }
  }

  // Event 3: Verification
  if (incident.verification?.reviewedAt) {
    events.push({
      id: "verification",
      time: formatIncidentDate(incident.verification.reviewedAt),
      title: `Verification Status: ${incident.verification.status.replaceAll("_", " ")}`,
      sub: incident.verification.reviewNotes || "Coordinator review completed",
      type: "verification",
    });
  }

  // Event 4: Assignments
  const incidentAssignments = assignments.filter((a) => a.incidentId === incident._id);
  for (const assign of incidentAssignments) {
    events.push({
      id: assign._id,
      time: formatIncidentDate(assign.assignedAt),
      title: assign.status === "COMPLETED" ? "Assignment completed" : `Rescue Team Dispatched (${assign.status})`,
      sub: `Assignment record #${assign._id.slice(-6)}`,
      type: "assignment",
    });
  }

  // Sort events by time
  events.sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());

  return (
    <section className="rqDetailCard rqDetailTimelineNotesCard rqDetailTimeline">
      <header className="rqCardHeader">
        <h2>Timeline &amp; Activity Log</h2>
        <span className="rqTimelineCount">{events.length} Recorded {events.length === 1 ? "Event" : "Events"}</span>
      </header>

      <div className="rqTimelineBody">
        {events.length > 0 ? (
          <div className="rqTimelineList">
            {events.map((ev) => (
              <div key={ev.id} className={`rqTimelineEvent is-${ev.type}`}>
                <div className="rqTimelineEventMarker">
                  <div className="rqTimelineEventDot" />
                  <div className="rqTimelineEventLine" />
                </div>
                <div className="rqTimelineEventContent">
                  <div className="rqTimelineEventHeader">
                    <strong className="rqTimelineEventTitle">{ev.title}</strong>
                    <span className="rqTimelineEventTime">{ev.time}</span>
                  </div>
                  <p className="rqTimelineEventSub">{ev.sub}</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="rqTimelineEmpty">No timestamped activity is available.</p>
        )}
      </div>
    </section>
  );
}

// Retain compatibility export
export function IncidentNotesPanel() {
  return null;
}
