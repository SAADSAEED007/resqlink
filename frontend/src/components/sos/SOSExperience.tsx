"use client";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Camera,
  Check,
  CheckCircle2,
  FileText,
  MapPin,
  ShieldCheck,
  Siren,
  UsersRound,
  X,
} from "lucide-react";
import { Brand } from "@/components/layout/public-layout";
import { Button } from "@/components/ui";
import { incidents } from "@/lib/api/incidents";
import { ApiError } from "@/lib/api/client";
import { SOSLocationStep } from "./SOSLocationStep";
import { SOSEmergencyDetailsStep } from "./SOSEmergencyDetailsStep";
import { SOSReviewStep } from "./SOSReviewStep";
import {
  emptyDraft,
  toIncidentInput,
  validateDetails,
  validateLocation,
  type DraftErrors,
  type SOSDraft,
} from "./report";
import "./sos.css";
type Step = "start" | "location" | "details" | "review" | "success";
const progress = [
  { value: "location", label: "Location" },
  { value: "details", label: "Details" },
  { value: "review", label: "Review" },
] as const;
function PrototypeNotice() {
  return (
    <aside className="rqSosPrototype" aria-label="Prototype safety notice">
      <ShieldCheck size={18} aria-hidden="true" />
      <p>
        <strong>Hackathon demonstration.</strong> ResQLink is a hackathon
        demonstration platform and is not connected to official emergency
        dispatch services. In a real emergency, contact your local emergency
        authorities.
      </p>
    </aside>
  );
}
export function SOSExperience() {
  const [step, setStep] = useState<Step>("start");
  const [draft, setDraft] = useState<SOSDraft>({ ...emptyDraft });
  const [errors, setErrors] = useState<DraftErrors>({});
  const [busy, setBusy] = useState(false);
  const [submissionError, setSubmissionError] = useState("");
  const [uncertain, setUncertain] = useState(false);
  const [retryAcknowledged, setRetryAcknowledged] = useState(false);
  const [reference, setReference] = useState("");
  const [mediaInfo, setMediaInfo] = useState(false);
  const mediaDialog = useRef<HTMLDialogElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const alertRef = useRef<HTMLDivElement>(null);
  const attemptedNavigation = useRef(false);
  const inFlight = useRef(false);
  const completed = useRef(false);
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  useEffect(() => {
    if (attemptedNavigation.current) {
      heading.current?.focus();
      heading.current?.scrollIntoView({ block: "start", behavior: "instant" });
    }
  }, [step]);
  useEffect(() => {
    if (mediaInfo) mediaDialog.current?.showModal();
    else mediaDialog.current?.close();
  }, [mediaInfo]);
  function go(next: Step) {
    if (inFlight.current || completed.current) return;
    attemptedNavigation.current = true;
    setStep(next);
    setErrors({});
    if (!uncertain) setSubmissionError("");
  }
  function update(patch: Partial<SOSDraft>) {
    setDraft((old) => ({ ...old, ...patch }));
    setErrors({});
    if (!uncertain) setSubmissionError("");
  }
  function showErrors(nextErrors: DraftErrors) {
    setErrors(nextErrors);
    requestAnimationFrame(() => {
      const target = document.querySelector<HTMLElement>(
        '.rqSosPanel [aria-invalid="true"]',
      );
      if (target) target.focus();
      else heading.current?.focus();
    });
  }
  function next(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (step === "location") {
      const errors = validateLocation(draft);
      if (Object.keys(errors).length) return showErrors(errors);
      go("details");
    } else if (step === "details") {
      const errors = validateDetails(draft);
      if (Object.keys(errors).length) return showErrors(errors);
      go("review");
    } else if (step === "review") void submit();
  }
  async function submit() {
    if (
      inFlight.current ||
      completed.current ||
      (uncertain && !retryAcknowledged)
    )
      return;
    const locationErrors = validateLocation(draft);
    const detailErrors = validateDetails(draft);
    if (Object.keys(locationErrors).length) {
      go("location");
      showErrors(locationErrors);
      return;
    }
    if (Object.keys(detailErrors).length) {
      go("details");
      showErrors(detailErrors);
      return;
    }
    inFlight.current = true;
    setBusy(true);
    setSubmissionError("");
    controller.current = new AbortController();
    try {
      const incident = await incidents.create(
        toIncidentInput(draft),
        controller.current.signal,
      );
      if (
        !incident ||
        typeof incident._id !== "string" ||
        !/^[a-f0-9]{24}$/i.test(incident._id)
      )
        throw new ApiError(
          "The response did not include a valid report reference.",
          0,
          "protocol",
        );
      completed.current = true;
      setReference(incident._id);
      setStep("success");
    } catch (error) {
      if (error instanceof ApiError && error.code === "aborted") return;
      const ambiguous =
        !(error instanceof ApiError) ||
        error.status === 0 ||
        error.status >= 500 ||
        error.code === "protocol";
      setUncertain(ambiguous);
      setRetryAcknowledged(false);
      setSubmissionError(
        ambiguous
          ? "We could not confirm that your report was recorded. It may have reached the demonstration system. Your details are still here. Retrying could create another report."
          : error instanceof ApiError && error.status === 429
            ? "Your report was not recorded because too many requests were made. Wait a moment, then retry."
            : error instanceof ApiError &&
                (error.status === 400 || error.status === 422)
              ? "The server rejected this report. It was not recorded. Review your details, then retry."
              : "The service did not accept your report. Your details are still here. Please try again later.",
      );
      requestAnimationFrame(() => alertRef.current?.focus());
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }
  const title =
    step === "start"
      ? "Report an Emergency"
      : step === "location"
        ? "Where is help needed?"
        : step === "details"
          ? "Tell us what happened"
          : step === "review"
            ? "Review your report"
            : "Emergency report recorded";
  return (
    <div className="rqSosRoot">
      <header className="rqSosNav">
        <Link href="/" aria-label="ResQLink home">
          <Image
            src="/images/ResQLink Shield Brand Logo.png"
            alt="ResQLink"
            width={2172}
            height={724}
            sizes="240px"
          />
        </Link>
        <Link href="/">
          <ArrowLeft size={17} aria-hidden="true" />
          Back to public portal
        </Link>
      </header>
      <div className="rqSosLayout">
        <aside className="rqSosStory">
          <span className="rqSosStoryLabel">CITIZEN EMERGENCY REPORTING</span>
          <h2>
            Get Help.
            <br />
            Report Now.
          </h2>
          <p>
            A clearer way to share what happened, where help is needed, and who
            may be at risk.
          </p>
          <ul>
            <li>
              <ShieldCheck aria-hidden="true" />
              <div>
                <strong>No Login Required</strong>
                <span>
                  Anyone can start a report. Share only the details you know.
                </span>
              </div>
            </li>
            <li>
              <UsersRound aria-hidden="true" />
              <div>
                <strong>Report for Someone Else</strong>
                <span>
                  Help a neighbor or someone without a connected device.
                </span>
              </div>
            </li>
            <li>
              <CheckCircle2 aria-hidden="true" />
              <div>
                <strong>People lead the response</strong>
                <span>
                  Project coordinators review reports. This prototype does not
                  dispatch emergency services.
                </span>
              </div>
            </li>
          </ul>
          <p className="rqSosPrivacy">
            Your draft stays in this page&apos;s memory. It is not saved to
            browser storage. Keep this page open until you receive confirmation.
          </p>
        </aside>
        <main id="main" className="rqSosPanel">
          <div className="rqSosAppHeader">
            <Brand />
            <span>
              <ShieldCheck size={14} aria-hidden="true" />
              Prototype
            </span>
          </div>
          <div className="rqSosAppContent">
            {step !== "start" && step !== "success" && (
              <ol className="rqSosProgress" aria-label="Report progress">
                {progress.map(({ value, label }, index) => (
                  <li
                    key={value}
                    aria-current={step === value ? "step" : undefined}
                  >
                    <span>{index + 1}</span>
                    {label}
                  </li>
                ))}
              </ol>
            )}
            <div className="rqSosTitle">
              <h1 ref={heading} tabIndex={-1}>
                {title}
              </h1>
              <p>
                {step === "start"
                  ? "Get help. Share details. Save lives."
                  : step === "success"
                    ? "Recorded in the ResQLink demonstration system."
                    : "Share what you know. Every detail can help a human review."}
              </p>
            </div>
            {step === "start" ? (
              <>
                <p className="rqSosDemoLabel">
                  Demonstration only - no official dispatch
                </p>
                <button
                  type="button"
                  className="rqSosEmergency"
                  aria-label="SOS - begin emergency report"
                  onClick={() => go("location")}
                >
                  <Image
                    src="/images/Glowing Red SOS Emergency Button.png"
                    alt=""
                    width={1254}
                    height={1254}
                    sizes="260px"
                    loading="eager"
                  />
                  <span className="sr-only">
                    <Siren aria-hidden="true" />
                    Start emergency report
                  </span>
                </button>
                <p className="rqSosAnyone">
                  Anyone can report. No account required.
                </p>
                <p className="rqSosSmall">
                  The SOS button opens the form. Nothing is submitted yet.
                </p>
                <div className="rqSosShortcuts">
                  <button onClick={() => go("location")}>
                    <MapPin size={20} aria-hidden="true" />
                    <span>Add Location</span>
                    <ArrowRight size={16} aria-hidden="true" />
                  </button>
                  <button onClick={() => go("details")}>
                    <FileText size={20} aria-hidden="true" />
                    <span>Add Details</span>
                    <ArrowRight size={16} aria-hidden="true" />
                  </button>
                  <button onClick={() => setMediaInfo(true)}>
                    <Camera size={20} aria-hidden="true" />
                    <span>Add Photo</span>
                    <span className="rqSosUnavailable">Not available</span>
                  </button>
                  <button
                    onClick={() => {
                      update({ reportingFor: "someone-else" });
                      go("location");
                    }}
                  >
                    <UsersRound size={20} aria-hidden="true" />
                    <span>Report for Someone Else</span>
                    <ArrowRight size={16} aria-hidden="true" />
                  </button>
                </div>
                <div className="rqSosActions">
                  <Button
                    className="rqSosPrimary"
                    size="lg"
                    onClick={() => go("location")}
                  >
                    Continue Emergency Report
                    <ArrowRight size={18} aria-hidden="true" />
                  </Button>
                </div>
              </>
            ) : step === "success" ? (
              <div className="rqSosSuccess">
                <CheckCircle2 size={52} aria-hidden="true" />
                <p role="status">
                  Your report has been recorded in the ResQLink demonstration
                  system. It has not been sent to official emergency services.
                </p>
                <div>
                  <span>REPORT REFERENCE</span>
                  <strong>{reference}</strong>
                </div>
                <p className="helper">
                  Keep this reference for your records. Public tracking is not
                  available. A rescue team has not been dispatched by this
                  prototype.
                </p>
                <Link href="/" className="rqSosReturn">
                  Return to public portal
                  <ArrowRight size={17} aria-hidden="true" />
                </Link>
              </div>
            ) : (
              <form onSubmit={next} noValidate>
                <fieldset className="rqSosFormFields" disabled={busy}>
                  {step === "location" && (
                    <SOSLocationStep
                      draft={draft}
                      errors={errors}
                      update={update}
                    />
                  )}
                  {step === "details" && (
                    <SOSEmergencyDetailsStep
                      draft={draft}
                      errors={errors}
                      update={update}
                      showMediaInfo={() => setMediaInfo(true)}
                    />
                  )}
                  {step === "review" && (
                    <SOSReviewStep draft={draft} onEdit={go} busy={busy} />
                  )}
                </fieldset>
                {submissionError && (
                  <div
                    ref={alertRef}
                    tabIndex={-1}
                    className="rqSosSubmissionError"
                    role="alert"
                  >
                    <h2>Report not confirmed</h2>
                    <p>{submissionError}</p>
                    {uncertain && (
                      <label className="rqSosChoice">
                        <input
                          type="checkbox"
                          checked={retryAcknowledged}
                          onChange={(event) =>
                            setRetryAcknowledged(event.target.checked)
                          }
                        />
                        <span>
                          I understand a retry may create another report.
                        </span>
                      </label>
                    )}
                  </div>
                )}
                <div className="rqSosActions">
                  <Button
                    variant="outline"
                    disabled={busy}
                    onClick={() =>
                      go(
                        step === "location"
                          ? "start"
                          : step === "details"
                            ? "location"
                            : "details",
                      )
                    }
                  >
                    <ArrowLeft size={17} aria-hidden="true" />
                    Back
                  </Button>
                  <Button
                    className="rqSosPrimary"
                    type="submit"
                    loading={busy}
                    loadingLabel="Recording report"
                    disabled={
                      step === "review" && uncertain && !retryAcknowledged && !!submissionError
                    }
                  >
                    {step === "review"
                      ? submissionError
                        ? "Retry submission"
                        : "Record Emergency Report"
                      : step === "location"
                        ? "Continue to Details"
                        : "Review Report"}
                    {step === "review" ? (
                      <Check size={18} aria-hidden="true" />
                    ) : (
                      <ArrowRight size={18} aria-hidden="true" />
                    )}
                  </Button>
                </div>
                {busy && (
                  <p role="status" className="rqSosSmall">
                    Recording your report. Please wait and avoid submitting
                    again.
                  </p>
                )}
              </form>
            )}
            <PrototypeNotice />
          </div>
          <footer className="rqSosPanelFooter">
            <span>ResQLink / Citizen Portal</span>
            <span>Human-led response.</span>
          </footer>
        </main>
      </div>
      <dialog
        ref={mediaDialog}
        className="rqSosMediaDialog"
        aria-labelledby="sos-media-title"
        aria-describedby="sos-media-description"
        onCancel={(event) => {
          event.preventDefault();
          setMediaInfo(false);
        }}
      >
        <button
          className="rqSosDialogClose"
          aria-label="Close photo information"
          onClick={() => setMediaInfo(false)}
        >
          <X size={20} />
        </button>
        <Camera size={30} aria-hidden="true" />
        <h2 id="sos-media-title">Photos and video are not available yet</h2>
        <p id="sos-media-description">
          This prototype cannot securely upload or save media. No photo or video
          will be attached to your report. Describe the situation in the details
          step instead.
        </p>
        <Button className="rqSosPrimary" onClick={() => setMediaInfo(false)}>
          Understood
        </Button>
      </dialog>
    </div>
  );
}
