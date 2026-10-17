"use client";
import { useEffect, useRef } from "react";
import type { Incident } from "@/types/api";
import { X } from "lucide-react";
export function IncidentDetailModal({
  incident,
  onClose,
}: {
  incident: Incident | null;
  onClose: () => void;
  onUpdateStatus?: (id: string, status: Incident["status"]) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
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
            <span
              className={`rqCommandSeverity ${incident.priorityLevel.toLowerCase()}`}
            >
              {incident.priorityLevel}
            </span>
            <button aria-label="Close dialog" onClick={onClose}>
              <X size={20} />
            </button>
          </header>
          <h2 id="modal-incident-title">{incident.description}</h2>
          <p>
            {incident.location?.address || "Location verification required"}
          </p>
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
          <footer>
            <p>
              Prototype Decision Support / Human Confirmation Required
              {incident.isSimulated ? " / Simulated incident" : ""}
            </p>
            <button onClick={onClose}>Close</button>
          </footer>
        </>
      )}
    </dialog>
  );
}
