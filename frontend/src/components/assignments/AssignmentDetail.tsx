import Link from "next/link";
import { useState } from "react";
import {
  ClipboardList,
  MapPin,
  Users,
  Send,
  CheckCircle2,
  ArrowUpRight,
} from "lucide-react";
import { ConfirmationDialog } from "@/components/ui";
import type { AssignmentModel } from "./use-assignment-workspace";
import {
  incidentNames,
  recordId,
  timestamp,
  teamName,
} from "./assignment-data";
import { IncidentSymbol } from "./AssignmentLists";

export function AssignmentDetail({ model: m }: { model: AssignmentModel }) {
  const [confirm, setConfirm] = useState<
    "assign" | "IN_PROGRESS" | "RESOLVED" | null
  >(null);
  const incident = m.detail?.incident,
    assignment = m.detail?.assignment;
  const team = m.eligible.find(
    (item) => item.team._id === m.selectedTeam,
  )?.team;
  const canAssign =
    !!incident &&
    incident.status === "PENDING" &&
    !incident.assignedTeam &&
    !!team &&
    !m.busy &&
    !m.uncertain &&
    !m.loadingDetail &&
    !m.error;
  return (
    <section className="awCard awDetail">
      <header>
        <h2>
          <ClipboardList size={18} />
          Assignment Details
        </h2>
        {incident && (
          <span className={`awBadge priority-${incident.priorityLevel}`}>
            {incident.priorityLevel}
          </span>
        )}
      </header>
      {m.loadingDetail ? (
        <p role="status" className="awEmpty">
          Loading incident and team recommendations…
        </p>
      ) : m.detailError ? (
        <div className="awEmpty" role="alert">
          <p>{m.detailError}</p>
          <button onClick={m.refresh}>Retry details</button>
        </div>
      ) : !incident ? (
        <div className="awEmpty awChoose">
          <ClipboardList size={44} />
          <h3>Ready to coordinate</h3>
          <p>Select an unassigned incident to begin coordination.</p>
        </div>
      ) : (
        <div className="awDetailBody">
          <div className="awIncidentHeading">
            <IncidentSymbol type={incident.emergencyType} />
            <div>
              <h3>{incidentNames[incident.emergencyType]}</h3>
              <p>
                <MapPin size={14} />
                {incident.location?.address || "Location requires review"}
              </p>
              <small>#{incident._id.slice(-8)}</small>
            </div>
          </div>
          <dl className="awFacts">
            <div>
              <dt>Reported · PKT</dt>
              <dd>{timestamp(incident.createdAt)}</dd>
            </div>
            <div>
              <dt>Affected people</dt>
              <dd>{incident.peopleAffected ?? "Not reported"}</dd>
            </div>
            <div>
              <dt>Incident status</dt>
              <dd>{incident.status.replaceAll("_", " ")}</dd>
            </div>
          </dl>
          <p className="awDescription">
            {incident.description ||
              "No description provided. Review the report before coordinating a response."}
          </p>
          <div className="awVerification">
            Verification:{" "}
            {incident.verification?.status?.replaceAll("_", " ") ||
              "Not recorded"}
          </div>
          <Link
            className="awLink"
            href={`/dashboard/incidents/${incident._id}`}
          >
            View Incident Details <ArrowUpRight size={14} />
          </Link>
          {assignment ? (
            <div className="awTracking">
              <h3>Assignment record</h3>
              <p className="awReference">{assignment._id}</p>
              <span className={`awBadge status-${assignment.status}`}>
                {assignment.status}
              </span>
              <h4>{teamName(assignment)}</h4>
              <p>Assigned {timestamp(assignment.assignedAt)} PKT</p>
              {assignment.completedAt && (
                <p>Completed {timestamp(assignment.completedAt)} PKT</p>
              )}
              <p>{assignment.notes || "No assignment notes."}</p>
              <Link
                className="awLink"
                href={`/dashboard/rescue-teams?teamId=${recordId(assignment.teamId) || ""}`}
              >
                View Rescue Teams <ArrowUpRight size={14} />
              </Link>
              {assignment.status === "ACTIVE" &&
                incident.status === "ASSIGNED" && (
                  <button
                    className="awPrimary"
                    disabled={m.busy || m.uncertain}
                    onClick={() => setConfirm("IN_PROGRESS")}
                  >
                    Mark In Progress
                  </button>
                )}
              {assignment.status === "ACTIVE" &&
                incident.status === "IN_PROGRESS" && (
                  <button
                    className="awPrimary"
                    disabled={m.busy || m.uncertain}
                    onClick={() => setConfirm("RESOLVED")}
                  >
                    <CheckCircle2 size={18} />
                    Resolve Incident
                  </button>
                )}
            </div>
          ) : incident.status !== "PENDING" || incident.assignedTeam ? (
            <p className="awNotice">
              This incident is no longer unassigned. Refresh the active
              assignment list.
            </p>
          ) : (
            <>
              <div className="awRecommendationHeader">
                <h3>Recommended Rescue Teams</h3>
                <Link href="/dashboard/rescue-teams">
                  View all <ArrowUpRight size={13} />
                </Link>
              </div>
              <div className="awRecommendations">
                {!m.eligible.length ? (
                  <p className="awNotice">
                    {m.detail?.recommendations?.manualSelectionRequired
                      ? "Verify the incident location in Incident Details before choosing a team. Distance recommendations are unavailable."
                      : "No eligible available teams. Review Rescue Teams and refresh."}
                  </p>
                ) : (
                  m.eligible.slice(0, 3).map((item) => (
                    <button
                      disabled={m.busy}
                      key={item.team._id}
                      className={`awRecommendation ${m.selectedTeam === item.team._id ? "selected" : ""}`}
                      aria-pressed={m.selectedTeam === item.team._id}
                      onClick={() => m.setSelectedTeam(item.team._id)}
                    >
                      <span className="awTeamSymbol">
                        <Users size={24} />
                      </span>
                      <span>
                        <strong>{item.team.name}</strong>
                        <small>
                          {item.team.capabilities
                            .map((value) => value.replaceAll("_", " "))
                            .join(" · ")}
                        </small>
                        <small>
                          {item.team.teamCode} · {item.approximateDistanceKm} km
                          straight-line
                        </small>
                        {item.capacityWarning && (
                          <small className="awWarning">
                            {item.capacityWarning}
                          </small>
                        )}
                      </span>
                      <span className="awBadge status-AVAILABLE">
                        Available
                      </span>
                    </button>
                  ))
                )}
              </div>
              <form
                className="awComposer"
                onSubmit={(event) => {
                  event.preventDefault();
                  if (canAssign) setConfirm("assign");
                }}
              >
                <h3>Assign Team</h3>
                <label>
                  Select rescue team
                  <select
                    required
                    disabled={m.busy || !m.eligible.length}
                    value={m.selectedTeam}
                    onChange={(event) => m.setSelectedTeam(event.target.value)}
                  >
                    <option value="">Choose an available team</option>
                    {m.eligible.map((item) => (
                      <option key={item.team._id} value={item.team._id}>
                        {item.team.name} · {item.team.teamCode}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Incident priority
                  <input readOnly value={incident.priorityLevel} />
                </label>
                <label>
                  Additional notes (optional)
                  <textarea
                    value={m.notes}
                    maxLength={1000}
                    rows={3}
                    placeholder="Instructions, hazards, or special requirements…"
                    onChange={(event) => m.setNotes(event.target.value)}
                    disabled={m.busy}
                  />
                </label>
                <button className="awPrimary" disabled={!canAssign}>
                  <Send size={18} />
                  {m.busy ? "Recording…" : "Assign Rescue Team"}
                </button>
              </form>
            </>
          )}
        </div>
      )}
      <ConfirmationDialog
        open={!!confirm}
        title={
          confirm === "assign"
            ? "Confirm rescue team assignment"
            : confirm === "RESOLVED"
              ? "Resolve incident and release team?"
              : "Mark incident in progress?"
        }
        description={
          confirm === "assign" ? (
            <p>
              Assign{" "}
              <strong>
                {team?.name} ({team?.teamCode})
              </strong>{" "}
              to {incident && incidentNames[incident.emergencyType]} #
              {incident?._id.slice(-8)} · {incident?.priorityLevel}? The server
              will mark this available team BUSY and the incident ASSIGNED. This
              records coordination in the prototype.
            </p>
          ) : (
            <p>
              {confirm === "RESOLVED"
                ? "The incident will become RESOLVED, its assignment COMPLETED, and the team AVAILABLE."
                : "The selected incident will move from ASSIGNED to IN_PROGRESS."}
            </p>
          )
        }
        confirmLabel={
          confirm === "assign" ? "Confirm Assignment" : "Confirm Status Change"
        }
        busy={m.busy}
        onClose={() => setConfirm(null)}
        onConfirm={() => {
          if (confirm) void m.mutate(confirm).then(() => setConfirm(null));
        }}
      />
    </section>
  );
}
