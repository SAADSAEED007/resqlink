import { Fragment } from "react";
import { Button } from "@/components/ui";
import {
  emergencyChoices,
  locationSummary,
  selectedLocation,
  type SOSDraft,
} from "./report";
export function SOSReviewStep({
  draft,
  onEdit,
  busy,
}: {
  draft: SOSDraft;
  onEdit: (step: "location" | "details") => void;
  busy: boolean;
}) {
  const unknown = Object.values({
    children: draft.children,
    elderly: draft.elderly,
    disabled: draft.disabled,
    medicalNeeds: draft.medicalNeeds,
  }).some((value) => !value.trim());
  return (
    <div className="rqSosStepBody">
      <p className="rqSosIntro">
        Check the details before recording your report. No official emergency
        service will be notified.
      </p>
      <section className="rqSosReviewCard">
        <div className="rqSosReviewTitle">
          <h2>Location</h2>
          <Button
            variant="ghost"
            size="sm"
            disabled={busy}
            onClick={() => onEdit("location")}
          >
            Edit location
          </Button>
        </div>
        <p>{locationSummary(draft)}</p>
        {!selectedLocation(draft) && (
          <p className="rqSosReviewWarning">
            No GPS coordinates are available. This location will require
            coordinator verification.
          </p>
        )}
      </section>
      <section className="rqSosReviewCard">
        <div className="rqSosReviewTitle">
          <h2>Emergency details</h2>
          <Button
            variant="ghost"
            size="sm"
            disabled={busy}
            onClick={() => onEdit("details")}
          >
            Edit details
          </Button>
        </div>
        <dl className="rqSosReviewList">
          <dt>Type</dt>
          <dd>
            {emergencyChoices.find((item) => item.value === draft.emergencyType)
              ?.label ?? "Not selected"}
          </dd>
          <dt>Reported by</dt>
          <dd>{draft.reporterName || "Missing name"}</dd>
          <dt>Reporting for</dt>
          <dd>
            {draft.reportingFor === "someone-else" ? "Someone else" : "Myself"}
          </dd>
          <dt>People affected</dt>
          <dd>{draft.peopleAffected || "Missing estimate"}</dd>
          <dt>Immediate danger</dt>
          <dd>
            {draft.immediateDanger === "unknown"
              ? "Not sure"
              : draft.immediateDanger === "yes"
                ? "Yes"
                : "No"}
          </dd>
          <dt>Water level</dt>
          <dd>
            {draft.waterLevel === "UNKNOWN"
              ? "Not sure"
              : draft.waterLevel.toLowerCase()}
          </dd>
          <dt>Contact phone</dt>
          <dd>{draft.reporterPhone.trim() || "Not provided"}</dd>
          {(
            [
              ["children", "Children"],
              ["elderly", "Elderly people"],
              ["disabled", "People with disabilities"],
              ["medicalNeeds", "People with medical needs"],
            ] as const
          ).map(([key, label]) => (
            <Fragment key={key}>
              <dt>{label}</dt>
              <dd>{draft[key].trim() || "Unknown"}</dd>
            </Fragment>
          ))}
        </dl>
        <h3>What happened</h3>
        <p className="rqSosReportText">{draft.description}</p>
        {draft.notes && (
          <>
            <h3>Additional notes</h3>
            <p className="rqSosReportText">{draft.notes}</p>
          </>
        )}
      </section>
      {unknown && (
        <p className="rqSosInlineNotice">
          Some assistance needs are unknown. They will remain unknown in your
          report, rather than being recorded as zero.
        </p>
      )}
      <p className="helper">
        Only record information you are comfortable sharing with authorized
        project coordinators. Photos and videos are not attached.
      </p>
    </div>
  );
}
