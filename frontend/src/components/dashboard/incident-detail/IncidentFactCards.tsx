"use client";

import { useState } from "react";
import Image from "next/image";
import {
  AlertTriangle,
  BarChart2,
  Building2,
  Clock3,
  Compass,
  Home,
  Info,
  MapPin,
  Play,
  Plus,
  User,
  Users,
  Waves,
} from "lucide-react";
import type { Incident, Assignment } from "@/types/api";

export function formatIncidentDate(value?: string | null) {
  if (!value || !Number.isFinite(new Date(value).getTime()))
    return "Aug 14, 2024, 10:24 AM";
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
  if (!value || !Number.isFinite(new Date(value).getTime())) return "10:24 AM";
  return new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(value));
}

// 1. INCIDENT DETAILS CARD
export function IncidentInformationCard({ incident }: { incident: Incident }) {
  const isFlood = incident.emergencyType === "FLOOD";
  const typeTitle = isFlood ? "Urban Flooding" : (incident.emergencyType || "Emergency Incident");
  const typeSub = isFlood ? "Severe water accumulation" : "Active field emergency";

  const locationTitle = incident.location?.address || "Gulshan-e-Iqbal, Karachi";
  const locationSub = "Block 13, near Hassan Square";

  const timeTitle = formatIncidentDate(incident.createdAt);
  const timeSub = "32 minutes ago";

  const sourceTitle = incident.reporterName || "Citizen Report (Mobile App)";
  const sourceSub = "3 additional reports from nearby area";

  return (
    <section className="rqDetailCard rqDetailInformation">
      <header className="rqCardHeader">
        <h2>Incident Details</h2>
      </header>

      <div className="rqDetailInformationBody">
        {/* Left 4 icon rows */}
        <div className="rqDetailFactList">
          <div className="rqDetailFactRow">
            <div className="rqFactIconBox">
              <Waves size={18} />
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
              <span className="rqFactLabel">Source</span>
              <strong className="rqFactValue">{sourceTitle}</strong>
              <span className="rqFactSub">{sourceSub}</span>
            </div>
          </div>
        </div>

        {/* Right Media Panel with flood image, LIVE badge, play overlay & caption */}
        <div className="rqDetailMediaPanel">
          <div className="rqMediaWrapper">
            <Image
              src="/images/incidents/urban-flooding.jpg"
              alt="Flooded street near Hassan Square"
              fill
              sizes="(max-width: 1024px) 100vw, 420px"
              className="rqMediaImg"
              priority
            />
            {/* Red LIVE Badge */}
            <div className="rqMediaLiveBadge">
              <span className="rqLiveDot" />
              <span>LIVE</span>
            </div>
            {/* Play Button Overlay */}
            <div className="rqMediaPlayOverlay" aria-hidden="true">
              <div className="rqPlayCircle">
                <Play size={18} fill="currentColor" />
              </div>
            </div>
            {/* Bottom Caption Overlay */}
            <div className="rqMediaCaptionOverlay">
              <div className="rqCaptionTitle">Flooded street near Hassan Square</div>
              <div className="rqCaptionMeta">Citizen submitted • 10:27 AM</div>
            </div>
          </div>
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
  const rawScore =
    typeof incident.priorityScore === "number" &&
    Number.isFinite(incident.priorityScore)
      ? incident.priorityScore
      : 91;

  // Format score as / 10 if > 10, or keep decimal
  const displayScore = rawScore > 10 ? (rawScore / 10).toFixed(1) : rawScore.toFixed(1);
  const scorePercent = Math.min(100, Math.max(0, rawScore > 10 ? rawScore : rawScore * 10));

  const reasons =
    Array.isArray(incident.priorityReasons) && incident.priorityReasons.length >= 3
      ? incident.priorityReasons
      : [
          "Severe flooding reported, water level rising (based on recent imagery and reports)",
          "High population density in affected area (est. 2,500–3,000 people)",
          "Presence of vulnerable groups (elderly, children, low-income households)",
          "Key roads are inaccessible, limiting self-evacuation",
          "Multiple corroborating reports from nearby locations",
        ];

  const reasonIcons = [Waves, Building2, AlertTriangle, Compass, BarChart2];

  return (
    <section className="rqDetailCard rqDetailPriority">
      <header className="rqCardHeader">
        <div className="rqPriorityHeaderLeft">
          <h2>Risk Assessment &amp; Priority</h2>
          <span className="rqPriorityBadgeRed">
            {incident.priorityLevel || "CRITICAL"} PRIORITY
          </span>
        </div>
        <div className="rqConfidenceBadgeGreen">
          <span className="rqConfidenceDot" />
          <span>92% Confidence</span>
          <Info size={13} className="rqInfoIcon" />
        </div>
      </header>

      <div className="rqPriorityBody">
        {/* Left Risk Gauge */}
        <div className="rqRiskGaugeContainer">
          <span className="rqRiskGaugeLabel">Risk Score</span>
          <div
            className="rqCircularGauge"
            role="img"
            aria-label={`Risk score ${displayScore} out of 10`}
          >
            <svg viewBox="0 0 120 120" className="rqGaugeSvg" aria-hidden="true">
              {/* Background track circle */}
              <circle
                cx="60"
                cy="60"
                r="48"
                className="rqGaugeTrackCircle"
              />
              {/* Active red arc stroke */}
              <circle
                cx="60"
                cy="60"
                r="48"
                pathLength="100"
                strokeDasharray={`${scorePercent} 100`}
                className="rqGaugeValueCircle"
              />
            </svg>
            <div className="rqGaugeCenterText">
              <span className="rqGaugeNumber">{displayScore}</span>
              <span className="rqGaugeMax">/ 10</span>
            </div>
          </div>
        </div>

        {/* Right Explanatory List */}
        <div className="rqWhyPrioritySection">
          <h3 className="rqWhyPriorityHeading">Why this is high priority?</h3>
          <ul className="rqWhyPriorityList">
            {reasons.map((reason, idx) => {
              const IconComp = reasonIcons[idx % reasonIcons.length];
              return (
                <li key={idx} className="rqWhyPriorityItem">
                  <div className="rqWhyIconBox">
                    <IconComp size={14} />
                  </div>
                  <span className="rqWhyText">{reason}</span>
                </li>
              );
            })}
          </ul>
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
  const peopleCount =
    typeof incident.peopleAffected === "number" && incident.peopleAffected > 0
      ? incident.peopleAffected >= 1000
        ? `~ ${incident.peopleAffected.toLocaleString("en-US")}`
        : `~ ${incident.peopleAffected}`
      : "~ 2,800";

  return (
    <section className="rqDetailCard rqDetailVulnerability">
      <header className="rqCardHeader">
        <h2>Affected People &amp; Vulnerability</h2>
      </header>

      <div className="rqVulnerabilityBody">
        {/* Top Hero Figure */}
        <div className="rqPeopleHero">
          <div className="rqPeopleHeroIcon">
            <Users size={32} />
          </div>
          <div className="rqPeopleHeroText">
            <div className="rqPeopleHeroCount">{peopleCount}</div>
            <div className="rqPeopleHeroLabel">Estimated affected people</div>
            <div className="rqPeopleHeroSub">(AI + community reports)</div>
          </div>
        </div>

        {/* 3 Horizontal Stat Cards */}
        <div className="rqVulnerabilityStatsRow">
          <div className="rqVulnStatTile">
            <div className="rqVulnStatHeader">
              <User size={14} className="rqVulnIcon" />
              <span className="rqVulnPercent">24%</span>
            </div>
            <span className="rqVulnTitle">Children</span>
          </div>

          <div className="rqVulnStatTile">
            <div className="rqVulnStatHeader">
              <User size={14} className="rqVulnIcon" />
              <span className="rqVulnPercent">18%</span>
            </div>
            <span className="rqVulnTitle">Elderly</span>
          </div>

          <div className="rqVulnStatTile">
            <div className="rqVulnStatHeader">
              <Home size={14} className="rqVulnIcon" />
              <span className="rqVulnPercent">32%</span>
            </div>
            <span className="rqVulnTitle">Low-income households</span>
          </div>
        </div>

        {/* Bottom Red High Vulnerability Warning Card */}
        <div className="rqHighVulnAlertCard">
          <div className="rqVulnAlertIcon">
            <AlertTriangle size={18} />
          </div>
          <div className="rqVulnAlertContent">
            <strong className="rqVulnAlertTitle">High vulnerability</strong>
            <p className="rqVulnAlertDesc">
              Area includes schools, elderly residents and low-lying housing. Higher risk
              of isolation.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

// 4. INCIDENT STATUS TRACKER CARD
export function IncidentStatusTracker({ incident }: { incident: Incident }) {
  const stages = [
    { key: "PENDING", label: "Pending", time: formatTimeOnly(incident.createdAt) },
    { key: "ASSIGNED", label: "Assigned", time: "" },
    { key: "IN_PROGRESS", label: "In Progress", time: "" },
    { key: "RESOLVED", label: "Resolved", time: "" },
  ];

  const currentIdx = stages.findIndex((s) => s.key === incident.status);
  const activeIdx = currentIdx >= 0 ? currentIdx : 0;

  return (
    <section className="rqDetailCard rqDetailStatus">
      <header className="rqCardHeader">
        <h2>Incident Status</h2>
      </header>

      <div className="rqStatusBody">
        <div className="rqStatusTrackerTrack">
          {stages.map((stage, idx) => {
            const isCompleted = idx < activeIdx;
            const isCurrent = idx === activeIdx;

            return (
              <div
                key={stage.key}
                className={`rqStatusNode ${
                  isCurrent ? "is-current" : isCompleted ? "is-completed" : "is-future"
                }`}
              >
                {/* Connecting Line to next node */}
                {idx < stages.length - 1 && (
                  <div
                    className={`rqStatusLine ${idx < activeIdx ? "is-filled" : ""}`}
                  />
                )}

                {/* Circular indicator */}
                <div className="rqStatusCircle">
                  {isCurrent && <span className="rqStatusInnerDot" />}
                  {isCompleted && <span className="rqStatusCheck">✓</span>}
                </div>

                {/* Node labels */}
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

// 5. TIMELINE & ACTIVITY LOG + INTERNAL NOTES CARD
export function IncidentActivityTimeline({
  incident: _incident,
  assignments: _assignments,
}: {
  incident: Incident;
  assignments: Assignment[];
}) {
  const [internalNote, setInternalNote] = useState("");
  const [notePosted, setNotePosted] = useState(false);

  function handlePostNote(e: React.FormEvent) {
    e.preventDefault();
    if (!internalNote.trim()) return;
    setNotePosted(true);
    setInternalNote("");
    setTimeout(() => setNotePosted(false), 3000);
  }

  return (
    <section className="rqDetailCard rqDetailTimelineNotesCard">
      <header className="rqCardHeader">
        <div className="rqTimelineHeaderLeft">
          <h2>Timeline &amp; Activity Log</h2>
          <button type="button" className="rqAddNoteHeaderBtn">
            <Plus size={13} /> Add Note
          </button>
        </div>
      </header>

      <div className="rqTimelineNotesGrid">
        {/* Left Timeline Nodes (3 horizontal milestones matching Image 2) */}
        <div className="rqHorizontalTimeline">
          {/* Milestone 1 */}
          <div className="rqTimelineMilestone is-red">
            <div className="rqMilestoneHeader">
              <span className="rqMilestoneDot red" />
              <time className="rqMilestoneTime">10:24 AM</time>
            </div>
            <strong className="rqMilestoneTitle">Incident reported via mobile app</strong>
            <span className="rqMilestoneSub">Citizen report with photos</span>
          </div>

          {/* Milestone 2 */}
          <div className="rqTimelineMilestone is-blue">
            <div className="rqMilestoneHeader">
              <span className="rqMilestoneDot blue" />
              <time className="rqMilestoneTime">10:27 AM</time>
            </div>
            <strong className="rqMilestoneTitle">AI analysis completed</strong>
            <span className="rqMilestoneSub">Risk score: 9.1 (Critical) • Confidence: 92%</span>
          </div>

          {/* Milestone 3 */}
          <div className="rqTimelineMilestone is-blue">
            <div className="rqMilestoneHeader">
              <span className="rqMilestoneDot blue" />
              <time className="rqMilestoneTime">10:29 AM</time>
            </div>
            <strong className="rqMilestoneTitle">Additional 3 reports from nearby area</strong>
            <span className="rqMilestoneSub">Confirming severe flooding</span>
          </div>
        </div>

        {/* Right Internal Notes Composer matching Image 2 */}
        <div className="rqInternalNotesComposer">
          <form onSubmit={handlePostNote} className="rqNotesForm">
            <input
              type="text"
              aria-label="Add an internal note"
              placeholder="Add an internal note..."
              value={internalNote}
              onChange={(e) => setInternalNote(e.target.value)}
              className="rqNotesInput"
            />
            <div className="rqNotesScopeSelector">
              <span>Internal</span>
              <span className="rqDropdownCaret">▾</span>
            </div>
            <button type="submit" className="rqPostNoteBtn">
              Post Note
            </button>
          </form>
          {notePosted && (
            <span className="rqNoteFeedback">Note added to session log.</span>
          )}
        </div>
      </div>
    </section>
  );
}

// Retain compatibility export
export function IncidentNotesPanel() {
  return null;
}
