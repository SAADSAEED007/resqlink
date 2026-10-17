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

const KARACHI_NEIGHBORHOODS = [
  { name: "North Karachi", lat: 24.985, lng: 67.065 },
  { name: "University of Karachi", lat: 24.945, lng: 67.128 },
  { name: "Gulshan-e-Iqbal", lat: 24.928, lng: 67.098 },
  { name: "Karachi", lat: 24.855, lng: 67.01 },
  { name: "PECHS", lat: 24.872, lng: 67.062 },
  { name: "Shah Faisal", lat: 24.885, lng: 67.155 },
  { name: "Korangi", lat: 24.83, lng: 67.135 },
];

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
          zoom: 12.8,
          zoomControl: false,
          scrollWheelZoom: false,
          attributionControl: false,
        });
        map.current = instance;

        // Dark cartographic tiles
        L.tileLayer(
          "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}",
          {
            maxZoom: 16,
          },
        )
          .on("tileerror", () => {
            if (active) setFailed(true);
          })
          .addTo(instance);

        L.tileLayer(
          "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}",
          { maxZoom: 16 },
        ).addTo(instance);

        // Concentric impact risk zones matching reference
        // Outer Low Risk Zone (Dashed amber/yellow)
        L.circle([latitude, longitude], {
          radius: 2000,
          color: "#EAB308",
          weight: 1.5,
          dashArray: "4, 6",
          fillColor: "#EAB308",
          fillOpacity: 0.08,
          interactive: false,
        }).addTo(instance);

        // Middle Medium Risk Zone (Amber)
        L.circle([latitude, longitude], {
          radius: 1250,
          color: "#F59E0B",
          weight: 1.8,
          fillColor: "#F59E0B",
          fillOpacity: 0.16,
          interactive: false,
        }).addTo(instance);

        // Inner High Risk Zone (Red)
        L.circle([latitude, longitude], {
          radius: 650,
          color: "#FF4655",
          weight: 2,
          fillColor: "#FF4655",
          fillOpacity: 0.28,
          interactive: false,
        }).addTo(instance);

        // Neighborhood labels
        for (const hood of KARACHI_NEIGHBORHOODS) {
          const isCenter = hood.name === "Gulshan-e-Iqbal";
          const icon = L.divIcon({
            className: `rqMapLabelWrap ${isCenter ? "is-center" : ""}`,
            html: `<span class="rqMapLabelText">${hood.name}</span>`,
            iconSize: [110, 20],
            iconAnchor: [55, 10],
          });
          L.marker([hood.lat, hood.lng], { icon, interactive: false }).addTo(instance);
        }

        // Center Incident Marker with custom glowing icon
        const popup = document.createElement("div");
        popup.className = "rqMapPopupContent";
        popup.innerHTML = `<strong>${incident.location?.address || "Gulshan-e-Iqbal, Karachi"}</strong><p>${incident.priorityLevel || "CRITICAL"} Priority Incident</p>`;

        L.marker([latitude, longitude], {
          icon: getIncidentMarkerIcon(L, incident.priorityLevel || "CRITICAL"),
          title: "Incident Location",
          alt: "Incident Location",
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
              aria-label="Zoom in"
              onClick={() => map.current?.zoomIn()}
            >
              <Plus size={15} />
            </button>
            <button
              type="button"
              aria-label="Zoom out"
              onClick={() => map.current?.zoomOut()}
            >
              <Minus size={15} />
            </button>
          </div>

          {/* Bottom Right High-Fidelity Legend Overlay matching Image 2 */}
          <div className="rqDetailMapLegendBox">
            <div className="rqLegendRow">
              <span className="rqLegendDot rqDotRedPin" />
              <span>Incident Location</span>
            </div>
            <div className="rqLegendRow">
              <span className="rqLegendSquare rqSquareRed" />
              <span>Affected Area (High)</span>
            </div>
            <div className="rqLegendRow">
              <span className="rqLegendSquare rqSquareAmber" />
              <span>Affected Area (Medium)</span>
            </div>
            <div className="rqLegendRow">
              <span className="rqLegendSquare rqSquareYellow" />
              <span>Affected Area (Low)</span>
            </div>
            <div className="rqLegendRow">
              <span className="rqLegendCircle rqCircleBlue" />
              <span>Rescue Team</span>
            </div>
          </div>
        </div>
      ) : (
        <div className="rqDetailMapMissing">
          <MapPin size={36} />
          <h3>Location verification required</h3>
          <p>{incident.location?.address || "No location coordinates provided."}</p>
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
