"use client";

import { useState, type FormEvent } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  ChevronRight,
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

  const [teamId, setTeamId] = useState("");
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
        <div className="rqLoadingCard" />
        <div className="rqLoadingCard" />
        <p className="rqLoadingText">Loading incident command workspace…</p>
      </div>
    );
  }

  if (!incident || (incident._id !== id && !id.startsWith("INC-"))) {
    return (
      <section className="rqIncidentWorkspace rqDetailFailure">
        <AlertTriangle size={36} className="rqFailureIcon" />
        <h1>Incident unavailable</h1>
        <p role="alert">{model.error || "Incident not found. It may have been removed or the reference is incorrect."}</p>
        <div className="rqFailureActions">
          <button type="button" onClick={model.reload} className="rqRetryBtn">
            Retry incident
          </button>
          <Link href={listHref} className="rqBackLink">
            Return to incidents
          </Link>
        </div>
      </section>
    );
  }

  const readOnly = isDemoMode || incident.isSimulated;
  const isAssigned = incident.status !== "PENDING" || !!incident.assignedTeam;
  const canAdjust = !readOnly && !["RESOLVED", "CANCELLED"].includes(incident.status);

  // Recommended rescue teams from API
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

  const effectiveTeamId = teamId || availableTeams[0]?._id || "";
  const chosenTeam =
    availableTeams.find((team) => team._id === effectiveTeamId) ||
    availableTeams[0];

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
    if (confirm.kind === "assignment" && chosenTeam && (!isAssigned || readOnly)) {
      if (readOnly) {
        setValidation("");
        model.reload();
        setConfirm(null);
        return;
      }
      success = await model.mutate(
        () => assignmentApi.create({ incidentId: id, teamId: chosenTeam._id }),
        "Team assignment recorded in ResQLink. Field status updated.",
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

  // Authoritative severity badge styling
  const priorityLevel = incident.priorityLevel || "LOW";
  const priorityClass = priorityLevel.toLowerCase();

  // Authoritative Headline
  const typeLabel = incidentTitle(incident);
  const locationLabel = incident.location?.address;
  const headline = locationLabel ? `${typeLabel} — ${locationLabel}` : typeLabel;

  return (
    <article className="rqIncidentWorkspace">
      {/* Read-Only Demo Mode Banner */}
      {readOnly && (
        <div className="rqDemoBanner" role="status" style={{ background: "rgba(38,132,255,0.12)", border: "1px solid rgba(38,132,255,0.3)", color: "var(--navy-blue)", padding: "8px 14px", borderRadius: 8, marginBottom: 12, fontWeight: 600 }}>
          Simulation / Prototype · Read-only incident
        </div>
      )}

      {/* 1. Breadcrumb navigation */}
      <nav className="rqDetailBreadcrumb" aria-label="Breadcrumb">
        <Link href={listHref}>Incidents</Link>
        <ChevronRight size={13} className="rqBreadcrumbChevron" />
        <span className="rqCurrentBreadcrumb">{id}</span>
      </nav>

      {/* 2. Incident Header */}
      <header className="rqIncidentHeader rqDetailHero">
        <div className="rqHeaderTopRow">
          <div className="rqHeaderLeft">
            <span className={`rqSeverityBadgeOutline is-${priorityClass}`}>
              <AlertTriangle size={15} className="rqSeverityIcon" />
              <span>{priorityLevel}</span>
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
                  setTimeout(() => setCopied(""), 3500);
                } catch {
                  setCopied("Link ready in address bar.");
                  setTimeout(() => setCopied(""), 3500);
                }
              }}
            >
              <Share2 size={14} />
              <span>Share Link</span>
            </button>
            <button
              type="button"
              className="rqMoreOptionsBtn"
              aria-label="Refresh incident details"
              onClick={() => model.reload()}
              title="Refresh"
            >
              <MoreHorizontal size={17} />
            </button>
          </div>
        </div>

        {/* Subtitle metadata row */}
        <div className="rqHeaderMetaRow">
          <span className="rqMetaItem font-mono">{id}</span>
          <span className="rqMetaBullet">•</span>
          <span className="rqMetaItem">
            <MapPin size={12} className="inline mr-1" />
            {incident.location?.address || "Address not reported"}
          </span>
          <span className="rqMetaBullet">•</span>
          <span className="rqMetaItem">{formatIncidentDate(incident.createdAt)}</span>
          <span className="rqMetaBullet">•</span>
          <span className="rqMetaItem">Source: {incident.reporterName || "Direct portal"}</span>
          <span className="rqMetaBullet">•</span>
          <span className="rqMetaItem rqHeroVerification">{verification?.status?.replaceAll("_", " ") || "VERIFIED"}</span>
        </div>
      </header>

      {/* Temporary feedback banner */}
      {copied && <div role="status" className="rqDetailToast">{copied}</div>}
      {model.uncertain && (
        <label className="rqOperationsAck" style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", background: "var(--navy-amber-bg)", border: "1px solid var(--navy-amber-border)", borderRadius: 6, color: "var(--navy-amber)", marginBottom: 12 }}>
          <input
            type="checkbox"
            checked={model.acknowledged}
            onChange={(e) => model.setAcknowledged(e.target.checked)}
          />
          I reviewed current records and understand a retry could repeat this change.
        </label>
      )}
      {model.error && (
        <div role="alert" className="rqDetailNotice is-error">
          <span>Failed to refresh records: {model.error}</span>
          <button type="button" onClick={model.reload} className="rqNoticeAction">Retry incident</button>
        </div>
      )}
      {model.feedback && (
        <div role="status" className="rqDetailNotice is-success">
          <CheckCircle2 size={15} />
          <span>{model.feedback}</span>
        </div>
      )}
      {(model.actionError || validation) && (
        <div role="alert" className="rqDetailNotice is-error">
          <AlertTriangle size={15} />
          <span>{validation || model.actionError}</span>
        </div>
      )}

      {/* 3. Main Dashboard CSS Grid */}
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
                <h2>Adjust Incident Priority</h2>
              </header>
              <form
                className="rqAdjustForm"
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
                    title: "Confirm Priority Override",
                    detail: `Change priority level to ${priority}? This will update the authoritative incident record and activity log.`,
                  });
                }}
              >
                <div className="rqFormGroup">
                  <label htmlFor="priority-select">New priority</label>
                  <select
                    id="priority-select"
                    aria-label="New priority"
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as PriorityLevel)}
                    className="rqSelectInput"
                  >
                    {["CRITICAL", "HIGH", "MEDIUM", "LOW"].map((v) => (
                      <option key={v} value={v}>{v}</option>
                    ))}
                  </select>
                </div>
                <div className="rqFormGroup">
                  <label htmlFor="override-reason">Override explanation</label>
                  <textarea
                    id="override-reason"
                    aria-label="Override explanation"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    minLength={5}
                    maxLength={1000}
                    placeholder="Enter operational rationale for priority modification..."
                    required
                    rows={2}
                    className="rqTextareaInput"
                  />
                </div>
                <div className="rqFormBtnRow">
                  <button
                    disabled={blocked}
                    type="submit"
                    className="rqFormSubmitBtn"
                  >
                    Review priority change
                  </button>
                  <button
                    type="button"
                    onClick={() => setAdjusting(false)}
                    className="rqFormCancelBtn"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </section>
          )}
        </div>

        {/* Row 2 Middle (~28%): Affected People & Vulnerability */}
        <div className="rqGridAreaVuln">
          <IncidentVulnerabilityCard incident={incident} />
        </div>

        {/* Row 2 Right (~30%): Incident Status & Recommended Teams */}
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
              {recItems.length > 0 ? (
                <ul className="rqDetailRecommendations" style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 6 }}>
                  {recItems.map((item) => {
                    const team = item.team;
                    const isSelected = chosenTeam?._id === team._id;
                    const caps = Array.isArray(team.capabilities)
                      ? team.capabilities.map((c) => c.replaceAll("_", " ")).join(" • ")
                      : "Rescue Unit";

                    return (
                      <li key={team._id}>
                        <button
                          type="button"
                          className={`rqTeamRow ${isSelected ? "is-selected" : ""}`}
                          onClick={() => setTeamId(team._id)}
                          style={{ width: "100%", textAlign: "left", background: "none", border: "1px solid var(--navy-subsurface-border)" }}
                        >
                          <div className="rqTeamEmblem">
                            <Truck size={16} />
                          </div>
                          <div className="rqTeamMeta">
                            <strong className="rqTeamName">{team.name}</strong>
                            <span className="rqTeamCapabilities">
                              {caps} • Capacity: {team.capacity}
                            </span>
                          </div>
                          <div className="rqTeamMetrics">
                            <span className="rqTeamDistance">
                              <MapPin size={11} /> {item.approximateDistanceKm.toFixed(1)} km
                            </span>
                            {item.capacityWarning && (
                              <span className="rqCapacityWarningTag" title={item.capacityWarning}>
                                Capacity Limit
                              </span>
                            )}
                          </div>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <div className="rqNoTeamsBox">
                  <Truck size={24} className="rqNoTeamsIcon" />
                  <p className="rqNoTeamsText">No eligible rescue teams are currently available.</p>
                  <Link href="/dashboard/rescue-teams" className="rqNoTeamsLink">
                    Check rescue teams registry
                  </Link>
                </div>
              )}
            </div>
          </section>
        </div>

        {/* Row 3: Assignment Action Panel */}
        <section className={`rqDetailCard rqDetailAssignmentPanel rqDetailAssignment ${isAssigned ? "is-assigned-state" : ""}`}>
          {isAssigned ? (
            <div className="rqAssignedSummary">
              <div className="rqAssignedIconWrap">
                <CheckCircle2 size={20} />
              </div>
              <div className="rqAssignedDetails">
                <strong className="rqAssignedTitle">
                  Assigned to: {assignedTeam?.name || "Dispatched Rescue Team"}
                </strong>
                <span className="rqAssignedSub">
                  Lifecycle status: <strong>{incident.status.replaceAll("_", " ")}</strong>. Active operations in progress.
                </span>
              </div>
              {assignedTeam?.location?.address && (
                <span className="rqAssignedBase">
                  Base: {assignedTeam.location.address}
                </span>
              )}
            </div>
          ) : (
            <div className="rqAssignmentContent">
              <div className="rqAssignmentLeft">
                <div className="rqAssignIconWrap">
                  <Users size={18} />
                </div>
                <div className="rqAssignTitles">
                  <span className="rqAssignTitle">Assign Rescue Team</span>
                  <span className="rqAssignSubtitle">Deploy units to coordinate response</span>
                </div>
              </div>

              <div className="rqAssignmentSelectorWrap">
                <label htmlFor="team-assign-select" className="sr-only">
                  Select available rescue team
                </label>
                <select
                  id="team-assign-select"
                  aria-label="Select rescue team"
                  value={chosenTeam?._id || ""}
                  onChange={(e) => setTeamId(e.target.value)}
                  className="rqTeamSelectDropdown rqDetailAssignmentSelect"
                  disabled={blocked || availableTeams.length === 0}
                >
                  {availableTeams.length > 0 ? (
                    availableTeams.map((t) => (
                      <option key={t._id} value={t._id}>
                        {t.name} ({t.teamCode}) — Capacity: {t.capacity}
                      </option>
                    ))
                  ) : (
                    <option value="">No available teams to assign</option>
                  )}
                </select>
              </div>

              <div className="rqAssignmentActionWrap">
                {!readOnly && (
                  <button
                    type="button"
                    className="rqAssignTeamSolidBtn"
                    disabled={blocked || !chosenTeam}
                    onClick={() => {
                      if (!chosenTeam) return;
                      setConfirm({
                        kind: "assignment",
                        title: "Confirm Rescue Team Assignment",
                        detail: `Assign ${chosenTeam.name} to this incident? Records the selected rescue team's assignment in ResQLink.`,
                      });
                    }}
                  >
                    <Send size={15} />
                    <span>Assign Team</span>
                  </button>
                )}
                <span className="rqAssignFootnote">
                  Records the selected rescue team&apos;s assignment in ResQLink.
                </span>
              </div>
            </div>
          )}
        </section>

        {/* Row 4: Timeline & Activity Log */}
        <div className="rqGridAreaTimeline">
          <IncidentActivityTimeline
            incident={incident}
            assignments={model.assignments}
          />
          <div className="rqTimelineNotesAction" style={{ padding: "6px 16px 12px", display: "flex", justifyContent: "flex-end" }}>
            <button
              type="button"
              disabled
              className="rqPostNoteDisabledBtn"
              title="Operational notes are recorded through Verification Review"
              style={{ opacity: 0.55, cursor: "not-allowed", fontSize: 11, fontWeight: 600, padding: "5px 12px", background: "var(--navy-subsurface)", border: "1px solid var(--navy-card-border)", color: "var(--navy-muted)", borderRadius: 6 }}
            >
              Post Note
            </button>
          </div>
        </div>

        {/* Row 5: Verification & Duplicate Review */}
        <section className="rqDetailCard rqDetailVerification">
          <header className="rqCardHeader">
            <h2>
              <ShieldCheck size={16} /> Verification &amp; Duplicate Review
            </h2>
            <span className="rqDetailMicro">
              {verification?.status?.replaceAll("_", " ") || "VERIFIED"}
            </span>
          </header>
          <details className="rqDetailVerificationDisclosure">
            <summary className="rqVerificationSummary">
              Review verification details
            </summary>
            <div className="rqDetailVerificationContent">
              {verification?.requiresManualReview && (
                <p className="rqDetailRiskAlert">
                  <AlertTriangle size={18} /> Manual coordinator review is required for this report.
                </p>
              )}
              {Array.isArray(verification?.warnings) &&
                verification.warnings.length > 0 && (
                  <ul className="rqVerificationWarningList">
                    {verification.warnings.map((warning, index) => (
                      <li key={index}>{warning}</li>
                    ))}
                  </ul>
                )}
              {Array.isArray(verification?.missingFields) &&
                verification.missingFields.length > 0 && (
                  <p className="rqMissingFieldsNote">
                    Missing required fields: <strong>{verification.missingFields.join(", ")}</strong>
                  </p>
                )}
              {Array.isArray(verification?.potentialDuplicateIncidents) &&
                verification.potentialDuplicateIncidents.length > 0 && (
                  <p className="rqDuplicatesNote">
                    Potential duplicate reports:{" "}
                    {verification.potentialDuplicateIncidents
                      .filter((dup) => typeof dup === "string")
                      .map((dup) => (
                        <Link
                          href={`/dashboard/incidents/${encodeURIComponent(dup)}${isDemoMode ? "?demo=true" : ""}`}
                          key={dup}
                          className="rqDupLink"
                        >
                          #{dup.slice(-6)}
                        </Link>
                      ))}
                  </p>
                )}
              {verification?.reviewNotes && (
                <p className="rqLatestReviewNote">
                  <strong>Latest Review Notes:</strong> {verification.reviewNotes}
                </p>
              )}
              {!readOnly ? (
                <form onSubmit={verify} className="rqVerificationForm">
                  <div className="rqFormRow">
                    <label htmlFor="verify-decision">Verification decision</label>
                    <select
                      id="verify-decision"
                      aria-label="Verification decision"
                      required
                      value={decision}
                      onChange={(e) =>
                        setDecision(e.target.value as VerificationStatus)
                      }
                      disabled={blocked}
                      className="rqSelectInput"
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
                  </div>
                  <div className="rqFormRow flex-grow">
                    <label htmlFor="verify-notes">Review notes</label>
                    <textarea
                      id="verify-notes"
                      aria-label="Review notes"
                      required
                      minLength={3}
                      maxLength={1000}
                      rows={2}
                      placeholder="Add coordinator review notes..."
                      value={reviewNotes}
                      onChange={(e) => setReviewNotes(e.target.value)}
                      disabled={blocked}
                      className="rqTextareaInput"
                    />
                  </div>
                  <button
                    disabled={blocked}
                    type="submit"
                    className="rqVerifySubmitBtn"
                  >
                    Record verification
                  </button>
                </form>
              ) : (
                <p className="rqReadOnlyNotice">
                  Verification review is read-only for simulated demo records.
                </p>
              )}
            </div>
          </details>
        </section>

        {/* Row 6: Lifecycle status actions (Full Width Row, Never Squeezed!) */}
        {!readOnly && allowed.length > 0 && (
          <section className="rqDetailCard rqDetailLifecycleCard">
            <header className="rqCardHeader">
              <h2>Incident Lifecycle Transitions</h2>
              <span className="rqDetailMicro">Current: {incident.status}</span>
            </header>
            <div className="rqLifecycleBody">
              <form
                className="rqDetailLifecycleForm"
                onSubmit={(event) => {
                  event.preventDefault();
                  if (allowed.includes(status as IncidentStatus)) {
                    setConfirm({
                      kind: "status",
                      title: "Confirm Status Transition",
                      detail: `Advance incident status to ${status.replaceAll("_", " ")}? The server will validate the operational transition.`,
                    });
                  }
                }}
              >
                <div className="rqLifecycleInputGroup">
                  <label htmlFor="lifecycle-status-select" className="rqLifecycleLabel">
                    New incident status
                  </label>
                  <select
                    id="lifecycle-status-select"
                    aria-label="New incident status"
                    required
                    disabled={blocked}
                    value={allowed.includes(status as IncidentStatus) ? status : ""}
                    onChange={(event) => setStatus(event.target.value as IncidentStatus)}
                    className="rqSelectInput rqLifecycleSelect"
                  >
                    <option value="">Choose a valid transition</option>
                    {allowed.map((value) => (
                      <option key={value} value={value}>
                        {value.replaceAll("_", " ")}
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  type="submit"
                  disabled={blocked || !allowed.includes(status as IncidentStatus)}
                  className="rqLifecycleSubmitBtn"
                >
                  Confirm status change
                </button>
              </form>
            </div>
          </section>
        )}
      </div>

      {/* Return to incidents link */}
      <footer className="rqDetailFooter">
        <Link href={listHref} className="rqDetailBack">
          <ArrowLeft size={15} /> Back to incidents
        </Link>
      </footer>

      {/* Confirmation modal */}
      <ConfirmationDialog
        open={!!confirm}
        title={confirm?.title || "Confirm action"}
        description={confirm?.detail || ""}
        confirmLabel={confirm?.kind === "assignment" ? "Confirm assignment" : "Confirm change"}
        busy={busy}
        error={model.actionError}
        onClose={() => setConfirm(null)}
        onConfirm={() => void confirmAction()}
      />
    </article>
  );
}
