export type MarkerKind = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "AVAILABLE" | "BUSY";
const colors: Record<MarkerKind, string> = {
  CRITICAL: "#ee354b", HIGH: "#f18429", MEDIUM: "#2789fa", LOW: "#657d98",
  AVAILABLE: "#09ac71", BUSY: "#2879dc",
};
// Only controlled paths enter this markup. Record text uses Leaflet textContent.
export function markerMarkup(kind: MarkerKind, selected = false) {
  const path = kind === "AVAILABLE" || kind === "BUSY"
    ? '<path d="M4 15V9l2-4h12l2 4v6M4 10h16M8 6v4m8-4v4M7 14h.01M17 14h.01M5 15v3h3v-3m8 0v3h3v-3M4 15h16"/>'
    : kind === "HIGH"
      ? '<path d="m12 3 10 18H2L12 3Zm0 6v5m0 3h.01"/>'
      : kind === "CRITICAL"
        ? '<circle cx="12" cy="12" r="9"/><path d="M12 7v6m0 4h.01"/>'
        : '<circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10h.01"/>';
  return `<span class="rqMapSymbol ${kind.toLowerCase()}${selected ? " is-selected" : ""}" style="--marker-color:${colors[kind]}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${path}</svg></span>`;
}
