"use client";
import { useEffect, useRef, useState } from "react";
import type {
  Map as LeafletMap,
  LayerGroup,
  CircleMarker,
  TileLayer,
} from "leaflet";
import { Plus, Minus, Crosshair, MapPin } from "lucide-react";
import { useDashboardTheme } from "@/components/layout/dashboard-theme";
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
    map = useRef<LeafletMap | null>(null),
    layers = useRef<LayerGroup | null>(null),
    tiles = useRef<TileLayer | null>(null),
    references = useRef<TileLayer | null>(null),
    markers = useRef(new Map<string, CircleMarker>());
  const select = useRef(onSelect);
  useEffect(() => {
    select.current = onSelect;
  }, [onSelect]);
  const { theme } = useDashboardTheme();
  const [ready, setReady] = useState(false);
  const fitted = useRef(false),
    focused = useRef(selectedId);
  const signature = JSON.stringify(
    items.map((item) => [
      item.id,
      item.name,
      item.latitude,
      item.longitude,
      item.attention?.level,
      item.weather?.next24Hours.precipitationMm,
      item.weather?.retrievedAt,
    ]),
  );
  useEffect(() => {
    let active = true;
    let observer: ResizeObserver | undefined;
    void import("leaflet").then((L) => {
      if (!active || !element.current) return;
      const instance = L.map(element.current, {
        center: [26.45, 68.3],
        zoom: 7,
        zoomControl: false,
        scrollWheelZoom: false,
      });
      map.current = instance;
      layers.current = L.layerGroup().addTo(instance);
      observer = new ResizeObserver(() =>
        instance.invalidateSize({ pan: false }),
      );
      observer.observe(element.current);
      setReady(true);
    });
    return () => {
      active = false;
      observer?.disconnect();
      map.current?.remove();
      map.current = null;
      layers.current = null;
    };
  }, []);
  useEffect(() => {
    let active = true;
    void import("leaflet").then((L) => {
      if (!active || !ready || !map.current) return;
      const previous = tiles.current;
      const url =
        theme === "dark"
          ? "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}"
          : "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
      tiles.current = L.tileLayer(url, {
        maxZoom: 18,
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' +
          (theme === "dark" ? " &copy; Esri" : ""),
      }).addTo(map.current);
      tiles.current.once("load", () => previous?.remove());
      references.current?.remove();
      if (theme === "dark")
        references.current = L.tileLayer(
          "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}",
          { maxZoom: 18, zIndex: 2 },
        ).addTo(map.current);
    });
    return () => {
      active = false;
    };
  }, [ready, theme]);
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
      ][];
      for (const [
        id,
        name,
        latitude,
        longitude,
        status,
        rain,
        retrievedAt,
      ] of records) {
        const level = status || "DATA_UNAVAILABLE";
        const content = document.createElement("div");
        content.textContent = `${name} · ${attentionLabels[level]} · ${rain === undefined ? "Forecast unavailable" : `${rain} mm / next 24h`} · ${retrievedAt ? new Date(retrievedAt).toLocaleString() : "Not retrieved"}. Representative town point.`;
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
  }, [ready, signature]);
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
  }, [ready, lat, lon, selectedId]);
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
          className="siMap"
          aria-label="Sindh district monitoring locations"
        />
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
