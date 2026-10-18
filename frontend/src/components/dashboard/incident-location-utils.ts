import type { Incident } from "@/types/api";

export interface IncidentLocationInfo {
  status: "VERIFIED" | "AWAITING_VERIFICATION" | "LANDMARK_PENDING" | "UNKNOWN";
  label: string;
  subtext: string;
  hasCoordinates: boolean;
  coordinatesText?: string;
  addressText?: string;
}

/**
 * Honest, non-fabricating location verification parser based on actual backend data.
 *
 * CASE 1 — VALID COORDINATES, NOT VERIFIED:
 *   "Location reported — awaiting verification"
 *   "Map position is available but has not been coordinator-verified."
 *
 * CASE 2 — VERIFIED COORDINATES:
 *   "Location verified"
 *   "Coordinates confirmed by coordinator."
 *
 * CASE 3 — TEXT LANDMARK, NO COORDINATES:
 *   "Landmark provided — map position pending"
 *   Address or landmark string without fabricated GPS.
 *
 * CASE 4 — NO USEFUL LOCATION:
 *   "Location unknown — follow-up needed"
 */
export function getIncidentLocationInfo(incident: Incident): IncidentLocationInfo {
  const coords = incident.location;
  const hasCoords =
    coords !== null &&
    coords !== undefined &&
    typeof coords.latitude === "number" &&
    typeof coords.longitude === "number" &&
    !isNaN(coords.latitude) &&
    !isNaN(coords.longitude);

  const rawAddress = coords?.address?.trim();
  const hasAddress = Boolean(rawAddress && rawAddress !== "Location verification required" && rawAddress !== "Location unverified");
  const addressText = hasAddress ? rawAddress : undefined;

  // CASE 2: Backend explicitly confirms location verification.
  // We do not assume general report verification implies GPS verification unless explicitly recorded.
  const isExplicitlyVerified =
    hasCoords &&
    incident.locationVerificationRequired === false &&
    incident.verification?.status === "VERIFIED";

  if (isExplicitlyVerified) {
    return {
      status: "VERIFIED",
      label: "Location verified",
      subtext: "Coordinates confirmed by coordinator.",
      hasCoordinates: true,
      coordinatesText: `${coords!.latitude.toFixed(4)}, ${coords!.longitude.toFixed(4)}`,
      addressText,
    };
  }

  // CASE 1: Valid coordinates, not coordinator-verified
  if (hasCoords) {
    return {
      status: "AWAITING_VERIFICATION",
      label: "Reported location — awaiting verification",
      subtext: "This reported map position has not been independently confirmed.",
      hasCoordinates: true,
      coordinatesText: `${coords!.latitude.toFixed(4)}, ${coords!.longitude.toFixed(4)}`,
      addressText,
    };
  }

  // CASE 3: Text landmark, no coordinates
  if (hasAddress) {
    return {
      status: "LANDMARK_PENDING",
      label: "Landmark provided — map location pending",
      subtext: "Address provided without GPS coordinates.",
      hasCoordinates: false,
      addressText,
    };
  }

  // CASE 4: No useful location
  return {
    status: "UNKNOWN",
    label: "Location unavailable",
    subtext: "No coordinates or landmark provided.",
    hasCoordinates: false,
  };
}

/**
 * Format timestamp in human-readable local time with relative time fallback.
 */
export function formatIncidentTime(isoString: string): { formatted: string; relative: string } {
  try {
    const date = new Date(isoString);
    if (isNaN(date.getTime())) {
      return { formatted: "Unknown time", relative: "" };
    }

    const formatted = date.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

    const now = Date.now();
    const diffMs = now - date.getTime();
    const diffMin = Math.round(diffMs / 60000);

    let relative = "";
    if (diffMin < 1) {
      relative = "Just now";
    } else if (diffMin < 60) {
      relative = `${diffMin}m ago`;
    } else {
      const diffHours = Math.round(diffMin / 60);
      if (diffHours < 24) {
        relative = `${diffHours}h ago`;
      } else {
        const diffDays = Math.round(diffHours / 24);
        relative = `${diffDays}d ago`;
      }
    }

    return { formatted, relative };
  } catch {
    return { formatted: isoString || "Unknown time", relative: "" };
  }
}
