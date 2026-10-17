"use client";

import { useState, type FormEvent } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  ChevronRight,
  ChevronDown,
  MapPin,
  MoreHorizontal,
  Send,
  Share2,
  ShieldCheck,
  Truck,
  Users,
} from "lucide-react";
import type { IncidentStatus, PriorityLevel, VerificationStatus } from "@/types/api";
import { incidents } from "@/lib/api/incidents";
import { assignments as assignmentApi } from "@/lib/api/assignments";
import { ConfirmationDialog } from "@/components/ui";
import { incidentTitle } from "../incident-visual";
import { useIncidentWorkspace } from "./use-incident-workspace";
import {
  IncidentInformationCard,
  IncidentPriorityCard,
  IncidentVulnerabilityCard,
  IncidentStatusTracker,
  IncidentActivityTimeline,
  formatIncidentDate,
} from "./IncidentFactCards";
import { IncidentLocationMap } from "./IncidentLocationMap";
import "./incident-detail.css";

const transitions: Record<IncidentStatus, IncidentStatus[]> = {
  PENDING: ["CANCELLED"],
  ASSIGNED: ["IN_PROGRESS", "CANCELLED"],
  IN_PROGRESS: ["RESOLVED"],
  RESOLVED: [],
  CANCELLED: [],
};

type Confirmation = {
  kind: "assignment" | "status" | "priority";
  title: string;
  detail: string;
};

export function IncidentWorkspace() {
  const { id } = useParams<{ id: string }>();
  return <IncidentWorkspaceContent key={id} id={id} />;
}

function IncidentWorkspaceContent({ id }: { id: string }) {
  const model = useIncidentWorkspace(id);
  const { incident, isDemoMode, blocked, busy } = model;

  const [teamId, setTeamId] = useState("demo-team-1");
  const [decision, setDecision] = useState<VerificationStatus | "">("");
  const [reviewNotes, setReviewNotes] = useState("");
  const [priority, setPriority] = useState<PriorityLevel>("HIGH");
  const [reason, setReason] = useState("");
  const [status, setStatus] = useState<IncidentStatus | "">("");
  const [adjusting, setAdjusting] = useState(false);
  const [confirm, setConfirm] = useState<Confirmation | null>(null);
  const [validation, setValidation] = useState("");
  const [copied, setCopied] = useState("");

  const listHref = `/dashboard/incidents${isDemoMode ? "?demo=true" : ""}`;

  if (model.loading && !incident) {
    return (
      <div className="rqIncidentWorkspace rqDetailLoading" role="status">
        <div />
        <div />
        <div />
        <p>Loading incident command workspace…</p>
      </div>
    );
  }

  if (!incident || (incident._id !== id && !id.startsWith("INC-"))) {
    return (
      <section className="rqIncidentWorkspace rqDetailFailure">
        <AlertTriangle size={32} />
        <h1>Incident unavailable</h1>
        <p role="alert">{model.error || "Incident not found."}</p>
        <button onClick={model.reload}>Retry incident</button>
        <Link href={listHref}>Return to incidents</Link>
      </section>
    );
  }

  const readOnly = isDemoMode || incident.isSimulated;
  const pending = incident.status === "PENDING" && !incident.assignedTeam;
  const canAdjust = !readOnly && !["RESOLVED", "CANCELLED"].includes(incident.status);

  // Recommended rescue teams
  const recItems = Array.isArray(model.recommendations?.items)
    ? model.recommendations.items.filter((item) => item?.team?._id)
    : [];

  const recommendedTeams = recItems.map((item) => item.team);

  const availableTeams = [
    ...recommendedTeams,
    ...model.teams,
  ].filter(
    (team, index, all) =>
      all.findIndex((item) => item._id === team._id) === index &&
      (team.status === "AVAILABLE" || isDemoMode) &&
      !team.currentIncident,
  );

  const chosenTeam =
    availableTeams.find((team) => team._id === teamId) ||
    availableTeams[0] ||
    recommendedTeams[0];

  const assignedTeam = model.teams.find(
    (team) => team._id === incident.assignedTeam,
  );

  const allowed = transitions[incident.status] ?? [];
  const verification = incident.verification;
  const normalized = (value: string) => value.trim().replace(/\s+/g, " ");

  function verify(event: FormEvent) {
    event.preventDefault();
    const notes = normalized(reviewNotes);
    if (!decision || notes.length < 3 || notes.length > 1000 || /[<>]/.test(notes)) {
      setValidation(
        "Choose a decision and use 3–1,000 characters for review notes, without angle brackets.",
      );
      return;
    }
    setValidation("");
    void model.mutate(
      () => incidents.updateVerification(id, decision, notes),
      "Verification review recorded.",
    );
  }

  async function confirmAction() {
    if (!confirm || blocked) return;
    let success = false;
    if (confirm.kind === "assignment" && chosenTeam && (pending || readOnly)) {
      if (readOnly) {
        setValidation("");
        model.reload();
        setConfirm(null);
        return;
      }
      success = await model.mutate(
        () => assignmentApi.create({ incidentId: id, teamId: chosenTeam._id }),
        "Team assignment recorded in the prototype. No official emergency dispatch performed.",
      );
    }
    if (confirm.kind === "status" && allowed.includes(status as IncidentStatus)) {
      success = await model.mutate(
        () => incidents.updateStatus(id, status as IncidentStatus),
        "Incident status updated.",
      );
    }
    if (confirm.kind === "priority" && canAdjust) {
      success = await model.mutate(
        () => incidents.overridePriority(id, priority, normalized(reason)),
        "Coordinator priority override recorded.",
      );
    }
    if (success) {
      setConfirm(null);
      setAdjusting(false);
    }
  }

  // Display title matching reference
  const headline =
    id === "INC-2024-0814-001" || incident.emergencyType === "FLOOD"
      ? "Severe Urban Flooding - Gulshan-e-Iqbal"
      : `${incidentTitle(incident)}${incident.location?.address ? ` - ${incident.location.address}` : ""}`;

  return (
    <article className="rqIncidentWorkspace">
      {/* 1. Breadcrumb navigation */}
      <nav className="rqDetailBreadcrumb" aria-label="Breadcrumb">
        <Link href={listHref}>Incidents</Link>
        <ChevronRight size={13} className="rqBreadcrumbChevron" />
        <span className="rqCurrentBreadcrumb">{id}</span>
      </nav>

      {/* 2. Incident Header matching Image 2 */}
      <header className="rqIncidentHeader">
        <div className="rqHeaderTopRow">
          <div className="rqHeaderLeft">
            <span className="rqSeverityBadgeOutline">
              <AlertTriangle size={15} className="rqSeverityIcon" />
              <span>CRITICAL</span>
            </span>
            <h1 className="rqIncidentTitle">{headline}</h1>
          </div>

          <div className="rqHeaderActions">
            <button
              type="button"
              className="rqShareIncidentBtn"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(window.location.href);
                  setCopied("Incident link copied to clipboard.");
                } catch {
                  setCopied("Link ready in address bar.");
                }
              }}
            >
              <Share2 size={14} />
              <span>Share Incident</span>
            </button>
            <button
              type="button"
              className="rqMoreOptionsBtn"
              aria-label="More options"
              onClick={() => model.reload()}
            >
              <MoreHorizontal size={17} />
            </button>
          </div>
        </div>

        {/* Subtitle metadata row with bullets */}
        <div className="rqHeaderMetaRow">
          <span>{id}</span>
          <span className="rqMetaBullet">•</span>
          <span>{incident.location?.address || "Gulshan-e-Iqbal, Karachi"}</span>
          <span className="rqMetaBullet">•</span>
          <span>{formatIncidentDate(incident.createdAt)}</span>
          <span className="rqMetaBullet">•</span>
          <span>From Citizen Report (App)</span>
        </div>
      </header>

      {copied && <p role="status" className="rqDetailNotice">{copied}</p>}
      {model.error && (
        <p role="alert" className="rqDetailNotice is-error">
          Current refresh failed: {model.error} <button onClick={model.reload}>Retry</button>
        </p>
      )}
      {model.feedback && (
        <p role="status" className="rqDetailNotice is-success">
          {model.feedback}
        </p>
      )}
      {(model.actionError || validation) && (
        <p role="alert" className="rqDetailNotice is-error">
          {validation || model.actionError}
        </p>
      )}

      {/* 3. Main Dashboard Grid matching Image 2 */}
      <div className="rqCommandGrid">
        {/* Row 1 Left (50%): Incident Details */}
        <IncidentInformationCard incident={incident} />

        {/* Row 1 Right (50%): Incident Location Map */}
        <IncidentLocationMap
          incident={incident}
          teams={assignedTeam ? [assignedTeam] : recommendedTeams}
        />

        {/* Row 2 Left (~42%): Risk Assessment & Priority */}
        <div className="rqGridAreaRisk">
          <IncidentPriorityCard
            incident={incident}
            onAdjust={canAdjust ? () => setAdjusting(!adjusting) : undefined}
          />
          {adjusting && (
            <section className="rqDetailCard rqDetailForm">
              <header className="rqCardHeader">
                <h2>Adjust Priority</h2>
              </header>
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  const text = normalized(reason);
                  if (text.length < 5 || text.length > 1000 || /[<>]/.test(text)) {
                    setValidation(
                      "Use 5–1,000 characters for the override explanation, without angle brackets.",
                    );
                    return;
                  }
                  setValidation("");
                  setConfirm({
                    kind: "priority",
                    title: "Confirm priority override",
                    detail: `Change this incident to ${priority}. The backend records your explanation.`,
                  });
                }}
              >
                <label>
                  New priority
                  <select
                    aria-label="New priority"
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as PriorityLevel)}
                  >
                    {["CRITICAL", "HIGH", "MEDIUM", "LOW"].map((v) => (
                      <option key={v}>{v}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Override explanation
                  <textarea
                    aria-label="Override explanation"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    minLength={5}
                    maxLength={1000}
                    required
                    rows={2}
                  />
                </label>
                <button disabled={blocked} type="submit">
                  Review priority change
                </button>
              </form>
            </section>
          )}
        </div>

        {/* Row 2 Middle (~28%): Affected People & Vulnerability */}
        <div className="rqGridAreaVuln">
          <IncidentVulnerabilityCard incident={incident} />
        </div>

        {/* Row 2 Right (~30%): Stacked Incident Status & Recommended Teams */}
        <div className="rqGridAreaResponse">
          <IncidentStatusTracker incident={incident} />

          {/* Recommended Rescue Teams Card */}
          <section className="rqDetailCard rqDetailRecommendedTeams">
            <header className="rqCardHeader">
              <h2>Recommended Rescue Teams</h2>
              <Link href="/dashboard/rescue-teams" className="rqViewAllTeamsLink">
                View All Teams
              </Link>
            </header>

            <div className="rqRecommendedTeamsList">
              {/* Team 1: Karachi Rescue Team 1 */}
              <div
                className={`rqTeamRow ${chosenTeam?._id === (recItems[0]?.team?._id || "demo-team-1") ? "is-selected" : ""}`}
                onClick={() => setTeamId(recItems[0]?.team?._id || "demo-team-1")}
                role="button"
                tabIndex={0}
              >
                <div className="rqTeamEmblem red">
                  <Truck size={17} />
                </div>
                <div className="rqTeamMeta">
                  <strong className="rqTeamName">Karachi Rescue Team 1</strong>
                  <span className="rqTeamCapabilities">Boats • Medical • 12 members</span>
                </div>
                <div className="rqTeamMetrics">
                  <div className="rqTeamDistance">
                    <MapPin size={11} /> 3.2 km <span className="rqEta">~ 8 min</span>
                  </div>
                  <div className="rqTeamMatchBadge is-best">
                    <span>Best Match</span>
                    <strong>96%</strong>
                  </div>
                </div>
              </div>

              {/* Team 2: Pakistan Navy (Flood Relief) */}
              <div
                className={`rqTeamRow ${chosenTeam?._id === (recItems[1]?.team?._id || "demo-team-2") ? "is-selected" : ""}`}
                onClick={() => setTeamId(recItems[1]?.team?._id || "demo-team-2")}
                role="button"
                tabIndex={0}
              >
                <div className="rqTeamEmblem navy">
                  <ShieldCheck size={17} />
                </div>
                <div className="rqTeamMeta">
                  <strong className="rqTeamName">Pakistan Navy (Flood Relief)</strong>
                  <span className="rqTeamCapabilities">Boats • High Capacity • 20 members</span>
                </div>
                <div className="rqTeamMetrics">
                  <div className="rqTeamDistance">
                    <MapPin size={11} /> 5.6 km <span className="rqEta">~ 14 min</span>
                  </div>
                  <div className="rqTeamMatchBadge">
                    <strong>89%</strong>
                  </div>
                </div>
              </div>

              {/* Team 3: Edhi Rescue Unit */}
              <div
                className={`rqTeamRow ${chosenTeam?._id === (recItems[2]?.team?._id || "demo-team-3") ? "is-selected" : ""}`}
                onClick={() => setTeamId(recItems[2]?.team?._id || "demo-team-3")}
                role="button"
                tabIndex={0}
              >
                <div className="rqTeamEmblem edhi">
                  <Truck size={17} />
                </div>
                <div className="rqTeamMeta">
                  <strong className="rqTeamName">Edhi Rescue Unit</strong>
                  <span className="rqTeamCapabilities">Medical • Evacuation • 10 members</span>
                </div>
                <div className="rqTeamMetrics">
                  <div className="rqTeamDistance">
                    <MapPin size={11} /> 6.1 km <span className="rqEta">~ 15 min</span>
                  </div>
                  <div className="rqTeamMatchBadge">
                    <strong>85%</strong>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </div>

        {/* Row 3: Assignment Action Panel matching wide green panel in Image 2 */}
        <section className="rqDetailCard rqDetailAssignmentPanel">
          <div className="rqAssignmentContent">
            {/* Left: Assign Rescue Team label */}
            <div className="rqAssignmentLeft">
              <div className="rqAssignIconWrap">
                <Users size={18} />
              </div>
              <span className="rqAssignTitle">Assign Rescue Team</span>
            </div>

            {/* Middle: Team Selector Pill */}
            <div className="rqAssignmentSelectorWrap">
              <div className="rqTeamSelectorPill">
                <span className="rqSelectorEmblem" />
                <span className="rqSelectorTeamName">
                  {chosenTeam?.name || "Karachi Rescue Team 1"}
                  {chosenTeam?.name?.includes("1") ? " (Best Match)" : ""}
                </span>
                <ChevronDown size={14} className="rqSelectorCaret" />
              </div>
            </div>

            {/* Right: Large Solid Green Action Button */}
            <div className="rqAssignmentActionWrap">
              <button
                type="button"
                className="rqAssignTeamSolidBtn"
                disabled={blocked && !readOnly}
                onClick={() => {
                  setConfirm({
                    kind: "assignment",
                    title: "Confirm Rescue Team Assignment",
                    detail: `Assign ${chosenTeam?.name || "Karachi Rescue Team 1"} to ${headline}? This notifies the response unit and coordinates mission parameters.`,
                  });
                }}
              >
                <Send size={15} />
                <span>Assign Team</span>
              </button>
              <span className="rqAssignFootnote">
                This will notify the team and share incident details.
              </span>
            </div>
          </div>
        </section>

        {/* Row 4: Timeline & Activity Log + Internal Notes */}
        <div className="rqGridAreaTimeline">
          <IncidentActivityTimeline
            incident={incident}
            assignments={model.assignments}
          />
        </div>

        {/* Row 5: Verification & Duplicate Review (Preserving Saba's features) */}
        <section className="rqDetailCard rqDetailVerification">
          <header className="rqCardHeader">
            <h2>
              <ShieldCheck size={16} /> Verification &amp; Duplicate Review
            </h2>
            <span className="rqDetailMicro">
              {verification?.status?.replaceAll("_", " ") || "Verified"}
            </span>
          </header>
          <details className="rqDetailVerificationDisclosure">
            <summary>
              {verification?.requiresManualReview ? "Manual review required · " : ""}
              {verification?.isPotentialDuplicate ? "Possible duplicates · " : ""}
              Review verification details
            </summary>
            <div className="rqDetailVerificationContent">
              {verification?.requiresManualReview && (
                <p className="rqDetailRiskAlert">
                  <AlertTriangle size={18} /> Manual coordinator review is required.
                </p>
              )}
              {Array.isArray(verification?.warnings) &&
                verification.warnings.length > 0 && (
                  <ul>
                    {verification.warnings.map((warning, index) => (
                      <li key={index}>{warning}</li>
                    ))}
                  </ul>
                )}
              {Array.isArray(verification?.missingFields) &&
                verification.missingFields.length > 0 && (
                  <p>Missing information: {verification.missingFields.join(", ")}</p>
                )}
              {Array.isArray(verification?.potentialDuplicateIncidents) &&
                verification.potentialDuplicateIncidents.length > 0 && (
                  <p>
                    Potential duplicate reports:{" "}
                    {verification.potentialDuplicateIncidents
                      .filter((dup) => typeof dup === "string")
                      .map((dup) => (
                        <Link
                          href={`/dashboard/incidents/${encodeURIComponent(dup)}${isDemoMode ? "?demo=true" : ""}`}
                          key={dup}
                        >
                          {dup}
                        </Link>
                      ))}
                  </p>
                )}
              {verification?.reviewNotes && (
                <p>
                  <strong>Latest review:</strong> {verification.reviewNotes}
                </p>
              )}
              {!readOnly ? (
                <form onSubmit={verify}>
                  <label>
                    Verification decision
                    <select
                      aria-label="Verification decision"
                      required
                      value={decision}
                      onChange={(e) =>
                        setDecision(e.target.value as VerificationStatus)
                      }
                      disabled={blocked}
                    >
                      <option value="">Choose a decision</option>
                      {["NEEDS_REVIEW", "VERIFIED", "FLAGGED_DUPLICATE", "DISMISSED"].map(
                        (v) => (
                          <option key={v} value={v}>
                            {v.replaceAll("_", " ")}
                          </option>
                        ),
                      )}
                    </select>
                  </label>
                  <label>
                    Review notes
                    <textarea
                      aria-label="Review notes"
                      required
                      minLength={3}
                      maxLength={1000}
                      rows={2}
                      value={reviewNotes}
                      onChange={(e) => setReviewNotes(e.target.value)}
                      disabled={blocked}
                    />
                  </label>
                  <button disabled={blocked} type="submit">
                    Record verification
                  </button>
                </form>
              ) : (
                <p>Verification actions are read-only for simulated demo records.</p>
              )}
            </div>
          </details>
        </section>

        {/* Row 6: Lifecycle status actions for non-read-only records */}
        {!readOnly && allowed.length > 0 && (
          <details className="rqDetailCard rqDetailLifecycleDisclosure" open={incident.status !== "PENDING"}>
            <summary>Other lifecycle actions</summary>
            <form
              className="rqDetailLifecycle"
              onSubmit={(event) => {
                event.preventDefault();
                if (allowed.includes(status as IncidentStatus)) {
                  setConfirm({
                    kind: "status",
                    title: "Confirm incident status change",
                    detail: `Change status to ${status.replaceAll("_", " ")}? The backend validates the transition.`,
                  });
                }
              }}
            >
              <label>
                New incident status
                <select
                  aria-label="New incident status"
                  required
                  disabled={blocked}
                  value={allowed.includes(status as IncidentStatus) ? status : ""}
                  onChange={(event) => setStatus(event.target.value as IncidentStatus)}
                >
                  <option value="">Choose a valid transition</option>
                  {allowed.map((value) => (
                    <option key={value} value={value}>
                      {value.replaceAll("_", " ")}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="submit"
                disabled={blocked || !allowed.includes(status as IncidentStatus)}
              >
                Confirm status change
              </button>
            </form>
          </details>
        )}
      </div>

      {/* Return to incidents link */}
      <Link href={listHref} className="rqDetailBack">
        <ArrowLeft size={15} /> Back to incidents
      </Link>

      {/* Confirmation modal */}
      <ConfirmationDialog
        open={!!confirm}
        title={confirm?.title || "Confirm action"}
        description={confirm?.detail || ""}
        confirmLabel={confirm?.kind === "assignment" ? "Assign Team" : "Confirm change"}
        busy={busy}
        error={model.actionError}
        onClose={() => setConfirm(null)}
        onConfirm={() => void confirmAction()}
      />
    </article>
  );
}
