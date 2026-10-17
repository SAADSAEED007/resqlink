"use client";
import { useState, type FormEvent } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { AlertTriangle, ArrowLeft, ChevronRight, Copy, RefreshCw, Send, ShieldCheck, Truck, Users } from "lucide-react";
import type { IncidentStatus, PriorityLevel, VerificationStatus } from "@/types/api";
import { incidents } from "@/lib/api/incidents";
import { assignments as assignmentApi } from "@/lib/api/assignments";
import { ConfirmationDialog } from "@/components/ui";
import { incidentTitle } from "../incident-visual";
import { useIncidentWorkspace } from "./use-incident-workspace";
import { IncidentInformationCard, IncidentPriorityCard, IncidentVulnerabilityCard, IncidentStatusTracker, IncidentActivityTimeline, IncidentNotesPanel, formatIncidentDate } from "./IncidentFactCards";
import { IncidentLocationMap } from "./IncidentLocationMap";
import "./incident-detail.css";

const transitions: Record<IncidentStatus, IncidentStatus[]> = { PENDING: ["CANCELLED"], ASSIGNED: ["IN_PROGRESS", "CANCELLED"], IN_PROGRESS: ["RESOLVED"], RESOLVED: [], CANCELLED: [] };
type Confirmation = { kind: "assignment" | "status" | "priority"; title: string; detail: string };

export function IncidentWorkspace() {
  const { id } = useParams<{ id: string }>();
  return <IncidentWorkspaceContent key={id} id={id}/>;
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
  if (model.loading && !incident) return <div className="rqIncidentWorkspace rqDetailLoading" role="status"><div/><div/><div/><p>Loading incident command workspace…</p></div>;
  if (!incident || incident._id !== id) return <section className="rqIncidentWorkspace rqDetailFailure"><AlertTriangle size={32}/><h1>Incident unavailable</h1><p role="alert">{model.error || "Incident not found."}</p><button onClick={model.reload}>Retry incident</button><Link href={listHref}>Return to incidents</Link></section>;
  const readOnly = isDemoMode || incident.isSimulated;
  const pending = incident.status === "PENDING" && !incident.assignedTeam;
  const canAdjust = !readOnly && !["RESOLVED", "CANCELLED"].includes(incident.status);
  const recItems = Array.isArray(model.recommendations?.items) ? model.recommendations.items.filter(item => item?.team?._id) : [];
  const recommendedTeams = recItems.map(item => item.team);
  const availableTeams = [...recommendedTeams, ...model.teams].filter((team, index, all) => all.findIndex(item => item._id === team._id) === index && team.status === "AVAILABLE" && !team.currentIncident && team.isSimulated === incident.isSimulated && !model.teams.some(current => current._id === team._id && (current.status !== "AVAILABLE" || !!current.currentIncident)));
  const chosenTeam = availableTeams.find(team => team._id === teamId);
  const assignedTeam = model.teams.find(team => team._id === incident.assignedTeam);
  const allowed = transitions[incident.status] ?? [];
  const verification = incident.verification;
  const normalized = (value: string) => value.trim().replace(/\s+/g, " ");
  function verify(event: FormEvent) {
    event.preventDefault();
    const notes = normalized(reviewNotes);
    if (!decision || notes.length < 3 || notes.length > 1000 || /[<>]/.test(notes)) { setValidation("Choose a decision and use 3–1,000 characters for review notes, without angle brackets."); return; }
    setValidation("");
    void model.mutate(() => incidents.updateVerification(id, decision, notes), "Verification review recorded.");
  }
  async function confirmAction() {
    if (!confirm || blocked) return;
    let success = false;
    if (confirm.kind === "assignment" && chosenTeam && pending)
      success = await model.mutate(() => assignmentApi.create({ incidentId: id, teamId: chosenTeam._id }), "Team assignment recorded in the prototype. No official emergency dispatch performed.");
    if (confirm.kind === "status" && allowed.includes(status as IncidentStatus))
      success = await model.mutate(() => incidents.updateStatus(id, status as IncidentStatus), "Incident status updated.");
    if (confirm.kind === "priority" && canAdjust)
      success = await model.mutate(() => incidents.overridePriority(id, priority, normalized(reason)), "Coordinator priority override recorded.");
    if (success) { setConfirm(null); setAdjusting(false); }
  }
  return <article className={`rqIncidentWorkspace priority-${incident.priorityLevel.toLowerCase()}`}>
    <nav className="rqDetailBreadcrumb" aria-label="Breadcrumb"><Link href={listHref}>Incidents</Link><ChevronRight size={14}/><span>{id}</span></nav>
    <header className="rqDetailHero"><span className={`rqDetailSeverity ${incident.priorityLevel.toLowerCase()}`}><AlertTriangle size={20}/>{incident.priorityLevel}</span><div><h1>{incidentTitle(incident)}{incident.location?.address ? ` — ${incident.location.address}` : " — Reported Emergency"}</h1><p><span>{id}</span><span>{formatIncidentDate(incident.createdAt)} · PKT</span><span><ShieldCheck size={13}/>{verification?.status?.replaceAll("_", " ") || "Verification not recorded"}</span></p></div><button className="rqDetailCopy" onClick={async () => { try { await navigator.clipboard.writeText(window.location.href); setCopied("Internal incident link copied. Coordinator sign-in is required."); } catch { setCopied("Copy is unavailable. You can copy the incident URL from the address bar."); } }}><Copy size={15}/>Copy internal link</button></header>
    <div className="rqDetailMode"><span>{readOnly ? "Simulation / Prototype · Read-only incident" : "API record · Prototype decision support · Human confirmation required"}</span><button disabled={busy} onClick={model.reload}><RefreshCw size={13}/>Refresh incident</button></div>
    {copied && <p role="status" className="rqDetailNotice">{copied}</p>}
    {model.error && <p role="alert" className="rqDetailNotice">Current refresh failed: {model.error} <button onClick={model.reload}>Retry</button></p>}
    {model.feedback && <p role="status" className="rqDetailNotice is-success">{model.feedback}</p>}
    {(model.actionError || validation) && <p role="alert" className="rqDetailNotice is-error">{validation || model.actionError}</p>}
    {model.uncertain && <label className="rqDetailNotice"><input type="checkbox" checked={model.acknowledged} onChange={event => model.setAcknowledged(event.target.checked)}/> I reviewed current records and understand a retry could repeat this change. <button onClick={model.reload}>Reload current incident</button></label>}
    <div className="rqDetailGrid">
      <IncidentInformationCard incident={incident}/>
      <IncidentLocationMap incident={incident} teams={assignedTeam ? [assignedTeam] : recommendedTeams}/>
      <div className="rqDetailRiskColumn"><IncidentPriorityCard incident={incident} onAdjust={canAdjust ? () => setAdjusting(!adjusting) : undefined}/>
        {adjusting && <section className="rqDetailCard rqDetailForm"><header><h2>Adjust Priority</h2></header><form onSubmit={event => { event.preventDefault(); const text = normalized(reason); if (text.length < 5 || text.length > 1000 || /[<>]/.test(text)) { setValidation("Use 5–1,000 characters for the override explanation, without angle brackets."); return; } setValidation(""); setConfirm({ kind: "priority", title: "Confirm priority override", detail: `Change this incident to ${priority}. The backend records your explanation and recalibrates its score.` }); }}><label>New priority<select aria-label="New priority" value={priority} onChange={event => setPriority(event.target.value as PriorityLevel)}>{["CRITICAL", "HIGH", "MEDIUM", "LOW"].map(value => <option key={value}>{value}</option>)}</select></label><label>Override explanation<textarea aria-label="Override explanation" value={reason} onChange={event => setReason(event.target.value)} minLength={5} maxLength={1000} required rows={2}/></label><button disabled={blocked} type="submit">Review priority change</button></form></section>}
      </div>
      <IncidentVulnerabilityCard incident={incident}/>
      <div className="rqDetailResponseColumn"><IncidentStatusTracker incident={incident}/>
        <section className="rqDetailCard rqDetailRecommendations"><header><h2>Recommended Rescue Teams</h2><button onClick={model.reload} disabled={busy} aria-label="Refresh team recommendations"><RefreshCw size={14}/></button></header>
          {readOnly ? <p className="rqDetailFootnote">Demo actions are read-only. No recommendation request is sent for simulated IDs.</p> : !pending ? <p className="rqDetailFootnote">{incident.assignedTeam ? `Assigned team: ${assignedTeam?.name || incident.assignedTeam}` : "Recommendations are available for pending, unassigned incidents."}</p> : model.recommendationError ? <p role="alert" className="rqDetailFootnote">{model.recommendationError} <button onClick={model.reload}>Retry recommendations</button></p> : recItems.length ? <ul>{recItems.map(item => <li key={item.team._id}><button disabled={blocked || !availableTeams.some(team => team._id === item.team._id)} aria-pressed={teamId === item.team._id} onClick={() => setTeamId(item.team._id)}><i><Truck size={21}/></i><div><strong>{item.team.name}</strong><small>{item.team.teamCode} · {Array.isArray(item.team.capabilities) ? item.team.capabilities.filter(value => typeof value === "string").join(" · ").replaceAll("_", " ") : "Capabilities not reported"}</small><span>{typeof item.approximateDistanceKm === "number" && Number.isFinite(item.approximateDistanceKm) ? `${item.approximateDistanceKm} km straight-line` : "Distance unavailable"} · {item.team.status}</span>{item.capacityWarning && <small className="rqDetailCapacityWarning">{item.capacityWarning}</small>}</div><span className="rqDetailSelectLabel">{teamId === item.team._id ? "Selected" : "Select"}</span></button></li>)}</ul> : <p className="rqDetailFootnote">No eligible rescue teams are currently available.{model.recommendations?.message ? ` ${model.recommendations.message}` : ""}</p>}
          <p className="rqDetailFootnote">Capability and location rules · no travel-time estimate.</p>
        </section>
        <IncidentNotesPanel/>
      </div>
      <section className="rqDetailCard rqDetailAssignment"><header><h2><Users size={17}/>Assignment Action</h2></header>{readOnly ? <p className="rqDetailFootnote">Demo records are read-only. No assignment or status request will be sent.</p> : pending ? <form onSubmit={event => { event.preventDefault(); if (!chosenTeam) { setValidation("Select an available rescue team."); return; } setValidation(""); setConfirm({ kind: "assignment", title: "Confirm rescue team assignment", detail: `Assign ${chosenTeam.name} to this incident? This records the assignment in the ResQLink prototype; no official dispatch or notification is promised.` }); }}><label>Assign Rescue Team<select aria-label="Assign Rescue Team" value={chosenTeam ? teamId : ""} onChange={event => setTeamId(event.target.value)} disabled={blocked} required><option value="">Choose an available team</option>{availableTeams.map(team => <option key={team._id} value={team._id}>{team.name} · {team.teamCode} · capacity {team.capacity ?? "unknown"}</option>)}</select></label><div><button type="submit" className="rqDetailAssignButton" disabled={blocked || !chosenTeam}><Send size={17}/>{busy ? "Recording…" : "Assign Team"}</button><small>This records the assignment in the ResQLink prototype.</small></div></form> : <p className="rqDetailFootnote">{incident.assignedTeam ? `Active assignment: ${assignedTeam?.name || incident.assignedTeam}.` : "This incident is closed; no new assignment is available."} Reassignment is not supported by the current incident workflow.</p>}
        {!readOnly && allowed.length > 0 && <details className="rqDetailLifecycleDisclosure" open={incident.status !== "PENDING"}><summary>Other lifecycle actions</summary><form className="rqDetailLifecycle" onSubmit={event => { event.preventDefault(); if (allowed.includes(status as IncidentStatus)) setConfirm({ kind: "status", title: "Confirm incident status change", detail: `Change status to ${status.replaceAll("_", " ")}? The backend validates the transition and updates the assignment and team where applicable.` }); }}><label>New incident status<select aria-label="New incident status" required disabled={blocked} value={allowed.includes(status as IncidentStatus) ? status : ""} onChange={event => setStatus(event.target.value as IncidentStatus)}><option value="">Choose a valid transition</option>{allowed.map(value => <option key={value} value={value}>{value.replaceAll("_", " ")}</option>)}</select></label><button type="submit" disabled={blocked || !allowed.includes(status as IncidentStatus)}>Confirm status change</button></form></details>}
      </section>
      <section className="rqDetailCard rqDetailVerification"><header><h2><ShieldCheck size={16}/>Verification &amp; Duplicate Review</h2><span className="rqDetailMicro">{verification?.status?.replaceAll("_", " ") || "Not recorded"}</span></header><details className="rqDetailVerificationDisclosure"><summary>{verification?.requiresManualReview ? "Manual review required · " : ""}{verification?.isPotentialDuplicate ? "Possible duplicates · " : ""}Review verification details</summary><div className="rqDetailVerificationContent">
        {verification?.requiresManualReview && <p className="rqDetailRiskAlert"><AlertTriangle size={18}/>Manual coordinator review is required.</p>}
        {Array.isArray(verification?.warnings) && verification.warnings.length > 0 && <ul>{verification.warnings.map((warning, index) => <li key={index}>{warning}</li>)}</ul>}
        {Array.isArray(verification?.missingFields) && verification.missingFields.length > 0 && <p>Missing information: {verification.missingFields.join(", ")}</p>}
        {Array.isArray(verification?.potentialDuplicateIncidents) && verification.potentialDuplicateIncidents.length > 0 && <p>Potential duplicate reports: {verification.potentialDuplicateIncidents.filter(duplicate => typeof duplicate === "string").map(duplicate => <Link href={`/dashboard/incidents/${encodeURIComponent(duplicate)}${isDemoMode ? "?demo=true" : ""}`} key={duplicate}>{duplicate}</Link>)}</p>}
        {verification?.reviewNotes && <p><strong>Latest review:</strong> {verification.reviewNotes}</p>}
        {!readOnly ? <form onSubmit={verify}><label>Verification decision<select aria-label="Verification decision" required value={decision} onChange={event => setDecision(event.target.value as VerificationStatus)} disabled={blocked}><option value="">Choose a decision</option>{["NEEDS_REVIEW", "VERIFIED", "FLAGGED_DUPLICATE", "DISMISSED"].map(value => <option key={value} value={value}>{value.replaceAll("_", " ")}</option>)}</select></label><label>Review notes<textarea aria-label="Review notes" required minLength={3} maxLength={1000} rows={2} value={reviewNotes} onChange={event => setReviewNotes(event.target.value)} disabled={blocked}/></label><button disabled={blocked} type="submit">Record verification</button></form> : <p>Verification actions are read-only for this simulated incident.</p>}
      </div></details></section>
      <IncidentActivityTimeline incident={incident} assignments={model.assignments}/>
    </div>
    <Link href={listHref} className="rqDetailBack"><ArrowLeft size={15}/>Back to incidents</Link>
    <ConfirmationDialog open={!!confirm} title={confirm?.title || "Confirm action"} description={confirm?.detail || ""} confirmLabel={confirm?.kind === "assignment" ? "Confirm assignment" : "Confirm change"} busy={busy} error={model.actionError} onClose={() => setConfirm(null)} onConfirm={() => void confirmAction()}/>
  </article>;
}
