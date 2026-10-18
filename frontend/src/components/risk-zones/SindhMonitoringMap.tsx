"use client";
import { useEffect, useRef } from "react";
import type { LayerGroup, CircleMarker } from "leaflet";
import { Plus, Minus, Crosshair, MapPin } from "lucide-react";
import { useMapBase } from "@/components/maps/use-map-base";
import { MapFeedback } from "@/components/maps/MapFeedback";
import { validCoordinates } from "@/components/maps/map-coordinates";
import type { MonitoredDistrict, AttentionLevel } from "@/types/risk-zones";
import { attentionLabels } from "./monitoring-utils";
const colors: Record<AttentionLevel, string> = {
  ROUTINE: "#1688f8",
  ELEVATED: "#d88b0a",
  URGENT_REVIEW: "#ef4444",
  DATA_UNAVAILABLE: "#8493a7",
};
export function SindhMonitoringMap({
  items,
  selectedId,
  onSelect,
}: {
  items: MonitoredDistrict[];
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  const element = useRef<HTMLDivElement>(null),
    layers = useRef<LayerGroup | null>(null),
    markers = useRef(new Map<string, CircleMarker>());
  const select = useRef(onSelect);
  useEffect(() => {
    select.current = onSelect;
  }, [onSelect]);
  const { map, ready, status, retry } = useMapBase(element);
  const fitted = useRef(false),
    focused = useRef(selectedId);
  const signature = JSON.stringify(
    items
      .filter(validCoordinates)
      .map((item) => [
        item.id,
        item.name,
        item.latitude,
        item.longitude,
        item.attention?.level,
        item.weather?.next24Hours.precipitationMm,
        item.weather?.retrievedAt,
        item.weather?.current.temperatureC,
        item.weather?.provider,
      ]),
  );
  useEffect(() => {
    let active = true;
    void import("leaflet").then((L) => {
      if (!active || !ready || !map.current) return;
      layers.current = L.layerGroup().addTo(map.current);
    });
    return () => {
      active = false;
      layers.current?.remove();
      layers.current = null;
    };
  }, [map, ready]);
  useEffect(() => {
    let active = true;
    void import("leaflet").then((L) => {
      if (!active || !ready || !layers.current) return;
      layers.current.clearLayers();
      markers.current.clear();
      const records = JSON.parse(signature) as [
        string,
        string,
        number,
        number,
        AttentionLevel | undefined,
        number | undefined,
        string | undefined,
        number | undefined,
        string | undefined,
      ][];
      for (const [
        id,
        name,
        latitude,
        longitude,
        status,
        rain,
        retrievedAt,
        temperatureC,
        provider,
      ] of records) {
        const level = status || "DATA_UNAVAILABLE";
        const content = document.createElement("div");
        content.textContent = `${name} · ${attentionLabels[level]} · ${typeof temperatureC !== "number" ? "Temperature unavailable" : `${temperatureC}°C`} · ${typeof rain !== "number" ? "Forecast unavailable" : `${rain} mm / next 24h`} · ${provider || "No weather source"} · ${retrievedAt ? new Date(retrievedAt).toLocaleString("en-PK", { timeZone: "Asia/Karachi" }) : "Not retrieved"} (Asia/Karachi). Representative town point.`;
        const review = document.createElement("button");
        review.type = "button";
        review.textContent = "Review District";
        review.addEventListener("click", () => select.current(id));
        content.append(document.createElement("br"), review);
        const marker = L.circleMarker([latitude, longitude], {
          radius: focused.current === id ? 13 : 9,
          color: "#fff",
          weight: 2,
          fillColor: colors[level],
          fillOpacity: 1,
        })
          .bindPopup(content)
          .on("click", () => select.current(id))
          .addTo(layers.current);
        const path = marker.getElement();
        path?.setAttribute("aria-label", `Select district ${name}`);
        path?.setAttribute("role", "button");
        path?.setAttribute("tabindex", "0");
        path?.addEventListener("keydown", (event) => {
          if ((event as KeyboardEvent).key === "Enter") {
            select.current(id);
            marker.openPopup();
          }
        });
        markers.current.set(id, marker);
      }
      if (!fitted.current && records.length) {
        map.current?.fitBounds(
          records.map((row) => [row[2], row[3]] as [number, number]),
          { padding: [35, 35], maxZoom: 7 },
        );
        fitted.current = true;
      }
    });
    return () => {
      active = false;
    };
  }, [map, ready, signature]);
  useEffect(() => {
    if (!ready) return;
    for (const [id, marker] of markers.current) {
      marker.setRadius(id === selectedId ? 13 : 9);
      marker.setStyle({ weight: id === selectedId ? 4 : 2 });
      if (id === selectedId) marker.bringToFront();
    }
  }, [ready, signature, selectedId]);
  const selected = items.find((item) => item.id === selectedId),
    lat = selected?.latitude,
    lon = selected?.longitude;
  useEffect(() => {
    if (
      ready &&
      lat !== undefined &&
      lon !== undefined &&
      focused.current !== selectedId
    ) {
      map.current?.panTo([lat, lon], { animate: false });
      focused.current = selectedId;
    }
  }, [map, ready, lat, lon, selectedId]);
  return (
    <section className="siCard siMapCard">
      <header>
        <h2>
          <MapPin size={16} />
          Sindh Monitoring Map
        </h2>
        <span>Representative locations</span>
      </header>
      <div className="siMapFrame">
        <div
          ref={element}
          className="siMap rqOperationalMap"
          aria-label="Sindh district monitoring locations"
        />
        <MapFeedback status={status} retry={retry} />
        <div className="siMapLegend">
          {Object.entries(attentionLabels).map(([key, value]) => (
            <span key={key}>
              <i style={{ background: colors[key as AttentionLevel] }} />
              {value}
            </span>
          ))}
          <small>Points, not hazard boundaries</small>
        </div>
        <div className="siMapControls">
          <button
            aria-label="Zoom monitoring map in"
            onClick={() => map.current?.zoomIn()}
          >
            <Plus size={16} />
          </button>
          <button
            aria-label="Zoom monitoring map out"
            onClick={() => map.current?.zoomOut()}
          >
            <Minus size={16} />
          </button>
          <button
            aria-label="Show Sindh monitoring locations"
            onClick={() =>
              map.current?.fitBounds(
                items.map(
                  (item) => [item.latitude, item.longitude] as [number, number],
                ),
                { padding: [35, 35], maxZoom: 7 },
              )
            }
          >
            <Crosshair size={16} />
          </button>
        </div>
      </div>
    </section>
  );
}
