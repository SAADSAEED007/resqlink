"use client";
import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useDashboard } from "./dashboard-context";
import type { Incident } from "@/types/api";
import { IncidentOperations } from "./IncidentOperations";
import { AlertTriangle, MapPin, UserRound, X } from "lucide-react";
import { IncidentVisual, incidentTitle } from "./incident-visual";
export function IncidentDetailModal({
  incident,
  onClose,
}: {
  incident: Incident | null;
  onClose: () => void;
  onUpdateStatus?: (id: string, status: Incident["status"]) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const router = useRouter();
  const { isDemoMode } = useDashboard();
  useEffect(() => {
    if (incident) dialog.current?.showModal();
    else dialog.current?.close();
  }, [incident]);
  return (
    <dialog
      ref={dialog}
      className="rqCommandDetail"
      aria-labelledby="modal-incident-title"
      onCancel={onClose}
      onClose={onClose}
    >
      {incident && (
        <>
          <header>
            <div className="rqCommandDetailTags">
              <span
                className={`rqCommandSeverity ${incident.priorityLevel.toLowerCase()}`}
              >
                {incident.priorityLevel}
              </span>
              <span className="rqCommandDetailStatus">
                {incident.status.replaceAll("_", " ")}
              </span>
            </div>
            <button aria-label="Close dialog" onClick={onClose}>
              <X size={20} />
            </button>
          </header>
          <div className="rqCommandDetailHero">
            <IncidentVisual incident={incident} variant="hero" />
            <div>
              <p className="rqCommandDetailCategory">
                <AlertTriangle size={14} aria-hidden="true" /> {incidentTitle(incident)}
              </p>
              <h2 id="modal-incident-title">{incident.description}</h2>
              <p className="rqCommandDetailLocation">
                <MapPin size={14} aria-hidden="true" />
                {incident.location?.address || "Location verification required"}
              </p>
              <p className="rqCommandDetailReporter">
                <UserRound size={14} aria-hidden="true" /> Reported by {incident.reporterName}
              </p>
            </div>
          </div>
          <dl>
            <dt>Reported by</dt>
            <dd>{incident.reporterName}</dd>
            <dt>Status</dt>
            <dd>{incident.status.replaceAll("_", " ")}</dd>
            <dt>Priority score</dt>
            <dd>{incident.priorityScore}</dd>
            <dt>Verification</dt>
            <dd>
              {incident.verification?.status.replaceAll("_", " ") ||
                "Not recorded"}
            </dd>
            <dt>People affected</dt>
            <dd>{incident.peopleAffected}</dd>
            <dt>Water level</dt>
            <dd>{incident.waterLevel || "UNKNOWN"}</dd>
            <dt>Immediate danger</dt>
            <dd>
              {incident.immediateDanger === true
                ? "Yes"
                : incident.immediateDanger === false
                  ? "No"
                  : "Unknown"}
            </dd>
            {Object.entries({
              Children: incident.vulnerablePeople?.children,
              Elderly: incident.vulnerablePeople?.elderly,
              Disabilities: incident.vulnerablePeople?.disabled,
              "Medical needs": incident.vulnerablePeople?.medicalNeeds,
            }).map(([label, value]) => (
              <div key={label} className="rqCommandDefinition">
                <dt>{label}</dt>
                <dd>{value ?? "Unknown"}</dd>
              </div>
            ))}
          </dl>
          <h3>Risk Factor Analysis</h3>
          <ul>
            {incident.priorityReasons?.map((reason, index) => (
              <li key={index}>{reason}</li>
            ))}
          </ul>
          <IncidentOperations key={incident._id} incident={incident} />
          <footer style={{ flexWrap: "wrap" }}>
            <p>
              Prototype Decision Support / Human Confirmation Required
              {incident.isSimulated ? " / Simulated incident" : ""}
            </p>
            <button onClick={() => {
              const destination = `/dashboard/incidents/${encodeURIComponent(incident._id)}${isDemoMode ? "?demo=true" : ""}`;
              onClose();
              router.push(destination);
            }}>Open full incident workspace</button>
            <button onClick={onClose}>Close</button>
          </footer>
        </>
      )}
    </dialog>
  );
}
