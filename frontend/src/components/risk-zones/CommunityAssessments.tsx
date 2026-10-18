"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Button, FormField, Input, Select, Textarea } from "@/components/ui";
import { riskZones } from "@/lib/api/risk-zones";
import { ApiError, errorMessage } from "@/lib/api/client";
import {
  hazardTypes,
  hazardSeverities,
  connectivityStatuses,
  assessmentStatuses,
  assessmentUrgencies,
  type RiskZone,
  type RiskZonePage,
  type RiskZoneQuery,
  type AssessmentStatus,
} from "@/types/risk-zones";
import { emptyZone, zoneInput, text, type ZoneDraft } from "./zone-form";
export function CommunityAssessments({
  initialDistrict = "",
}: {
  initialDistrict?: string;
}) {
  const [query, setQuery] = useState<RiskZoneQuery>({
    page: 1,
    limit: 20,
    sort: "newest",
    ...(initialDistrict ? { district: initialDistrict } : {}),
  });
  const [district, setDistrict] = useState(initialDistrict);
  const [data, setData] = useState<RiskZonePage | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [attempt, setAttempt] = useState(0);
  const [draft, setDraft] = useState<ZoneDraft>({
      ...emptyZone,
      district: initialDistrict,
    }),
    [showCreate, setShowCreate] = useState(false),
    [selected, setSelected] = useState<RiskZone | null>(null);
  const [busy, setBusy] = useState(false),
    [mutationError, setMutationError] = useState(""),
    [message, setMessage] = useState(""),
    [uncertain, setUncertain] = useState(false),
    [ack, setAck] = useState(false);
  const [urgency, setUrgency] = useState(""),
    [officer, setOfficer] = useState(""),
    [assessmentNotes, setAssessmentNotes] = useState(""),
    [newStatus, setNewStatus] = useState(""),
    [statusNotes, setStatusNotes] = useState("");
  const feedback = useRef<HTMLDivElement>(null);
  const selectedSection = useRef<HTMLElement>(null);
  useEffect(() => {
    if (message || mutationError) {
      feedback.current?.focus();
      feedback.current?.scrollIntoView({
        block: "center",
        behavior: "instant",
      });
    }
  }, [message, mutationError]);
  const lock = useRef(false),
    alive = useRef(true),
    detailController = useRef<AbortController | null>(null);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      detailController.current?.abort();
    };
  }, []);
  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    riskZones
      .list(query, controller.signal)
      .then((result) => {
        if (active) {
          setData(result);
          setError("");
        }
      })
      .catch((err) => {
        if (active) setError(errorMessage(err));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [query, attempt]);
  function reload() {
    setAttempt((value) => value + 1);
  }
  async function details(id: string) {
    detailController.current?.abort();
    const controller = new AbortController();
    detailController.current = controller;
    setMutationError("");
    try {
      const zone = await riskZones.get(id, controller.signal);
      if (!controller.signal.aborted && alive.current) {
        if (selected?._id !== id) {
          setAssessmentNotes("");
          setOfficer("");
          setUrgency("");
          setStatusNotes("");
        }
        setSelected(zone);
        requestAnimationFrame(() => {
          selectedSection.current?.focus();
          selectedSection.current?.scrollIntoView({
            block: "start",
            behavior: "instant",
          });
        });
        setMessage("");
        setNewStatus("");
      }
    } catch (err) {
      if (!controller.signal.aborted && alive.current)
        setMutationError(errorMessage(err));
    }
  }
  async function mutate(
    task: () => Promise<RiskZone>,
    success: string,
    onSuccess?: (zone: RiskZone) => void,
  ) {
    if (lock.current || (uncertain && !ack)) return;
    lock.current = true;
    setBusy(true);
    setMutationError("");
    setMessage("");
    try {
      const zone = await task();
      if (!zone?._id || !/^[a-f0-9]{24}$/i.test(zone._id))
        throw new ApiError("Invalid confirmation", 0, "protocol");
      if (!alive.current) return;
      setSelected(zone);
      setMessage(success);
      setUncertain(false);
      setAck(false);
      onSuccess?.(zone);
      reload();
    } catch (err) {
      if (!alive.current) return;
      const ambiguous =
        !(err instanceof ApiError) || err.status === 0 || err.status >= 500;
      setUncertain(ambiguous);
      setAck(false);
      setMutationError(
        ambiguous
          ? "The change is unconfirmed and may have reached the server. Refresh and inspect current records before retrying."
          : errorMessage(err),
      );
      reload();
    } finally {
      lock.current = false;
      if (alive.current) setBusy(false);
    }
  }
  function create(event: FormEvent) {
    event.preventDefault();
    try {
      const input = zoneInput(draft);
      void mutate(
        () => riskZones.create(input),
        "Community risk zone registered.",
        () => {
          setDraft({ ...emptyZone });
          setShowCreate(false);
        },
      );
    } catch (err) {
      setMutationError(
        err instanceof Error ? err.message : "Check the form fields.",
      );
    }
  }
  function assess(event: FormEvent) {
    event.preventDefault();
    if (!selected) return;
    try {
      if (
        !assessmentUrgencies.includes(
          urgency as (typeof assessmentUrgencies)[number],
        )
      )
        throw new Error("Choose assessment urgency.");
      const notes = text(assessmentNotes, 5, 1000, "Assessment notes");
      const assignedOfficer = officer.trim()
        ? text(officer, 1, 100, "Officer")
        : undefined;
      void mutate(
        () =>
          riskZones.requestAssessment(selected._id, {
            priorityUrgency: urgency as (typeof assessmentUrgencies)[number],
            assessmentNotes: notes,
            ...(assignedOfficer ? { assignedOfficer } : {}),
          }),
        "Field assessment request recorded; no official dispatch performed.",
      );
    } catch (err) {
      setMutationError((err as Error).message);
    }
  }
  function changeStatus(event: FormEvent) {
    event.preventDefault();
    if (!selected) return;
    try {
      if (
        !assessmentStatuses.includes(newStatus as AssessmentStatus) ||
        newStatus === selected.assessmentStatus
      )
        throw new Error("Choose a different assessment status.");
      const notes = text(statusNotes, 3, 1000, "Status notes");
      void mutate(
        () =>
          riskZones.updateStatus(
            selected._id,
            newStatus as AssessmentStatus,
            notes,
          ),
        "Assessment status updated.",
      );
    } catch (err) {
      setMutationError((err as Error).message);
    }
  }
  const field = (
    key: keyof ZoneDraft,
    label: string,
    required = false,
    type = "text",
    maxLength = 150,
  ) => (
    <FormField key={key} label={label} required={required}>
      {(props) => (
        <Input
          {...props}
          value={draft[key]}
          onChange={(event) =>
            setDraft((old) => ({ ...old, [key]: event.target.value }))
          }
          type={type}
          maxLength={maxLength}
          step={type === "number" ? "any" : undefined}
        />
      )}
    </FormField>
  );
  const choices = (
    key: keyof ZoneDraft,
    label: string,
    values: readonly string[],
  ) => (
    <FormField key={key} label={label} required>
      {(props) => (
        <Select
          {...props}
          value={draft[key]}
          onChange={(event) =>
            setDraft((old) => ({ ...old, [key]: event.target.value }))
          }
        >
          <option value="">Choose {label.toLowerCase()}</option>
          {values.map((value) => (
            <option key={value} value={value}>
              {value.replaceAll("_", " ")}
            </option>
          ))}
        </Select>
      )}
    </FormField>
  );
  return (
    <div className="rqRiskWorkspace">
      <header className="rqRiskHeading">
        <div>
          <h2>Community Risk Zones</h2>
          <p>
            Coordinator records and proactive field assessments / API records
            only.
          </p>
        </div>
        <Button
          onClick={() => {
            setShowCreate(!showCreate);
            setMutationError("");
          }}
          disabled={busy}
        >
          {showCreate ? "Close registration" : "Register community"}
        </Button>
      </header>
      <p className="rqOperationsNotice">
        Prototype decision support. Reported hazards and estimated locations are
        not validated emergency advice. Recording an assessment does not
        dispatch official services.
      </p>
      <div ref={feedback} tabIndex={-1} aria-live="polite">
        {message && <p role="status">{message}</p>}
        {mutationError && <p role="alert">{mutationError}</p>}
      </div>
      {uncertain && (
        <label className="rqOperationsAck">
          <input
            type="checkbox"
            checked={ack}
            onChange={(event) => setAck(event.target.checked)}
          />
          I checked current records and understand a retry may repeat the
          change.
        </label>
      )}
      {showCreate && (
        <form onSubmit={create} className="rqCommandCard rqRiskForm">
          <h3>Register a community risk zone</h3>
          <fieldset disabled={busy || (uncertain && !ack)}>
            <div className="rqRiskFields">
              {field("communityName", "Community name", true)}
              {field("district", "District", true, "text", 100)}
              {field("tehsil", "Tehsil (optional)", false, "text", 100)}
              {field("landmark", "Approximate landmark", true, "text", 400)}
              {field("latitude", "Latitude (optional)", false, "number")}
              {field("longitude", "Longitude (optional)", false, "number")}
              {choices("hazardType", "Hazard type", hazardTypes)}
              {choices("hazardSeverity", "Hazard severity", hazardSeverities)}
              {choices("connectivity", "Connectivity", connectivityStatuses)}
              {choices("confidence", "Information confidence", [
                "HIGH",
                "MEDIUM",
                "LOW",
              ])}
              {field(
                "population",
                "Estimated population (optional)",
                false,
                "number",
              )}
              {field(
                "vulnerable",
                "Estimated vulnerable population (optional)",
                false,
                "number",
              )}
              {field(
                "obstacles",
                "Access obstacles (semicolon separated)",
                false,
                "text",
                1000,
              )}
              {field(
                "confidenceReasons",
                "Confidence reasons (semicolon separated)",
                false,
                "text",
                2000,
              )}
              <FormField label="Additional zone notes (optional)">
                {(props) => (
                  <Textarea
                    {...props}
                    value={draft.notes}
                    maxLength={1000}
                    onChange={(event) =>
                      setDraft((old) => ({ ...old, notes: event.target.value }))
                    }
                  />
                )}
              </FormField>
            </div>
            <p>
              Leave unknown coordinates and counts blank. All entered locations
              are marked estimated; the backend may lower information confidence
              when coordinates are missing.
            </p>
            <Button type="submit" loading={busy}>
              Save community risk zone
            </Button>
          </fieldset>
        </form>
      )}
      <form
        className="rqRiskFilters"
        onSubmit={(event) => {
          event.preventDefault();
          if (
            district.trim() &&
            (/[<>()[\]{}.*+?^$|\\]/.test(district) || district.length > 100)
          ) {
            setError("Use a district name without regular-expression symbols.");
            return;
          }
          setLoading(true);
          setQuery((old) => ({
            ...old,
            page: 1,
            district: district.trim() || undefined,
          }));
        }}
      >
        <FormField label="Filter district">
          {(props) => (
            <Input
              {...props}
              value={district}
              maxLength={100}
              onChange={(event) => setDistrict(event.target.value)}
            />
          )}
        </FormField>
        <FormField label="Filter severity">
          {(props) => (
            <Select
              {...props}
              value={query.hazardSeverity || ""}
              onChange={(event) => {
                setLoading(true);
                setQuery((old) => ({
                  ...old,
                  page: 1,
                  hazardSeverity:
                    (event.target.value as RiskZoneQuery["hazardSeverity"]) ||
                    undefined,
                }));
              }}
            >
              <option value="">All severities</option>
              {hazardSeverities.map((value) => (
                <option key={value}>{value}</option>
              ))}
            </Select>
          )}
        </FormField>
        <FormField label="Filter assessment status">
          {(props) => (
            <Select
              {...props}
              value={query.assessmentStatus || ""}
              onChange={(event) => {
                setLoading(true);
                setQuery((old) => ({
                  ...old,
                  page: 1,
                  assessmentStatus:
                    (event.target.value as AssessmentStatus) || undefined,
                }));
              }}
            >
              <option value="">All statuses</option>
              {assessmentStatuses.map((value) => (
                <option key={value}>{value}</option>
              ))}
            </Select>
          )}
        </FormField>
        <Button type="submit" variant="outline">
          Apply district
        </Button>
        <Button
          variant="outline"
          onClick={() => {
            reload();
            if (selected) void details(selected._id);
          }}
          disabled={busy}
        >
          Refresh risk zones
        </Button>
      </form>
      {error && (
        <p role="alert">{error} Previous records, if any, remain visible.</p>
      )}
      {loading && <p role="status">Loading community risk zones...</p>}
      <div className="rqRiskList">
        {data?.items.map((zone) => (
          <button
            className="rqCommandCard rqRiskRecord"
            key={zone._id}
            onClick={() => void details(zone._id)}
            disabled={busy}
          >
            <span className="rqCommandSeverity">{zone.hazardSeverity}</span>
            <h3>{zone.communityName}</h3>
            <p>
              {zone.district} / {zone.hazardType.replaceAll("_", " ")}
            </p>
            <p>{zone.approximateLocation.landmarkDescription}</p>
            <small>
              {zone.assessmentStatus.replaceAll("_", " ")}
              {zone.isSimulated ? " / SIMULATED" : ""}
            </small>
          </button>
        ))}
      </div>
      {!loading && data?.items.length === 0 && (
        <div className="siEmptyCompact">
          <h3>No local community assessments recorded yet.</h3>
          <p>
            Register a community or adjust filters. District weather monitoring
            remains available.
          </p>
        </div>
      )}
      {data && (
        <nav className="rqRiskPagination" aria-label="Risk zone pages">
          <Button
            variant="outline"
            disabled={(query.page || 1) <= 1 || loading}
            onClick={() => {
              setLoading(true);
              setQuery((old) => ({ ...old, page: (old.page || 1) - 1 }));
            }}
          >
            Previous page
          </Button>
          <span>
            Page {query.page || 1} of {Math.max(1, data.pagination.totalPages)}{" "}
            / {data.pagination.total} records
          </span>
          <Button
            variant="outline"
            disabled={
              (query.page || 1) >= data.pagination.totalPages || loading
            }
            onClick={() => {
              setLoading(true);
              setQuery((old) => ({ ...old, page: (old.page || 1) + 1 }));
            }}
          >
            Next page
          </Button>
        </nav>
      )}
      {selected && (
        <section
          className="rqCommandCard rqRiskDetail"
          ref={selectedSection}
          tabIndex={-1}
          aria-label="Selected community risk zone"
        >
          <header>
            <h3>{selected.communityName}</h3>
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => setSelected(null)}
            >
              Close zone details
            </Button>
          </header>
          <p>
            {selected.district} /{" "}
            {selected.assessmentStatus.replaceAll("_", " ")}
            {selected.isSimulated ? " / SIMULATED" : ""}
          </p>
          <p>{selected.approximateLocation.landmarkDescription}</p>
          <p>
            {selected.approximateLocation.latitude != null &&
            selected.approximateLocation.longitude != null
              ? `Estimated coordinates: ${selected.approximateLocation.latitude}, ${selected.approximateLocation.longitude}`
              : "Coordinates unknown / landmark only"}
          </p>
          <p>
            Connectivity: {selected.connectivityStatus.replaceAll("_", " ")} /
            Information confidence: {selected.informationConfidence}
          </p>
          <p>
            Estimated population:{" "}
            {selected.vulnerablePopulation?.estimatedTotalPopulation ??
              "Unknown"}{" "}
            / Vulnerable:{" "}
            {selected.vulnerablePopulation?.estimatedVulnerableCount ??
              "Unknown"}
          </p>
          <ul>
            {selected.confidenceReasons?.map((reason, index) => (
              <li key={index}>{reason}</li>
            ))}
          </ul>
          {selected.fieldAssessment && (
            <p>
              Last assessment request:{" "}
              {selected.fieldAssessment.priorityUrgency} /{" "}
              {selected.fieldAssessment.assessmentNotes} / Officer:{" "}
              {selected.fieldAssessment.assignedOfficer || "Not assigned"}
            </p>
          )}
          <div className="rqRiskFields">
            <form onSubmit={assess}>
              <fieldset disabled={busy || (uncertain && !ack)}>
                <legend>Request a field assessment</legend>
                <FormField label="Assessment urgency" required>
                  {(props) => (
                    <Select
                      {...props}
                      value={urgency}
                      onChange={(event) => setUrgency(event.target.value)}
                    >
                      <option value="">Choose urgency</option>
                      {assessmentUrgencies.map((value) => (
                        <option key={value}>{value}</option>
                      ))}
                    </Select>
                  )}
                </FormField>
                <FormField label="Assigned officer (optional)">
                  {(props) => (
                    <Input
                      {...props}
                      maxLength={100}
                      value={officer}
                      onChange={(event) => setOfficer(event.target.value)}
                    />
                  )}
                </FormField>
                <FormField label="Assessment request notes" required>
                  {(props) => (
                    <Textarea
                      {...props}
                      minLength={5}
                      maxLength={1000}
                      value={assessmentNotes}
                      onChange={(event) =>
                        setAssessmentNotes(event.target.value)
                      }
                    />
                  )}
                </FormField>
                <Button type="submit" loading={busy}>
                  Record assessment request
                </Button>
              </fieldset>
            </form>
            <form onSubmit={changeStatus}>
              <fieldset disabled={busy || (uncertain && !ack)}>
                <legend>Update assessment status</legend>
                <FormField label="New assessment status" required>
                  {(props) => (
                    <Select
                      {...props}
                      value={
                        newStatus === selected.assessmentStatus ? "" : newStatus
                      }
                      onChange={(event) => setNewStatus(event.target.value)}
                    >
                      <option value="">Choose a different status</option>
                      {assessmentStatuses
                        .filter((value) => value !== selected.assessmentStatus)
                        .map((value) => (
                          <option key={value}>{value}</option>
                        ))}
                    </Select>
                  )}
                </FormField>
                <FormField label="Assessment status notes" required>
                  {(props) => (
                    <Textarea
                      {...props}
                      minLength={3}
                      maxLength={1000}
                      value={statusNotes}
                      onChange={(event) => setStatusNotes(event.target.value)}
                    />
                  )}
                </FormField>
                <Button type="submit" loading={busy}>
                  Save assessment status
                </Button>
              </fieldset>
            </form>
          </div>
          <h4>Field assessment history</h4>
          {(selected.assessments?.length
            ? selected.assessments
            : selected.fieldAssessment
              ? [selected.fieldAssessment]
              : []
          ).map((entry, index) => (
            <article className="siLocalRecord" key={index}>
              <strong>{entry.priorityUrgency} assessment</strong>
              <p>{entry.assessmentNotes}</p>
              <small>
                {new Date(entry.requestedAt).toLocaleString("en-PK", {
                  timeZone: "Asia/Karachi",
                })}
                {entry.completedAt
                  ? ` / Completed ${new Date(entry.completedAt).toLocaleString("en-PK", { timeZone: "Asia/Karachi" })}`
                  : " / Pending completion"}
              </small>
            </article>
          ))}
          <h4>Status history</h4>
          <ul>
            {selected.statusHistory?.map((entry, index) => (
              <li key={index}>
                {entry.previousStatus} to {entry.newStatus}: {entry.notes}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
