import { AlertTriangle, Baby, Clock3, FileText, HeartPulse, Flame, MapPin, ShieldCheck, Users, Accessibility, Waves, UserRound, type LucideIcon } from "lucide-react";
import type { Incident, Assignment } from "@/types/api";
import { IncidentVisual, incidentTitle } from "../incident-visual";

export function formatIncidentDate(value?: string | null) {
  if (!value || !Number.isFinite(new Date(value).getTime())) return "Time not recorded";
  return new Intl.DateTimeFormat("en-PK", { timeZone: "Asia/Karachi", month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}
export function IncidentNotesPanel() {
  return <section className="rqDetailCard rqDetailNotes"><header><h2>Internal Notes</h2></header><p>Shared incident notes are not available yet. Verification review notes can be recorded in the review panel.</p><label>Add an internal note<textarea disabled placeholder="Persistent incident notes are unavailable" rows={1}/></label><button disabled>Post Note</button></section>;
}
const count = (value: unknown) => typeof value === "number" && Number.isFinite(value) && value >= 0 ? value.toLocaleString("en-PK") : "Not reported";
function Fact({ icon: Icon, label, children }: { icon: LucideIcon; label: string; children: React.ReactNode }) {
  return <div className="rqDetailFact"><i><Icon size={19}/></i><div><dt>{label}</dt><dd>{children}</dd></div></div>;
}
export function IncidentInformationCard({ incident }: { incident: Incident }) {
  return <section className="rqDetailCard rqDetailInformation"><header><h2>Incident Details</h2><span className="rqDetailMicro">{incident.isSimulated ? "Illustrative demo record" : "Reported record"}</span></header><div className="rqDetailInformationGrid"><dl>
    <Fact icon={incident.emergencyType === "FLOOD" ? Waves : incident.emergencyType === "MEDICAL" ? HeartPulse : incident.emergencyType === "FIRE" ? Flame : AlertTriangle} label="Emergency type">{incidentTitle(incident)}</Fact>
    <Fact icon={MapPin} label="Location">{incident.location?.address || "Location verification required"}</Fact>
    <Fact icon={Clock3} label="Reported">{formatIncidentDate(incident.createdAt)}<small>Pakistan time · PKT</small></Fact>
    <Fact icon={UserRound} label="Reported by">{incident.reporterName || "Not recorded"}<small>Reporting channel not recorded</small></Fact>
  </dl><div className="rqDetailMedia"><IncidentVisual incident={incident} variant="hero" />{!incident.isSimulated && <p>No attached media supplied<br/><small>Emergency category illustration</small></p>}</div></div><p className="rqDetailDescription">{incident.description || "Description not provided."}</p></section>;
}
export function IncidentPriorityCard({ incident, onAdjust }: { incident: Incident; onAdjust?: () => void }) {
  const score = typeof incident.priorityScore === "number" && Number.isFinite(incident.priorityScore) ? incident.priorityScore : null;
  const latest = Array.isArray(incident.priorityOverrides) ? incident.priorityOverrides.at(-1) : null;
  return <section className={`rqDetailCard rqDetailPriority priority-${incident.priorityLevel.toLowerCase()}`}><header><h2>Risk Assessment &amp; Priority</h2><span className="rqDetailPill">{incident.priorityLevel} PRIORITY</span></header><div className="rqDetailRiskGrid"><div className="rqDetailGauge" role="img" aria-label={score === null ? `${incident.priorityLevel} priority, numeric score unavailable` : `Priority score ${score} out of 100`}><svg viewBox="0 0 120 120" aria-hidden="true"><circle cx="60" cy="60" r="48" className="rqDetailGaugeTrack"/><circle cx="60" cy="60" r="48" pathLength="100" strokeDasharray={`${score === null ? 0 : Math.max(0, Math.min(100, score))} 100`} className="rqDetailGaugeValue"/></svg><div><strong>{score ?? incident.priorityLevel}</strong><small>{score === null ? "Priority level" : "/ 100 points"}</small></div></div><div><div className="rqDetailRiskLabel"><h3>Why this priority?</h3><span>Rule-based assessment</span></div><ul className="rqDetailReasons">{Array.isArray(incident.priorityReasons) && incident.priorityReasons.length ? incident.priorityReasons.filter(reason => typeof reason === "string").map((reason, index) => <li key={index}><ShieldCheck size={16}/><span>{reason}</span></li>) : <li>Priority reasons were not supplied.</li>}</ul></div></div>{latest && <p className="rqDetailOverrideNote"><strong>Coordinator override:</strong> {latest.reason} · {formatIncidentDate(latest.timestamp)}. Original risk factors remain shown above.</p>}{onAdjust && <button className="rqDetailTextAction" onClick={onAdjust}>Adjust Priority</button>}</section>;
}
export function IncidentVulnerabilityCard({ incident }: { incident: Incident }) {
  const indicators = [ ["Children", incident.vulnerablePeople?.children, Baby], ["Elderly", incident.vulnerablePeople?.elderly, UserRound], ["Disabilities", incident.vulnerablePeople?.disabled, Accessibility], ["Medical needs", incident.vulnerablePeople?.medicalNeeds, HeartPulse] ] as const;
  const vulnerable = indicators.some(([, value]) => typeof value === "number" && value > 0);
  return <section className="rqDetailCard rqDetailVulnerability"><header><h2>Affected People &amp; Vulnerability</h2></header><div className="rqDetailPeople"><Users size={34}/><div><strong>{count(incident.peopleAffected)}</strong><p>Reported affected people</p><small>Citizen-supplied count</small></div></div><dl className="rqDetailVulnerabilityGrid">{indicators.map(([label, value, Icon]) => <div key={label}><Icon size={19}/><dd>{count(value)}</dd><dt>{label}</dt></div>)}</dl>{(vulnerable || incident.immediateDanger === true) && <p className="rqDetailRiskAlert"><AlertTriangle size={20}/><span><strong>{incident.immediateDanger === true ? "Immediate danger reported" : "Vulnerable people reported"}</strong>Review reported needs before coordinating response.</span></p>}<p className="rqDetailFootnote">Water level: {incident.waterLevel || "Unknown"} · Immediate danger: {incident.immediateDanger === true ? "Yes" : incident.immediateDanger === false ? "No" : "Unknown"}</p></section>;
}
export function IncidentStatusTracker({ incident }: { incident: Incident }) {
  const stages = ["PENDING", "ASSIGNED", "IN_PROGRESS", "RESOLVED"];
  const index = stages.indexOf(incident.status);
  return <section className="rqDetailCard rqDetailStatus"><header><h2>Incident Status</h2><span className="rqDetailMicro">{incident.status.replaceAll("_", " ")}</span></header>{incident.status === "CANCELLED" ? <p className="rqDetailFootnote">This incident was cancelled. No further lifecycle actions are available.</p> : <ol aria-label={`Incident status: ${incident.status.replaceAll("_", " ")}`}>{stages.map((stage, step) => <li key={stage} className={step <= index ? "is-reached" : ""} aria-current={step === index ? "step" : undefined}><i>{step < index ? "✓" : ""}</i><span>{stage.replaceAll("_", " ")}</span></li>)}</ol>}</section>;
}
export function IncidentActivityTimeline({ incident, assignments }: { incident: Incident; assignments: Assignment[] }) {
  const events = [{ time: incident.createdAt, title: "Incident reported", source: "Incident record" }];
  if (incident.verification?.reviewedAt) events.push({ time: incident.verification.reviewedAt, title: `Verification: ${incident.verification.status.replaceAll("_", " ")}`, source: "Latest stored review" });
  if (Array.isArray(incident.priorityOverrides)) for (const override of incident.priorityOverrides) events.push({ time: override.timestamp, title: `Priority changed to ${override.newPriority}`, source: override.reason });
  for (const assignment of assignments.filter(item => item.incidentId === incident._id)) {
    if (assignment.assignedAt) events.push({ time: assignment.assignedAt, title: "Team assignment recorded", source: `Assignment ${assignment._id}` });
    if (assignment.completedAt) events.push({ time: assignment.completedAt, title: `Assignment ${assignment.status.toLowerCase()}`, source: `Assignment ${assignment._id}` });
  }
  const valid = events.filter(event => Number.isFinite(new Date(event.time).getTime())).sort((a,b) => new Date(a.time).getTime() - new Date(b.time).getTime());
  return <section className="rqDetailCard rqDetailTimeline"><header><h2>Timeline &amp; Activity Log</h2><span className="rqDetailMicro">Stored record events · PKT</span></header>{valid.length ? <ol>{valid.map((event, index) => <li key={`${event.time}-${index}`}><i><FileText size={13}/></i><time dateTime={event.time}>{formatIncidentDate(event.time)}</time><strong>{event.title}</strong><small>{event.source}</small></li>)}</ol> : <p className="rqDetailFootnote">No timestamped activity is available.</p>}<p className="rqDetailFootnote">From the incident and loaded assignment records. This is a partial history; individual status-transition timestamps are not stored.</p></section>;
}
