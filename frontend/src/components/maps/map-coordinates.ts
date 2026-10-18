export interface MapPoint {
  latitude: number;
  longitude: number;
}
export type MapPosition = [number, number];

// API schemas store named numeric fields. Never coerce null/blank strings to 0,
// guess coordinate ordering, geocode text, or move a point into our region.
export function validCoordinates(value: unknown): value is MapPoint {
  if (!value || typeof value !== "object") return false;
  const point = value as Partial<MapPoint>;
  return (
    typeof point.latitude === "number" &&
    Number.isFinite(point.latitude) &&
    typeof point.longitude === "number" &&
    Number.isFinite(point.longitude) &&
    Math.abs(point.latitude) <= 90 &&
    Math.abs(point.longitude) <= 180
  );
}
export function mapPosition(value: unknown): MapPosition | null {
  return validCoordinates(value) ? [value.latitude, value.longitude] : null;
}
// Only explicitly identified GeoJSON Points use longitude-first ordering.
export function geoJsonPosition(value: unknown): MapPosition | null {
  if (!value || typeof value !== "object") return null;
  const point = value as { type?: unknown; coordinates?: unknown };
  if (
    point.type !== "Point" ||
    !Array.isArray(point.coordinates) ||
    point.coordinates.length < 2
  )
    return null;
  return mapPosition({
    latitude: point.coordinates[1],
    longitude: point.coordinates[0],
  });
}
export const SINDH_CENTER: MapPosition = [26.1, 68.5];
export const SINDH_ZOOM = 7;
export const KARACHI_CENTER: MapPosition = [24.8607, 67.0011];
export const KARACHI_ZOOM = 11;
export function outsideOperationalRegion(point: MapPoint) {
  // Approximate regional extent, not an administrative boundary or validity rule.
  return (
    point.latitude < 23.4 ||
    point.latitude > 28.6 ||
    point.longitude < 66.4 ||
    point.longitude > 71.2
  );
}
