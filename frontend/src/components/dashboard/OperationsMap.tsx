"use client";
import { useEffect, useRef, useState, useMemo } from "react";
import type { Incident, RescueTeam } from "@/types/api";
import type { Map as LeafletMap, LayerGroup } from "leaflet";
import { Map as MapIcon, Maximize2, Minimize2, Plus, Minus, Crosshair } from "lucide-react";
import { markerMarkup, type MarkerKind } from "./map-marker";
import { useDashboard } from "./dashboard-context";
interface Props {
  incidents: Incident[];
  teams: RescueTeam[];
  selectedIncident: Incident | null;
  onSelectIncident: (incident: Incident | null) => void;
  onSelectTeam: (team: RescueTeam | null) => void;
  loading?: boolean;
}
const center: [number, number] = [24.8607, 67.0011];
const colors = {
  CRITICAL: "#e11d38",
  HIGH: "#d97706",
  MEDIUM: "#2563eb",
  LOW: "#64748b",
};
export function OperationsMap({
  incidents,
  teams,
  selectedIncident,
  onSelectIncident,
  onSelectTeam,
  loading = false,
}: Props) {
  const container = useRef<HTMLDivElement>(null),
    map = useRef<LeafletMap | null>(null),
    layers = useRef<LayerGroup | null>(null);
  const callbacks = useRef({ onSelectIncident, onSelectTeam });
  useEffect(() => {
    callbacks.current = { onSelectIncident, onSelectTeam };
  }, [onSelectIncident, onSelectTeam]);
  const [ready, setReady] = useState(false),
    [expanded, setExpanded] = useState(false),
    [tileError, setTileError] = useState(false);
  const { isDemoMode } = useDashboard();
  const valid = useMemo(
    () =>
      incidents.filter(
        (i) =>
          i.location &&
          Number.isFinite(i.location.latitude) &&
          Number.isFinite(i.location.longitude) &&
          Math.abs(i.location.latitude) <= 90 &&
          Math.abs(i.location.longitude) <= 180,
      ),
    [incidents],
  );
  useEffect(() => {
    let active = true;
    let observer: ResizeObserver | undefined;
    void import("leaflet").then((L) => {
      if (!active || !container.current) return;
      const instance = L.map(container.current, {
        center,
        zoom: 12,
        zoomControl: false,
      });
      map.current = instance;
      L.tileLayer(
        "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}",
        {
          maxZoom: 16,
          attribution:
            'Tiles &copy; <a href="https://www.esri.com">Esri</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        },
      )
        .on("tileerror", () => setTileError(true))
        .addTo(instance);
      L.tileLayer(
        "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}",
        { maxZoom: 16 },
      ).addTo(instance);
      layers.current = L.layerGroup().addTo(instance);
      observer = new ResizeObserver(() =>
        instance.invalidateSize({ pan: true, animate: false }),
      );
      observer.observe(container.current);
      setReady(true);
    });
    return () => {
      active = false;
      observer?.disconnect();
      map.current?.remove();
      map.current = null;
    };
  }, []);
  useEffect(() => {
    let active = true;
    void import("leaflet").then((L) => {
      if (!active || !ready || !layers.current) return;
      layers.current.clearLayers();
      valid.forEach((incident) => {
        const point = incident.location!;
        const marker = L.marker([point.latitude, point.longitude], {
          icon: L.divIcon({ className: "rqMapMarker", html: markerMarkup(incident.priorityLevel, selectedIncident?._id === incident._id), iconSize: [40, 40], iconAnchor: [20, 20] }),
          title: `${incident.priorityLevel}: ${incident.description}`,
          alt: `${incident.priorityLevel} incident: ${incident.description}`,
          zIndexOffset: selectedIncident?._id === incident._id ? 1000 : incident.priorityLevel === "CRITICAL" ? 500 : 200,
        });
        const text = document.createElement("div");
        text.textContent = `${incident.priorityLevel}: ${incident.description}`;
        marker.bindTooltip(text);
        marker.on("click", () => callbacks.current.onSelectIncident(incident));
        marker.addTo(layers.current!);
      });
      teams
        .filter(
          (team) =>
            team.status !== "OFFLINE" &&
            team.location &&
            Number.isFinite(team.location.latitude) &&
            Number.isFinite(team.location.longitude) &&
            Math.abs(team.location.latitude) <= 90 &&
            Math.abs(team.location.longitude) <= 180,
        )
        .forEach((team) => {
          const marker = L.marker(
            [team.location.latitude, team.location.longitude],
            {
              icon: L.divIcon({ className: "rqMapMarker", html: markerMarkup(team.status === "AVAILABLE" ? "AVAILABLE" : "BUSY"), iconSize: [40, 40], iconAnchor: [20, 20] }),
              title: `${team.name}: ${team.status}`,
              alt: `${team.name}: ${team.status} rescue team`,
              zIndexOffset: 100,
            },
          );
          const text = document.createElement("div");
          text.textContent = `${team.name}: ${team.status} / Reported position`;
          marker.bindTooltip(text);
          marker.on("click", () => callbacks.current.onSelectTeam(team));
          marker.addTo(layers.current!);
        });
    });
    return () => {
      active = false;
    };
  }, [valid, teams, ready, selectedIncident]);
  useEffect(() => {
    function escape(event: KeyboardEvent) {
      if (event.key === "Escape") setExpanded(false);
    }
    document.addEventListener("keydown", escape);
    return () => document.removeEventListener("keydown", escape);
  }, []);
  return (
    <section
      className={`rqCommandMap rqCommandCard ${expanded ? "is-expanded" : ""}`}
      aria-label="Operations map panel"
    >
      <header>
        <div>
          <h2><MapIcon size={18} aria-hidden="true" /> Operations Map</h2>
          <p>
            {isDemoMode
              ? "Simulated incident and team positions"
              : "Reported coordinates / not live GPS"}
          </p>
        </div>
        <span className="rqCommandMapMode">{isDemoMode ? "Demo Data" : "Reported positions"}</span>
        <button
          className="rqCommandIcon"
          title={expanded ? "Exit expanded map" : "Expand map"}
          aria-label={expanded ? "Exit expanded map" : "Expand map"}
          aria-pressed={expanded}
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? <Minimize2 size={17} /> : <Maximize2 size={17} />}
        </button>
      </header>
      <div className="rqCommandMapCanvas">
        <div
          ref={container}
          className="rqCommandLeaflet"
          aria-label="Incident and rescue team map"
        />
        {(!ready || loading) && (
          <p className="rqCommandMapStatus" role="status">
            Loading operations map...
          </p>
        )}
        <div className="rqCommandMapLegend">
          <strong>Map Legend</strong>
          {Object.keys(colors).map((level) => (
            <span key={level}>
              <i dangerouslySetInnerHTML={{ __html: markerMarkup(level as MarkerKind) }} />
              {level[0] + level.slice(1).toLowerCase()} Incident
            </span>
          ))}
          <span>
            <i dangerouslySetInnerHTML={{ __html: markerMarkup("AVAILABLE") }} />
            Available team
          </span>
          {teams.some(team => team.status === "BUSY") && <span><i dangerouslySetInnerHTML={{ __html: markerMarkup("BUSY") }} />Team on mission</span>}
        </div>
        <div className="rqCommandMapControls">
          <button
            title="Zoom in"
            aria-label="Zoom in"
            onClick={() => map.current?.zoomIn()}
          >
            <Plus size={18} />
          </button>
          <button
            title="Zoom out"
            aria-label="Zoom out"
            onClick={() => map.current?.zoomOut()}
          >
            <Minus size={18} />
          </button>
          <button
            title="Reset map view"
            aria-label="Reset map view"
            onClick={() => map.current?.setView(center, 12)}
          >
            <Crosshair size={18} />
          </button>
        </div>
      </div>
      {(tileError || valid.length < incidents.length) && (
        <p className="rqCommandMapFootnote" role="status">
          {tileError ? "Some map tiles could not load. " : ""}
          {valid.length < incidents.length
            ? `${incidents.length - valid.length} reports need location verification.`
            : ""}
        </p>
      )}
    </section>
  );
}
