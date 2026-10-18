import type { Marker } from "leaflet";

export function bindMarkerActivation(marker: Marker, activate: () => void) {
  marker.on("click", activate);
  const element = marker.getElement();
  const keydown = (event: KeyboardEvent) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    event.stopPropagation();
    activate();
    marker.openPopup();
  };
  element?.addEventListener("keydown", keydown);
  marker.once("remove", () => element?.removeEventListener("keydown", keydown));
}
