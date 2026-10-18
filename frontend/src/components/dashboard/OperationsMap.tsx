"use client";
import { useEffect, useRef, useState, useMemo } from "react";
import type { Incident, RescueTeam } from "@/types/api";
import type { LayerGroup } from "leaflet";
import Image from "next/image";
import {
  Map as MapIcon,
  Maximize2,
  Minimize2,
  Plus,
  Minus,
  Crosshair,
} from "lucide-react";
import {
  getIncidentMarkerIcon,
  getRescueTeamMarkerIcon,
  LEGEND_ITEMS,
} from "./map-marker";
import { useDashboard } from "./dashboard-context";
import { useMapBase } from "@/components/maps/use-map-base";
import { MapFeedback } from "@/components/maps/MapFeedback";
import {
  mapPosition,
  validCoordinates,
  type MapPosition,
} from "@/components/maps/map-coordinates";
import { fitMapPositions } from "@/components/maps/map-bounds";
import { teamPopup } from "@/components/maps/map-popups";
interface Props {
  incidents: Incident[];
  teams: RescueTeam[];
  selectedIncident: Incident | null;
  onSelectIncident: (incident: Incident | null) => void;
  onSelectTeam: (team: RescueTeam | null) => void;
  loading?: boolean;
}
export function OperationsMap({
  incidents,
  teams,
  selectedIncident,
  onSelectIncident,
  onSelectTeam,
  loading = false,
}: Props) {
  const container = useRef<HTMLDivElement>(null),
    layers = useRef<LayerGroup | null>(null);
  const { map, ready, status, retry } = useMapBase(container);
  const callbacks = useRef({ onSelectIncident, onSelectTeam });
  const selection = useRef(selectedIncident?._id);
  const incidentMarkers = useRef(new Map<string, import("leaflet").Marker>());
  useEffect(() => {
    selection.current = selectedIncident?._id;
  }, [selectedIncident?._id]);
  useEffect(() => {
    callbacks.current = { onSelectIncident, onSelectTeam };
  }, [onSelectIncident, onSelectTeam]);
  const [expanded, setExpanded] = useState(false);
  const { isDemoMode } = useDashboard();
  const valid = useMemo(
    () => incidents.filter((i) => validCoordinates(i.location)),
    [incidents],
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
      incidentMarkers.current.clear();
      valid.forEach((incident) => {
        const point = incident.location!;
        const marker = L.marker([point.latitude, point.longitude], {
          icon: getIncidentMarkerIcon(
            L,
            incident.priorityLevel,
            selection.current === incident._id,
          ),
          title: `${incident.priorityLevel}: ${incident.emergencyType}`,
          alt: `${incident.priorityLevel} incident: ${incident.emergencyType}`,
          zIndexOffset:
            selection.current === incident._id
              ? 1000
              : incident.priorityLevel === "CRITICAL"
                ? 500
                : 200,
        });
        const text = document.createElement("div");
        text.textContent = `${incident.priorityLevel}: ${incident.emergencyType} · Click to preview`;
        marker.bindTooltip(text);
        marker.on("click", (e) => {
          L.DomEvent.stopPropagation(e);
          callbacks.current.onSelectIncident(incident);
        });
        marker.addTo(layers.current!);
        incidentMarkers.current.set(incident._id, marker);
      });
      teams
        .filter((team) => validCoordinates(team.location))
        .forEach((team) => {
          const marker = L.marker(
            [team.location.latitude, team.location.longitude],
            {
              icon: getRescueTeamMarkerIcon(L, team.status),
              title: `${team.name}: ${team.status}`,
              alt: `${team.name}: ${team.status} rescue team`,
              zIndexOffset: 100,
            },
          );
          const text = document.createElement("div");
          text.textContent = `${team.name}: ${team.status} / Stored team base location, not live GPS`;
          marker.bindTooltip(text);
          marker.bindPopup(teamPopup(team));
          marker.on("click", () => callbacks.current.onSelectTeam(team));
          marker.addTo(layers.current!);
        });
    });
    return () => {
      active = false;
    };
  }, [map, valid, teams, ready]);
  useEffect(() => {
    let active = true;
    void import("leaflet").then((L) => {
      if (!active || !ready) return;
      for (const incident of valid)
        incidentMarkers.current
          .get(incident._id)
          ?.setIcon(
            getIncidentMarkerIcon(
              L,
              incident.priorityLevel,
              selectedIncident?._id === incident._id,
            ),
          );
    });
    return () => {
      active = false;
    };
  }, [ready, valid, selectedIncident?._id]);
  const pointKey = JSON.stringify([
    ...valid.map((incident) => mapPosition(incident.location)!),
    ...teams
      .map((team) => mapPosition(team.location))
      .filter((point): point is MapPosition => !!point),
  ]);
  useEffect(() => {
    if (ready && map.current)
      fitMapPositions(map.current, JSON.parse(pointKey) as MapPosition[]);
  }, [map, ready, pointKey]);
  const selectedPoint = JSON.stringify(mapPosition(selectedIncident?.location));
  useEffect(() => {
    const point = JSON.parse(selectedPoint) as MapPosition | null;
    if (ready && point && map.current) {
      try {
        const bounds = map.current.getBounds();
        if (!bounds.contains(point)) {
          map.current.panTo(point, { animate: true });
        }
      } catch {
        map.current.setView(point, 12);
      }
    }
  }, [map, ready, selectedPoint]);
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
          <h2>
            <MapIcon size={18} aria-hidden="true" /> Operations Map
          </h2>
          <p>
            {isDemoMode
              ? "Simulated incident and team positions"
              : "Reported coordinates / not live GPS"}
          </p>
        </div>
        <span className="rqCommandMapMode">
          {isDemoMode ? "Demo Data" : "Reported positions"}
        </span>
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
          className="rqCommandLeaflet rqOperationalMap"
          aria-label="Incident and rescue team map"
        />
        {(!ready || loading) && (
          <p className="rqCommandMapStatus" role="status">
            Loading operations map...
          </p>
        )}
        <div className="rqCommandMapLegend">
          <strong>Map Legend</strong>
          {LEGEND_ITEMS.map((item) => (
            <span key={item.kind}>
              <Image
                src={item.asset}
                alt={item.label}
                className="rqLegendIconImg"
                width={20}
                height={20}
                unoptimized
              />
              {item.label}
            </span>
          ))}
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
            onClick={() => {
              if (map.current)
                fitMapPositions(
                  map.current,
                  JSON.parse(pointKey) as MapPosition[],
                );
            }}
          >
            <Crosshair size={18} />
          </button>
        </div>
        <MapFeedback status={status} retry={retry} />
      </div>
      {valid.length < incidents.length && (
        <p className="rqCommandMapFootnote" role="status">
          {valid.length < incidents.length
            ? `${incidents.length - valid.length} reports need location verification.`
            : ""}
        </p>
      )}
    </section>
  );
}
