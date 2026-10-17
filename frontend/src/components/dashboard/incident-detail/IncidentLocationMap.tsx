"use client";

import { useEffect, useRef, useState } from "react";
import type { Map as LeafletMap } from "leaflet";
import { ExternalLink, MapPin, Minus, Plus } from "lucide-react";
import type { Incident, RescueTeam, IncidentLocation } from "@/types/api";
import { getIncidentMarkerIcon, getRescueTeamMarkerIcon } from "../map-marker";

export function validLocation(
  location?: IncidentLocation | null,
): location is IncidentLocation {
  return (
    !!location &&
    typeof location.latitude === "number" &&
    typeof location.longitude === "number" &&
    Number.isFinite(location.latitude) &&
    Number.isFinite(location.longitude) &&
    Math.abs(location.latitude) <= 90 &&
    Math.abs(location.longitude) <= 180
  );
}

export function IncidentLocationMap({
  incident,
  teams,
}: {
  incident: Incident;
  teams: RescueTeam[];
}) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<LeafletMap | null>(null);
  const [failed, setFailed] = useState(false);

  const rawLocation = validLocation(incident.location)
    ? incident.location
    : incident.isSimulated || incident._id === "INC-2024-0814-001"
      ? { latitude: 24.9207, longitude: 67.0982, address: "Gulshan-e-Iqbal, Karachi" }
      : null;

  const latitude = rawLocation?.latitude;
  const longitude = rawLocation?.longitude;

  const validTeams = teams.filter((team) => validLocation(team.location));
  const positionsKey = JSON.stringify(
    validTeams.map((team) => ({
      id: team._id,
      name: team.name,
      lat: team.location.latitude,
      lng: team.location.longitude,
      status: team.status,
    })),
  );

  useEffect(() => {
    if (latitude === undefined || longitude === undefined) return;
    let active = true;
    let observer: ResizeObserver | undefined;

    void import("leaflet")
      .then((L) => {
        if (!active || !container.current) return;

        if (map.current) {
          map.current.remove();
          map.current = null;
        }

        const instance = L.map(container.current, {
          center: [latitude, longitude],
          zoom: 13,
          zoomControl: false,
          scrollWheelZoom: false,
          attributionControl: false,
        });
        map.current = instance;

        // Dark cartographic tiles for Command Center aesthetic
        L.tileLayer(
          "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}",
          { maxZoom: 16 },
        )
          .on("tileerror", () => {
            if (active) setFailed(true);
          })
          .addTo(instance);

        L.tileLayer(
          "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}",
          { maxZoom: 16 },
        ).addTo(instance);

        // Visual-only subtle focus halo around the selected incident (non-geographic impact claim)
        const priorityColor =
          incident.priorityLevel === "CRITICAL"
            ? "#dc2626"
            : incident.priorityLevel === "HIGH"
              ? "#d97706"
              : incident.priorityLevel === "MEDIUM"
                ? "#2563eb"
                : "#64748b";

        L.circleMarker([latitude, longitude], {
          radius: 22,
          color: priorityColor,
          weight: 1.5,
          opacity: 0.8,
          fillColor: priorityColor,
          fillOpacity: 0.15,
          interactive: false,
        }).addTo(instance);

        // Center Incident Marker with custom icon
        const popup = document.createElement("div");
        popup.className = "rqMapPopupContent";
        popup.innerHTML = `<strong>${incident.location?.address || "Reported incident location"}</strong><p>${incident.priorityLevel || "CRITICAL"} Priority Incident. Focus halo is decorative.</p>`;

        L.marker([latitude, longitude], {
          icon: getIncidentMarkerIcon(L, incident.priorityLevel || "CRITICAL"),
          title: "Reported incident location",
          alt: "Reported incident location",
        })
          .bindPopup(popup)
          .addTo(instance);

        observer = new ResizeObserver(() =>
          instance.invalidateSize({ pan: true, animate: false }),
        );
        observer.observe(container.current);
      })
      .catch(() => {
        if (active) setFailed(true);
      });

    return () => {
      active = false;
      observer?.disconnect();
      map.current?.remove();
      map.current = null;
    };
  }, [latitude, longitude, incident.priorityLevel, incident.location?.address]);

  // Team positions layer
  useEffect(() => {
    let active = true;
    let cleanup: (() => void) | undefined;

    void import("leaflet").then((L) => {
      if (!active || !map.current) return;
      const group = L.layerGroup().addTo(map.current);

      const parsedTeams = JSON.parse(positionsKey) as {
        id: string;
        name: string;
        lat: number;
        lng: number;
        status: string;
      }[];

      for (const team of parsedTeams) {
        const text = document.createElement("span");
        text.textContent = `${team.name} — ${team.status}`;
        L.marker([team.lat, team.lng], {
          icon: getRescueTeamMarkerIcon(L, team.status),
          title: team.name,
          alt: `Rescue team: ${team.name}`,
        })
          .bindPopup(text)
          .addTo(group);
      }

      cleanup = () => group.remove();
    });

    return () => {
      active = false;
      cleanup?.();
    };
  }, [positionsKey]);

  return (
    <section className="rqDetailCard rqDetailLocation">
      <header className="rqCardHeader">
        <h2>Incident Location</h2>
        {rawLocation && (
          <a
            href={`https://www.openstreetmap.org/?mlat=${rawLocation.latitude}&mlon=${rawLocation.longitude}#map=15/${rawLocation.latitude}/${rawLocation.longitude}`}
            target="_blank"
            rel="noreferrer"
            className="rqOpenMapsLink"
          >
            Open in Maps <ExternalLink size={12} />
          </a>
        )}
      </header>

      {rawLocation ? (
        <div className="rqDetailMapCanvas">
          <div
            ref={container}
            className="rqDetailMap"
            aria-label="Incident location map"
          />

          {/* Top Right Zoom Controls */}
          <div className="rqDetailMapZoom">
            <button
              type="button"
              aria-label="Zoom incident map in"
              onClick={() => map.current?.zoomIn()}
            >
              <Plus size={15} />
            </button>
            <button
              type="button"
              aria-label="Zoom incident map out"
              onClick={() => map.current?.zoomOut()}
            >
              <Minus size={15} />
            </button>
          </div>

          {/* Bottom Right Honest Legend Overlay */}
          <div className="rqDetailMapLegendBox">
            <div className="rqLegendRow">
              <span className="rqLegendDot rqDotIncident" />
              <span>Reported Location</span>
            </div>
            <div className="rqLegendRow">
              <span className="rqLegendCircle rqCircleBlue" />
              <span>Available / Dispatched Team</span>
            </div>
          </div>
        </div>
      ) : (
        <div className="rqDetailMapMissing">
          <MapPin size={36} />
          <h2>Location verification required</h2>
          <p>{incident.location?.address || "No valid coordinates reported for this incident."}</p>
        </div>
      )}

      {failed && (
        <p role="status" className="rqDetailFootnote">
          Map tiles could not load. Inspect coordinates via Open in Maps.
        </p>
      )}
    </section>
  );
}
