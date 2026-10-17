"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import type {
  Incident,
  IncidentStatus,
  VerificationStatus,
  Recommendations,
} from "@/types/api";
import { incidents } from "@/lib/api/incidents";
import { assignments } from "@/lib/api/assignments";
import { ApiError, errorMessage } from "@/lib/api/client";
import { Button, FormField, Select, Textarea } from "@/components/ui";
import { useDashboard } from "./dashboard-context";
const transitions: Record<IncidentStatus, IncidentStatus[]> = {
  PENDING: ["CANCELLED"],
  ASSIGNED: ["IN_PROGRESS", "CANCELLED"],
  IN_PROGRESS: ["RESOLVED"],
  RESOLVED: [],
  CANCELLED: [],
};
export function IncidentOperations({ incident }: { incident: Incident }) {
  const { isDemoMode, teams, refresh, setSelectedIncident } = useDashboard();
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [uncertain, setUncertain] = useState(false),
    [ack, setAck] = useState(false);
  const [verification, setVerification] = useState<VerificationStatus | "">("");
  const [notes, setNotes] = useState(""),
    [status, setStatus] = useState<IncidentStatus | "">(""),
    [teamId, setTeamId] = useState(""),
    [recommendations, setRecommendations] = useState<Recommendations | null>(
      null,
    );
  const [recommendationError, setRecommendationError] = useState("");
  const lock = useRef(false);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  const allowed = transitions[incident.status];
  async function mutate(task: () => Promise<{ _id: string }>, success: string) {
    if (lock.current || (uncertain && !ack)) return;
    lock.current = true;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const result = await task();
      if (!alive.current) {
        void refresh();
        return;
      }
      if (!result?._id || !/^[a-f0-9]{24}$/i.test(result._id))
        throw new ApiError("Invalid server confirmation", 0, "protocol");
      setMessage(success);
      setUncertain(false);
      setAck(false);
      await refresh();
      try {
        const current = await incidents.get(incident._id);
        if (alive.current) setSelectedIncident(current);
      } catch {
        setError(
          "The change was confirmed, but current details could not be reloaded. Refresh before another change.",
        );
      }
    } catch (err) {
      if (!alive.current) return;
      const ambiguous =
        !(err instanceof ApiError) || err.status === 0 || err.status >= 500;
      setUncertain(ambiguous);
      setAck(false);
      setError(
        ambiguous
          ? "The change is unconfirmed and may have reached the server. Refresh current records before retrying; do not assume it failed."
          : errorMessage(err),
      );
      await refresh();
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  function verify(event: FormEvent) {
    event.preventDefault();
    const normalized = notes.trim().replace(/\s+/g, " ");
    if (
      normalized.length < 3 ||
      normalized.length > 1000 ||
      /[<>]/.test(normalized)
    ) {
      setError(
        "Use 3 to 1,000 characters for review notes, without angle brackets.",
      );
      return;
    }
    if (!verification) {
      setError("Choose a verification decision.");
      return;
    }
    void mutate(
      () =>
        incidents.updateVerification(
          incident._id,
          verification as VerificationStatus,
          normalized,
        ),
      "Verification review recorded.",
    );
  }
  if (isDemoMode)
    return (
      <p className="rqOperationsNotice">
        Demo records are read-only. Connect to the API to review verification,
        assign a team or change status.
      </p>
    );
  return (
    <section className="rqOperations" aria-label="Coordinator incident actions">
      <h3>Coordinator actions</h3>
      {message && <p role="status">{message}</p>}
      {error && <p role="alert">{error}</p>}
      {uncertain && (
        <label className="rqOperationsAck">
          <input
            type="checkbox"
            checked={ack}
            onChange={(e) => setAck(e.target.checked)}
          />
          I reviewed current records and understand a retry could repeat this
          change.
        </label>
      )}
      <Button
        variant="outline"
        disabled={busy}
        onClick={() =>
          void refresh()
            .then(async () =>
              incidents.get(incident._id).then((current) => {
                if (alive.current) setSelectedIncident(current);
              }),
            )
            .catch((err) => setError(errorMessage(err)))
        }
      >
        Reload current incident
      </Button>
      <fieldset disabled={busy || (uncertain && !ack)}>
        <legend>Verification &amp; duplicate review</legend>
        <ul>
          {incident.verification?.warnings.map((warning, index) => (
            <li key={index}>{warning}</li>
          ))}
        </ul>
        {incident.verification?.potentialDuplicateIncidents.length ? (
          <p>
            Potential duplicate report IDs:{" "}
            {incident.verification.potentialDuplicateIncidents.join(", ")}
          </p>
        ) : null}
        <form onSubmit={verify}>
          <FormField label="Verification decision" required>
            {(props) => (
              <Select
                {...props}
                value={verification}
                onChange={(e) =>
                  setVerification(e.target.value as VerificationStatus)
                }
              >
                <option value="">Choose a verification decision</option>
                {[
                  "NEEDS_REVIEW",
                  "VERIFIED",
                  "FLAGGED_DUPLICATE",
                  "DISMISSED",
                ].map((value) => (
                  <option key={value} value={value}>
                    {value.replaceAll("_", " ")}
                  </option>
                ))}
              </Select>
            )}
          </FormField>
          <FormField label="Review notes" required>
            {(props) => (
              <Textarea
                {...props}
                value={notes}
                minLength={3}
                maxLength={1000}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
              />
            )}
          </FormField>
          <Button type="submit" loading={busy}>
            Record verification
          </Button>
        </form>
      </fieldset>
      {allowed.length > 0 && (
        <fieldset disabled={busy || (uncertain && !ack)}>
          <legend>Incident lifecycle</legend>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (allowed.includes(status as IncidentStatus))
                void mutate(
                  () =>
                    incidents.updateStatus(
                      incident._id,
                      status as IncidentStatus,
                    ),
                  "Incident status updated.",
                );
            }}
          >
            <FormField label="New incident status" required>
              {(props) => (
                <Select
                  {...props}
                  value={
                    allowed.includes(status as IncidentStatus) ? status : ""
                  }
                  onChange={(e) => setStatus(e.target.value as IncidentStatus)}
                >
                  <option value="">Choose a valid transition</option>
                  {allowed.map((value) => (
                    <option key={value} value={value}>
                      {value.replaceAll("_", " ")}
                    </option>
                  ))}
                </Select>
              )}
            </FormField>
            <p>
              Resolution or cancellation updates the assignment and team through
              the existing backend workflow.
            </p>
            <Button type="submit" loading={busy}>
              Confirm status change
            </Button>
          </form>
        </fieldset>
      )}
      {incident.status === "PENDING" && !incident.assignedTeam && (
        <fieldset disabled={busy || (uncertain && !ack)}>
          <legend>Record team assignment</legend>
          <p>
            Manual coordinator decision. This records an assignment; no official
            dispatch or arrival time is promised.
          </p>
          <Button
            variant="outline"
            onClick={async () => {
              if (lock.current) return;
              lock.current = true;
              setBusy(true);
              setRecommendationError("");
              try {
                setRecommendations(
                  await incidents.recommendations(incident._id),
                );
              } catch (err) {
                setRecommendationError(errorMessage(err));
              } finally {
                lock.current = false;
                setBusy(false);
              }
            }}
          >
            Load team recommendations
          </Button>
          {recommendationError && <p role="alert">{recommendationError}</p>}
          {recommendations && (
            <div>
              <p>{recommendations.message}</p>
              <p>
                Distances are approximate straight-line kilometres, not travel
                distance or time.
              </p>
              <ul>
                {recommendations.items.map((item) => (
                  <li key={item.team._id}>
                    {item.team.name}: {item.approximateDistanceKm} km
                    {item.capacityWarning ? ` / ${item.capacityWarning}` : ""}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (teamId)
                void mutate(
                  () =>
                    assignments.create({ incidentId: incident._id, teamId }),
                  "Team assignment recorded. No official emergency dispatch performed.",
                );
            }}
          >
            <FormField
              label="Available team"
              required
              description="Only available teams with the same simulated/real flag are listed. The backend validates capability and concurrent assignments."
            >
              {(props) => (
                <Select
                  {...props}
                  value={teamId}
                  onChange={(e) => setTeamId(e.target.value)}
                >
                  <option value="">Choose a team manually</option>
                  {teams
                    .filter(
                      (team) =>
                        team.status === "AVAILABLE" &&
                        !team.currentIncident &&
                        team.isSimulated === incident.isSimulated,
                    )
                    .map((team) => (
                      <option value={team._id} key={team._id}>
                        {team.name} / {team.capabilities.join(", ")} / capacity{" "}
                        {team.capacity}
                      </option>
                    ))}
                </Select>
              )}
            </FormField>
            <Button type="submit" loading={busy}>
              Confirm team assignment
            </Button>
          </form>
        </fieldset>
      )}
    </section>
  );
}
