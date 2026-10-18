"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { ClipboardCheck, UsersRound, House, FileCheck2, ListChecks, ArrowUpRight, ShieldCheck } from "lucide-react";
import { districtWeather } from "@/lib/api/district-weather";
import { riskZones } from "@/lib/api/risk-zones";
import { teams } from "@/lib/api/teams";
import { ApiError, errorMessage } from "@/lib/api/client";
import {
  assessmentUrgencies,
  type MonitoredDistrict,
  type RiskZone,
  type PreparednessDecision,
  type PreparednessAction,
} from "@/types/risk-zones";
import type { RescueTeam } from "@/types/api";
import { Attention, Freshness, date, human } from "./monitoring-utils";
const recommendations = {
  ROUTINE: "The available forecast is below the configured rainfall attention thresholds. Continue monitoring and review local reports as needed.",
  ELEVATED: "The forecast meets an elevated monitoring threshold. Consider a local field assessment and review resource readiness.",
  URGENT_REVIEW: "Forecast evidence meets an urgent-review threshold. Validate local conditions and review preparedness options promptly.",
  DATA_UNAVAILABLE: "Current weather evidence is unavailable for classification. Check the last valid update and existing community reports before drawing conclusions.",
};

const labels: Record<PreparednessAction, string> = {
  CONTINUE_MONITORING: "Continue monitoring",
  REQUEST_FIELD_ASSESSMENT: "Request field assessment",
  REVIEW_RESOURCES: "Review nearby resources",
  ESCALATE_REVIEW: "Escalate to manual review",
};
export function PreparednessActions({
  district,
  onShelters,
  onCommunities,
}: {
  district: MonitoredDistrict;
  onShelters: () => void;
  onCommunities: () => void;
}) {
  const [mode, setMode] = useState<"" | "teams" | "assessment" | "decision">(
    "",
  );
  const [teamRows, setTeamRows] = useState<RescueTeam[]>([]),
    [zones, setZones] = useState<RiskZone[]>([]);
  const [decisions, setDecisions] = useState<PreparednessDecision[]>([]);
  const [selectedZone, setSelectedZone] = useState(""),
    [urgency, setUrgency] =
      useState<(typeof assessmentUrgencies)[number]>("ROUTINE");
  const [reason, setReason] = useState(""),
    [decision, setDecision] = useState<PreparednessAction>(
      "CONTINUE_MONITORING",
    );
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [uncertain, setUncertain] = useState(false);
  const lock = useRef(false),
    alive = useRef(true);
  const requestId = useRef<string | null>(null);
  const [reading, setReading] = useState(false);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    if (mode === "teams") {
      void teams
        .list(
          { status: "AVAILABLE", isSimulated: false, limit: 100 },
          controller.signal,
        )
        .then((value) => {
          if (!controller.signal.aborted) setTeamRows(value.items);
        })
        .catch((err) => {
          if (!controller.signal.aborted) setError(errorMessage(err));
        })
        .finally(() => {
          if (!controller.signal.aborted) setReading(false);
        });
    } else if (mode === "assessment") {
      void riskZones
        .list(
          { district: district.name, isSimulated: false, limit: 100 },
          controller.signal,
        )
        .then((value) => {
          if (!controller.signal.aborted)
            setZones(
              value.items.filter(
                (zone) =>
                  zone.district.toLowerCase() === district.name.toLowerCase() &&
                  !zone.isSimulated,
              ),
            );
        })
        .catch((err) => {
          if (!controller.signal.aborted) setError(errorMessage(err));
        })
        .finally(() => {
          if (!controller.signal.aborted) setReading(false);
        });
    } else if (mode === "decision") {
      void districtWeather
        .decisions(district.id, controller.signal)
        .then((value) => {
          if (!controller.signal.aborted) setDecisions(value);
        })
        .catch((err) => {
          if (!controller.signal.aborted) setError(errorMessage(err));
        })
        .finally(() => {
          if (!controller.signal.aborted) setReading(false);
        });
    }
    return () => controller.abort();
  }, [mode, district.id, district.name]);
  function changeMode(value: typeof mode) {
    if (busy) return;
    if (value !== mode) setReading(true);
    setMode(value);
    setError("");
    setMessage("");
  }
  const evidence = district.weather
    ? `${district.weather.provider}; fetched ${district.weather.retrievedAt}; ${district.weather.freshness}; ${district.weather.next24Hours.precipitationMm} mm from ${district.weather.next24Hours.start} to ${district.weather.next24Hours.end}; attention ${district.attention?.level || "DATA_UNAVAILABLE"}.`
    : "No weather forecast is available; request is based on coordinator review.";
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (lock.current || uncertain || reason.trim().length < 5) return;
    if (
      mode === "assessment" &&
      !zones.some((zone) => zone._id === selectedZone)
    ) {
      setError("Select an actual community record in this district.");
      return;
    }
    lock.current = true;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      if (mode === "assessment") {
        const saved = await riskZones.requestAssessment(selectedZone, {
          priorityUrgency: urgency,
          assessmentNotes: `${reason.trim()} Weather evidence: ${evidence}`,
        });
        if (
          !saved.fieldAssessment ||
          saved.assessmentStatus !== "ASSESSMENT_DISPATCHED"
        )
          throw new ApiError(
            "Assessment confirmation was incomplete",
            0,
            "protocol",
          );
        if (alive.current) {
          setMessage(
            `Field assessment request saved for ${saved.communityName}. Current state: ${human(saved.assessmentStatus)}. No rescue team was assigned.`,
          );
          setSelectedZone("");
        }
      } else {
        requestId.current ||= crypto.randomUUID();
        const saved = await districtWeather.recordDecision(district.id, {
          clientRequestId: requestId.current,
          action: decision,
          notes: reason.trim(),
          weatherRetrievedAt: district.weather?.retrievedAt || null,
        });
        if (
          !saved?._id ||
          saved.status !== "RECORDED" ||
          saved.districtId !== district.id
        )
          throw new ApiError(
            "Decision confirmation was incomplete",
            0,
            "protocol",
          );
        if (alive.current) {
          setDecisions((previous) =>
            [saved, ...previous.filter((row) => row._id !== saved._id)].slice(
              0,
              20,
            ),
          );
          setMessage(
            "Coordinator decision saved. This records intent only; no incident, dispatch or field assessment was created.",
          );
          requestId.current = null;
        }
      }
      if (alive.current) setReason("");
    } catch (err) {
      if (alive.current) {
        const ambiguous =
          !(err instanceof ApiError) || err.status === 0 || err.status >= 500;
        setUncertain(ambiguous);
        setError(
          ambiguous
            ? "Save is unconfirmed and may have reached the server. Inspect the stored decision or assessment records before trying again."
            : errorMessage(err),
        );
      }
    } finally {
      lock.current = false;
      if (alive.current) setBusy(false);
    }
  }
  return (
    <section
      className="siCard siPreparedness"
      aria-label="Coordinator Action Panel"
    >
      <header>
        <h2><ClipboardCheck size={17} />Coordinator Action Panel</h2>
        <Attention level={district.attention?.level || "DATA_UNAVAILABLE"} />
      </header>
      <div className="siDetailBody">
        <div className="siActionSummary"><span className="siEyebrow">{district.name} · Weather-informed readiness</span><h3>Current assessment</h3><p>{recommendations[district.attention?.level || "DATA_UNAVAILABLE"]}</p><div className="siActionFreshness"><Freshness weather={district.weather} />{district.weather && <time dateTime={district.weather.retrievedAt}>Fetched {date(district.weather.retrievedAt)} PKT</time>}</div></div>
        <div className="siPreparednessButtons">
          <button
            className="siActionFeatured"
            aria-label="Create Field Assessment"
            disabled={busy}
            onClick={() => changeMode("assessment")}
          >
            <span className="siActionIcon"><ClipboardCheck size={23} /></span><span><small>{district.attention?.level === "ROUTINE" ? "Optional next step" : district.attention?.level === "DATA_UNAVAILABLE" ? "Human verification" : "Recommended next step"}</small><strong>Create Field Assessment</strong><span>{district.attention?.level === "DATA_UNAVAILABLE" ? "Review existing reports, then request ground verification if needed." : "Request human verification of local ground conditions."}</span></span><ArrowUpRight size={17} />
          </button>
          <div className="siActionGrid">
          <button
            className="siActionCard"
            aria-label="Review Available Teams"
            disabled={busy}
            onClick={() => changeMode("teams")}
          >
            <UsersRound size={20} /><span><strong>Review Available Teams</strong><small>Check response readiness</small></span><ArrowUpRight size={14} />
          </button>
          <button className="siActionCard" aria-label="View Nearby Shelters" onClick={onShelters}>
            <House size={20} /><span><strong>View Nearby Shelters</strong><small>Inspect stored resources</small></span><ArrowUpRight size={14} />
          </button>
          <button
            className="siActionCard"
            aria-label="Record Coordinator Decision"
            disabled={busy}
            onClick={() => changeMode("decision")}
          >
            <FileCheck2 size={20} /><span><strong>Record Decision</strong><small>Save human review</small></span><ArrowUpRight size={14} />
          </button>
          <Link className="siActionCard" aria-label="View Incident Directory" href="/dashboard/incidents">
            <ListChecks size={20} /><span><strong>View Incidents</strong><small>Review reported emergencies</small></span><ArrowUpRight size={14} />
          </Link>
          </div>
        </div>
        <p className="siHumanApproval"><ShieldCheck size={14} />Human confirmation required. Reviewing resources does not dispatch or reserve them.</p>
        {reading && <p className="siReadStatus" role="status">Loading {mode === "teams" ? "available teams" : mode === "assessment" ? "community records" : "recorded decisions"}…</p>}
        {mode === "teams" && (
          <div aria-label="Available preparedness teams">
            <h3>Available teams across the service area</h3>
            <p className="siFootnote">
              Not sorted by travel time or proximity. Up to 100 stored available teams are shown.
            </p>
            {teamRows.length ? (
              teamRows.map((team) => (
                <div className="siReason" key={team._id}>
                  <strong>{team.name}</strong>
                  <p>
                    {human(team.status)} ·{" "}
                    {team.capabilities.map(human).join(", ")}
                  </p>
                  <p>
                    Stored base:{" "}
                    {team.location.address ||
                      `${team.location.latitude}, ${team.location.longitude}`}
                  </p>
                </div>
              ))
            ) : (
              !reading && !error && <p>No available team records were returned. Check Team Management for other statuses.</p>
            )}
            <Link href="/dashboard/rescue-teams">
              Open Rescue Team Management
            </Link>
          </div>
        )}
        {mode === "assessment" && (
          <>
            <h3>Request assessment for a real community</h3>
            <p className="siFootnote">
              Uses the existing assessment workflow and its stored Assessment
              Dispatched state. This does not dispatch a rescue team. Up to 100
              matching community records are listed.
            </p>
            {!zones.length && !reading && !error && (
              <p>
                No matching community records were returned.{" "}
                <button className="siTextButton" onClick={onCommunities}>
                  Open Community Assessments
                </button>{" "}
                to register or inspect a real location first.
              </p>
            )}
          </>
        )}
        {(mode === "assessment" || mode === "decision") && (
          <form
            onSubmit={(event) => void submit(event)}
            className="siPreparednessForm"
          >
            {mode === "assessment" ? (
              <>
                <label>
                  Community record
                  <select
                    value={selectedZone}
                    onChange={(event) => setSelectedZone(event.target.value)}
                    required
                  >
                    <option value="">Select a recorded community</option>
                    {zones.map((zone) => (
                      <option value={zone._id} key={zone._id}>
                        {zone.communityName} · {human(zone.assessmentStatus)}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Assessment priority
                  <select
                    value={urgency}
                    onChange={(event) =>
                      setUrgency(event.target.value as typeof urgency)
                    }
                  >
                    {assessmentUrgencies.map((value) => (
                      <option key={value}>{value}</option>
                    ))}
                  </select>
                </label>
                <p className="siFootnote">Evidence to attach: {evidence}</p>
              </>
            ) : (
              <label>
                Coordinator decision
                <select
                  value={decision}
                  onChange={(event) =>
                    setDecision(event.target.value as PreparednessAction)
                  }
                >
                  {Object.entries(labels).map(([value, label]) => (
                    <option value={value} key={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <label>
              Reason for review
              <textarea
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                required
                minLength={5}
                maxLength={600}
                disabled={busy || uncertain}
              />
            </label>
            <button
              className="siPrimary"
              disabled={
                busy ||
                uncertain ||
                reason.trim().length < 5 ||
                (mode === "assessment" && !selectedZone)
              }
            >
              {busy
                ? "Saving…"
                : mode === "assessment"
                  ? "Confirm Assessment Request"
                  : "Confirm Coordinator Decision"}
            </button>
          </form>
        )}
        {mode === "decision" && (
          <div aria-label="Recorded coordinator decisions">
            <h3>Recent recorded decisions</h3>
            {decisions.length ? (
              decisions.map((row) => (
                <div className="siReason" key={row._id}>
                  <strong>{labels[row.action]}</strong>
                  <p>{row.notes}</p>
                  <small>
                    {date(row.createdAt)} · Coordinator {row.coordinatorId} ·{" "}
                    {row.weatherEvidence.freshness} evidence ·{" "}
                    {human(row.weatherEvidence.attention)}
                  </small>
                </div>
              ))
            ) : (
              !reading && !error && <p>No saved decisions were returned for this district.</p>
            )}
          </div>
        )}
        {error && (
          <p className="siError" role="alert">
            {error}
          </p>
        )}
        {message && <p role="status">{message}</p>}
      </div>
    </section>
  );
}
