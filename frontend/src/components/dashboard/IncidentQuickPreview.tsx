"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Incident } from "@/types/api";
import { useDashboard } from "./dashboard-context";
import { incidentTitle } from "./incident-visual";
import {
  getIncidentLocationInfo,
  formatIncidentTime,
} from "./incident-location-utils";
import { IncidentMiniMap, IncidentLocationEmptyState } from "./IncidentMiniMap";
import {
  X,
  MapPin,
  Clock,
  Users,
  AlertTriangle,
  ArrowUpRight,
  Copy,
  Check,
  ShieldAlert,
  Droplets,
  HeartPulse,
  Flame,
  LifeBuoy,
  Package,
  HelpCircle,
  type LucideIcon,
} from "lucide-react";

interface IncidentQuickPreviewProps {
  incident: Incident | null;
  onClose: () => void;
}

const emergencyIcons: Record<string, LucideIcon> = {
  FLOOD: Droplets,
  MEDICAL: HeartPulse,
  FIRE: Flame,
  STRANDED: LifeBuoy,
  SUPPLIES: Package,
  OTHER: AlertTriangle,
};

export function IncidentQuickPreview({
  incident,
  onClose,
}: IncidentQuickPreviewProps) {
  const router = useRouter();
  const { isDemoMode } = useDashboard();
  const [copied, setCopied] = useState(false);
  const drawerRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  // Store element that had focus before opening and focus drawer on open
  useEffect(() => {
    if (incident) {
      previousFocusRef.current = document.activeElement as HTMLElement | null;
      // Focus drawer close button or panel for accessibility
      setTimeout(() => {
        closeButtonRef.current?.focus();
      }, 50);
    } else if (previousFocusRef.current) {
      previousFocusRef.current.focus();
    }
  }, [incident]);

  useEffect(() => {
    if (!incident) return;
    const elements = new Set<HTMLElement>([document.body, document.documentElement]);
    for (let node = drawerRef.current?.parentElement; node; node = node.parentElement) elements.add(node);
    const previous = [...elements].map(element => ({element,overflow:element.style.overflow}));
    previous.forEach(({element}) => {element.style.overflow="hidden";});
    return () => previous.forEach(({element,overflow}) => {element.style.overflow=overflow;});
  }, [incident]);

  // Keyboard accessibility: Escape to close and Tab trapping
  useEffect(() => {
    if (!incident) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }

      if (event.key === "Tab" && drawerRef.current) {
        const focusables = drawerRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        );
        if (focusables.length === 0) return;

        const first = focusables[0];
        const last = focusables[focusables.length - 1];

        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [incident, onClose]);

  if (!incident) return null;

  const shortRef =
    incident.reportReference ||
    `RESQ-${incident._id.replace(/[^a-zA-Z0-9]/g, "").slice(-6).toUpperCase()}`;
  const Icon = emergencyIcons[incident.emergencyType] || HelpCircle;
  const locationInfo = getIncidentLocationInfo(incident);
  const timeInfo = formatIncidentTime(incident.createdAt);

  const copyReference = async () => {
    try {
      await navigator.clipboard.writeText(shortRef);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
    }
  };

  const handleOpenWorkspace = () => {
    const destination = `/dashboard/incidents/${encodeURIComponent(incident._id)}${
      isDemoMode ? "?demo=true" : ""
    }`;
    onClose();
    router.push(destination);
  };

  // Compile any KNOWN optional emergency details (omitting all unknown / empty items)
  const knownDetails: { label: string; value: string }[] = [];

  if (incident.waterLevel && incident.waterLevel !== "UNKNOWN" && incident.waterLevel !== "NONE") {
    knownDetails.push({
      label: "Water Level",
      value: incident.waterLevel.toLowerCase().replace(/^\w/, (c) => c.toUpperCase()),
    });
  }

  if (incident.immediateDanger === true) {
    knownDetails.push({
      label: "Immediate Danger",
      value: "High threat to life reported",
    });
  }

  const vulnerable = incident.vulnerablePeople;
  if (vulnerable) {
    const parts: string[] = [];
    if (vulnerable.children && vulnerable.children > 0) parts.push(`${vulnerable.children} children`);
    if (vulnerable.elderly && vulnerable.elderly > 0) parts.push(`${vulnerable.elderly} elderly`);
    if (vulnerable.disabled && vulnerable.disabled > 0) parts.push(`${vulnerable.disabled} disabled`);
    if (vulnerable.medicalNeeds && vulnerable.medicalNeeds > 0) parts.push(`${vulnerable.medicalNeeds} medical needs`);
    if (parts.length > 0) {
      knownDetails.push({
        label: "Vulnerable Groups",
        value: parts.join(", "),
      });
    }
  }

  const verificationStatusText = incident.verification?.status
    ? incident.verification.status.replaceAll("_", " ")
    : "Needs Review";

  const isNeedsReview =
    !incident.verification?.status ||
    incident.verification.status === "NEEDS_REVIEW";

  return (
    <div
      className="rqQuickPreviewBackdrop"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <aside
        ref={drawerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="quick-preview-title"
        aria-describedby="quick-preview-desc"
        className="rqQuickPreviewDrawer"
      >
        {/* Mobile Pull Indicator */}
        <div className="rqQuickPreviewHandle" aria-hidden="true">
          <span />
        </div>

        {/* Drawer Header */}
        <header className="rqQuickPreviewHeader">
          <div className="rqQuickPreviewHeaderMeta">
            <span className="rqQuickPreviewEyebrow">Incident Quick Preview</span>
            <div className="flex items-center gap-2">
              <h2 id="quick-preview-title" className="rqQuickPreviewHeaderTitle">
                Reported Emergency
              </h2>
              <span className="rqQuickPreviewRefBadge">{shortRef}</span>
              <button
                type="button"
                className="rqQuickPreviewCopyBtn"
                onClick={copyReference}
                title="Copy Incident Reference"
                aria-label={`Copy reference ${shortRef}`}
              >
                {copied ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} />}
                {copied && <span className="text-[10px] text-emerald-500 font-semibold">Copied</span>}
              </button>
            </div>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            className="rqQuickPreviewCloseBtn"
            onClick={onClose}
            aria-label="Close incident quick preview"
          >
            <X size={18} />
          </button>
        </header>

        {/* Scrollable Content Body */}
        <div className="rqQuickPreviewBody" id="quick-preview-desc">
          {/* Identity & Badges Block */}
          <div className="rqQuickPreviewHero">
            <div className={`rqQuickPreviewIconBox rqQuickPreviewIcon-${incident.emergencyType.toLowerCase()}`}>
              <Icon size={24} aria-hidden="true" />
            </div>
            <div className="rqQuickPreviewHeroInfo">
              <div className="rqQuickPreviewCategory">
                {incidentTitle(incident)}
              </div>
              <p className="rqQuickPreviewShortId">
                Ref ID: #{incident._id.slice(-6).toUpperCase()}
              </p>
            </div>
          </div>

          {/* Status Badges Row */}
          <div className="rqQuickPreviewBadges">
            <span
              className={`rqCommandSeverity ${incident.priorityLevel.toLowerCase()}`}
              title={`Urgency: ${incident.priorityLevel}`}
            >
              {incident.priorityLevel}
            </span>
            <span className="rqQuickPreviewStatusBadge" title={`Lifecycle: ${incident.status}`}>
              {incident.status.replaceAll("_", " ")}
            </span>
            <span
              className={`rqQuickPreviewVerifBadge ${isNeedsReview ? "is-needs-review" : "is-verified"}`}
              title={`Verification: ${verificationStatusText}`}
            >
              {verificationStatusText}
            </span>
          </div>

          {/* Section: Location Availability & Verification */}
          <div className="rqQuickPreviewCard">
            <div className="rqQuickPreviewCardHeader">
              <MapPin size={15} className="text-[var(--command-blue)] shrink-0" aria-hidden="true" />
              <strong>Reported Location</strong>
            </div>

            <div className="rqQuickPreviewLocationContent">
              <p className="rqQuickPreviewLocationLabel">
                {locationInfo.label}
              </p>
              <p className="rqQuickPreviewLocationSubtext">
                {locationInfo.subtext}
              </p>

              {locationInfo.addressText && (
                <div className="rqQuickPreviewLocationAddress">
                  <span className="text-[10px] uppercase font-semibold text-[var(--command-muted)]">Address / Landmark</span>
                  <p>{locationInfo.addressText}</p>
                </div>
              )}

              {locationInfo.hasCoordinates ? (
                <IncidentMiniMap incident={incident} />
              ) : (
                <IncidentLocationEmptyState
                  label={locationInfo.label}
                  subtext={locationInfo.subtext}
                />
              )}
            </div>
          </div>

          {/* Section: Timestamp & Reporter Info */}
          <div className="rqQuickPreviewGrid2">
            <div className="rqQuickPreviewCard sm-pad">
              <div className="rqQuickPreviewCardHeader">
                <Clock size={14} className="text-[var(--command-muted)] shrink-0" aria-hidden="true" />
                <span className="text-xs font-semibold text-[var(--command-muted)]">Reported Time</span>
              </div>
              <p className="rqQuickPreviewVal">{timeInfo.formatted}</p>
              {timeInfo.relative && (
                <small className="text-[10px] text-[var(--command-muted)]">{timeInfo.relative}</small>
              )}
            </div>

            <div className="rqQuickPreviewCard sm-pad">
              <div className="rqQuickPreviewCardHeader">
                <Users size={14} className="text-[var(--command-muted)] shrink-0" aria-hidden="true" />
                <span className="text-xs font-semibold text-[var(--command-muted)]">People Affected</span>
              </div>
              <p className="rqQuickPreviewVal">
                {typeof incident.peopleAffected === "number" && !isNaN(incident.peopleAffected)
                  ? `${incident.peopleAffected} individuals`
                  : "Not reported"}
              </p>
              <small className="text-[10px] text-[var(--command-muted)]">
                Reporter: {incident.reporterName || "Anonymous"}
              </small>
            </div>
          </div>

          {/* Section: Description Preview */}
          <div className="rqQuickPreviewCard">
            <div className="rqQuickPreviewCardHeader">
              <span className="text-xs font-semibold text-[var(--command-muted)]">Description</span>
            </div>
            <p className="rqQuickPreviewDescription">
              {incident.description && incident.description.trim()
                ? incident.description
                : "No additional details provided"}
            </p>
          </div>

          {/* Section: Known Emergency Details (Only shown if known; no 15 Unknown rows) */}
          <div className="rqQuickPreviewCard">
            <div className="rqQuickPreviewCardHeader">
              <span className="text-xs font-semibold text-[var(--command-muted)]">Emergency Details</span>
            </div>
            {knownDetails.length > 0 ? (
              <dl className="rqQuickPreviewDetailList">
                {knownDetails.map((item, idx) => (
                  <div key={idx} className="rqQuickPreviewDetailItem">
                    <dt>{item.label}</dt>
                    <dd>{item.value}</dd>
                  </div>
                ))}
              </dl>
            ) : (
              <p className="text-xs text-[var(--command-muted)] italic">
                Additional emergency details have not been provided.
              </p>
            )}
          </div>

          {/* Section: Coordination & Human Confirmation Notice */}
          <div className="rqQuickPreviewNotice">
            <ShieldAlert size={16} className="text-[var(--command-blue)] shrink-0 mt-0.5" aria-hidden="true" />
            <div>
              <p className="font-semibold text-xs text-[var(--command-ink)]">
                Location awaiting confirmation
              </p>
              <p className="text-[11px] text-[var(--command-muted)] mt-0.5 leading-relaxed">
                Human review is required before field dispatch. Complete team assignment, triage risk analysis, and verification in the Incident Workspace.
              </p>
            </div>
          </div>
        </div>

        {/* Sticky Actions Footer */}
        <footer className="rqQuickPreviewFooter">
          <button
            type="button"
            className="rqQuickPreviewPrimaryAction"
            onClick={handleOpenWorkspace}
          >
            <span>Open Incident Workspace</span>
            <ArrowUpRight size={17} aria-hidden="true" />
          </button>
          <button
            type="button"
            className="rqQuickPreviewSecondaryAction"
            onClick={onClose}
          >
            Close Preview
          </button>
        </footer>
      </aside>
    </div>
  );
}
