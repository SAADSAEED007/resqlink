"use client";

import { useEffect, useRef } from "react";
import type { Incident } from "@/types/api";
import { useMapBase } from "@/components/maps/use-map-base";
import { validCoordinates } from "@/components/maps/map-coordinates";
import { getIncidentMarkerIcon } from "./map-marker";
import { Plus, Minus, Crosshair, ExternalLink, MapPinOff } from "lucide-react";
import "@/components/maps/maps.css";

interface IncidentMiniMapProps {
  incident: Incident;
}

export function IncidentMiniMap({ incident }: IncidentMiniMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const markerRef = useRef<import("leaflet").Marker | null>(null);
  const { map, ready } = useMapBase(containerRef, false);

  const coords = incident.location;
  const hasCoords = validCoordinates(coords);

  // Update map view and marker whenever map is ready or incident / coordinates change
  useEffect(() => {
    if (!ready || !map.current || !hasCoords) return;

    const lat = coords.latitude;
    const lng = coords.longitude;

    let active = true;

    void import("leaflet").then((L) => {
      if (!active || !map.current) return;

      // Position the camera directly on the incident coordinates
      map.current.setView([lat, lng], 14, { animate: false });

      // Remove previous marker if it exists
      if (markerRef.current) {
        markerRef.current.remove();
        markerRef.current = null;
      }

      // Add clean incident marker with appropriate priority icon
      const marker = L.marker([lat, lng], {
        icon: getIncidentMarkerIcon(L, incident.priorityLevel, false),
        title: `${incident.priorityLevel}: ${incident.emergencyType}`,
        zIndexOffset: 1000,
      });

      const popup = document.createElement("div");
      popup.className = "rqMiniMapPopup";
      popup.innerHTML = `
        <div style="font-size:12px;line-height:1.4;">
          <strong>${incident.emergencyType}</strong> · <span>${incident.priorityLevel}</span>
          <div style="font-size:10px;color:#64748b;margin-top:2px;">
            ${lat.toFixed(4)}, ${lng.toFixed(4)}
          </div>
        </div>
      `;
      marker.bindPopup(popup);
      marker.addTo(map.current);
      markerRef.current = marker;
    });

    return () => {
      active = false;
      if (markerRef.current) {
        markerRef.current.remove();
        markerRef.current = null;
      }
    };
  }, [ready, map, hasCoords, coords?.latitude, coords?.longitude, incident._id, incident.priorityLevel, incident.emergencyType]);

  // Settlement invalidateSize after drawer entrance animation completes
  useEffect(() => {
    if (!ready || !map.current || !hasCoords) return;

    const timer = setTimeout(() => {
      if (map.current) {
        map.current.invalidateSize({ pan: false });
        map.current.setView([coords.latitude, coords.longitude], 14, { animate: false });
      }
    }, 280);

    return () => clearTimeout(timer);
  }, [ready, map, hasCoords, coords?.latitude, coords?.longitude]);

  if (!hasCoords) {
    return null;
  }

  const lat = coords.latitude;
  const lng = coords.longitude;
  const externalOsmUrl = `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=16/${lat}/${lng}`;

  const handleRecenter = () => {
    if (map.current && hasCoords) {
      map.current.setView([lat, lng], 14, { animate: true });
    }
  };

  return (
    <div className="rqMiniMapWrapper">
      <div className="rqMiniMapContainer">
        <div
          ref={containerRef}
          className="rqOperationalMap rqIncidentMiniMapCanvas"
          aria-label={`Interactive map showing incident location at coordinates ${lat.toFixed(4)}, ${lng.toFixed(4)}`}
        />

        {/* Compact On-Map Controls */}
        <div className="rqMiniMapControls">
          <button
            type="button"
            onClick={() => map.current?.zoomIn()}
            title="Zoom in"
            aria-label="Zoom in mini map"
          >
            <Plus size={13} />
          </button>
          <button
            type="button"
            onClick={() => map.current?.zoomOut()}
            title="Zoom out"
            aria-label="Zoom out mini map"
          >
            <Minus size={13} />
          </button>
          <button
            type="button"
            onClick={handleRecenter}
            title="Recenter incident marker"
            aria-label="Recenter on incident marker"
          >
            <Crosshair size={13} />
          </button>
        </div>
      </div>

      {/* Coordinate & External Map Bar */}
      <div className="rqMiniMapMetaBar">
        <span className="rqMiniMapCoordText" title="Reported GPS Coordinates">
          {lat.toFixed(4)}, {lng.toFixed(4)}
        </span>
        <a
          href={externalOsmUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="rqMiniMapExpandLink"
          title="Open in OpenStreetMap (external)"
          aria-label="Expand map in OpenStreetMap (opens in new tab)"
        >
          <span>Expand Map</span>
          <ExternalLink size={12} aria-hidden="true" />
        </a>
      </div>
    </div>
  );
}

export function IncidentLocationEmptyState({ label, subtext }: { label: string; subtext: string }) {
  return (
    <div className="rqMiniMapEmptyState" role="status">
      <MapPinOff size={22} className="text-[var(--command-muted)]" aria-hidden="true" />
      <div>
        <p className="font-semibold text-xs text-[var(--command-ink)]">{label}</p>
        <p className="text-[11px] text-[var(--command-muted)] mt-0.5">{subtext}</p>
      </div>
    </div>
  );
}
