import type L from "leaflet";

export type IncidentPriority = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
export type RescueTeamStatus = "AVAILABLE" | "BUSY" | "OFFLINE";
export type MarkerKind = IncidentPriority | "AVAILABLE" | "BUSY";

export interface MarkerDimensions {
  size: number;
  anchor: [number, number];
  popupAnchor: [number, number];
}

/**
 * Balanced marker dimensions per visual bounds:
 * CRITICAL: 38px, anchor [19, 19]
 * HIGH: 36px, anchor [18, 18]
 * MEDIUM: 34px, anchor [17, 17]
 * LOW: 32px, anchor [16, 16]
 * AVAILABLE: 38px, anchor [19, 19]
 * BUSY: 38px, anchor [19, 19]
 */
export const MARKER_DIMENSIONS: Record<MarkerKind, MarkerDimensions> = {
  CRITICAL: { size: 38, anchor: [19, 19], popupAnchor: [0, -23] },
  HIGH: { size: 36, anchor: [18, 18], popupAnchor: [0, -22] },
  MEDIUM: { size: 34, anchor: [17, 17], popupAnchor: [0, -21] },
  LOW: { size: 32, anchor: [16, 16], popupAnchor: [0, -20] },
  AVAILABLE: { size: 38, anchor: [19, 19], popupAnchor: [0, -23] },
  BUSY: { size: 38, anchor: [19, 19], popupAnchor: [0, -23] },
};

/**
 * Optimized square transparent image assets centered at 256x256
 */
export const MARKER_ASSETS: Record<MarkerKind, string> = {
  CRITICAL: "/images/icons/optimized/critical-incident.png",
  HIGH: "/images/icons/optimized/high-incident.png",
  MEDIUM: "/images/icons/optimized/medium-incident.png",
  LOW: "/images/icons/optimized/low-incident.png",
  AVAILABLE: "/images/icons/optimized/team-available.png",
  BUSY: "/images/icons/optimized/team-busy.png",
};

/**
 * Mapping of original source filenames provided by Tech Lead
 */
export const ORIGINAL_ICON_ASSETS: Record<MarkerKind, string> = {
  CRITICAL: "/images/icons/Red Critical Alert Icon.png",
  HIGH: "/images/icons/Glossy Orange Warning Badge.png",
  MEDIUM: "/images/icons/Blue Medium Incident Information Icon.png",
  LOW: "/images/icons/Glowing Low Incident Information Icon.png",
  AVAILABLE: "/images/icons/Neon Green Emergency Vehicle Icon.png",
  BUSY: "/images/icons/Neon Emergency Response Vehicle Badge.png",
};

export const LEGEND_ITEMS: Array<{
  kind: MarkerKind;
  label: string;
  asset: string;
}> = [
  {
    kind: "CRITICAL",
    label: "Critical Incident",
    asset: MARKER_ASSETS.CRITICAL,
  },
  { kind: "HIGH", label: "High Incident", asset: MARKER_ASSETS.HIGH },
  { kind: "MEDIUM", label: "Medium Incident", asset: MARKER_ASSETS.MEDIUM },
  { kind: "LOW", label: "Low Incident", asset: MARKER_ASSETS.LOW },
  {
    kind: "AVAILABLE",
    label: "Available Team",
    asset: MARKER_ASSETS.AVAILABLE,
  },
  { kind: "BUSY", label: "Team On Mission", asset: MARKER_ASSETS.BUSY },
];

/**
 * Generates custom HTML markup for Leaflet DivIcon
 */
export function markerMarkup(kind: MarkerKind, selected = false): string {
  const normalized = (kind in MARKER_ASSETS ? kind : "LOW") as MarkerKind;
  const asset = MARKER_ASSETS[normalized];
  const dim = MARKER_DIMENSIONS[normalized];
  const className = `rqMapSymbol ${normalized.toLowerCase()}${selected ? " is-selected" : ""}`;

  return `<span class="${className}" style="width:${dim.size}px;height:${dim.size}px;" role="img" aria-label="${normalized} marker"><img src="${asset}" alt="${normalized}" class="rqMapIconImg" width="${dim.size}" height="${dim.size}" draggable="false" /></span>`;
}

// Global icon instance cache to prevent excessive DOM / DivIcon recreation on re-renders
const iconCache = new Map<string, L.DivIcon>();

/**
 * Reusable Leaflet marker factory for incidents
 */
export function getIncidentMarkerIcon(
  L: typeof import("leaflet"),
  priority: string | undefined,
  selected = false,
): L.DivIcon {
  const normalized = (
    priority && priority.toUpperCase() in MARKER_ASSETS
      ? priority.toUpperCase()
      : "LOW"
  ) as MarkerKind;
  const cacheKey = `incident:${normalized}:${selected}`;
  let icon = iconCache.get(cacheKey);

  if (!icon) {
    const dim = MARKER_DIMENSIONS[normalized];
    icon = L.divIcon({
      className: "rqMapMarker",
      html: markerMarkup(normalized, selected),
      iconSize: [dim.size, dim.size],
      iconAnchor: dim.anchor,
      popupAnchor: dim.popupAnchor,
    });
    iconCache.set(cacheKey, icon);
  }

  return icon;
}

/**
 * Reusable Leaflet marker factory for rescue teams
 */
export function getRescueTeamMarkerIcon(
  L: typeof import("leaflet"),
  status: string | undefined,
  selected = false,
): L.DivIcon {
  if (status === "OFFLINE") {
    const key = `team:OFFLINE:${selected}`;
    let icon = iconCache.get(key);
    if (!icon) {
      icon = L.divIcon({
        className: "rqMapMarker",
        html: `<span class="rqMapOffline${selected ? " is-selected" : ""}" role="img" aria-label="Offline team">×</span>`,
        iconSize: [32, 32],
        iconAnchor: [16, 16],
        popupAnchor: [0, -18],
      });
      iconCache.set(key, icon);
    }
    return icon;
  }
  const normalized = (
    status === "AVAILABLE" ? "AVAILABLE" : "BUSY"
  ) as MarkerKind;
  const cacheKey = `team:${normalized}:${selected}`;
  let icon = iconCache.get(cacheKey);

  if (!icon) {
    const dim = MARKER_DIMENSIONS[normalized];
    icon = L.divIcon({
      className: "rqMapMarker",
      html: markerMarkup(normalized, selected),
      iconSize: [dim.size, dim.size],
      iconAnchor: dim.anchor,
      popupAnchor: dim.popupAnchor,
    });
    iconCache.set(cacheKey, icon);
  }

  return icon;
}
