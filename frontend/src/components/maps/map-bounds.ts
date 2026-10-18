import type { Map as LeafletMap } from "leaflet";
import { SINDH_CENTER, SINDH_ZOOM, type MapPosition } from "./map-coordinates";

export function fitMapPositions(
  map: LeafletMap,
  positions: MapPosition[],
  animate = false,
) {
  if (!positions.length) map.setView(SINDH_CENTER, SINDH_ZOOM, { animate });
  else if (positions.length === 1) map.setView(positions[0], 12, { animate });
  else map.fitBounds(positions, { padding: [45, 45], maxZoom: 13, animate });
}

// Compare only coordinates, so status polling and marker selection do not
// repeatedly reset a coordinator's pan/zoom.
export function positionsKey(positions: MapPosition[]) {
  return JSON.stringify(
    [...positions].sort((a, b) => a[0] - b[0] || a[1] - b[1]),
  );
}
