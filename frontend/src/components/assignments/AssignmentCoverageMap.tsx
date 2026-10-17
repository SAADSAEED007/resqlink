"use client";
import { useEffect, useRef, useState } from "react";
import type { Map as LeafletMap, LayerGroup } from "leaflet";
import { MapPin, Crosshair } from "lucide-react";
import {
  getIncidentMarkerIcon,
  getRescueTeamMarkerIcon,
} from "@/components/dashboard/map-marker";
import { useDashboardTheme } from "@/components/layout/dashboard-theme";
import type { Incident, RescueTeam } from "@/types/api";
import { coordinates, incidentNames } from "./assignment-data";

export function AssignmentCoverageMap({
  incident,
  teams,
  selectedTeam,
  selectTeam,
}: {
  incident?: Incident;
  teams: RescueTeam[];
  selectedTeam: string;
  selectTeam: (id: string) => void;
}) {
  const node = useRef<HTMLDivElement>(null),
    map = useRef<LeafletMap | null>(null),
    layer = useRef<LayerGroup | null>(null);
  const [ready, setReady] = useState(false);
  const { theme } = useDashboardTheme();
  const callback = useRef(selectTeam);
  useEffect(() => {
    callback.current = selectTeam;
  }, [selectTeam]);
  useEffect(() => {
    let active = true;
    let observer: ResizeObserver | undefined;
    void import("leaflet").then((L) => {
      if (!active || !node.current) return;
      const instance = L.map(node.current, {
        zoomControl: true,
        scrollWheelZoom: false,
      }).setView([0, 0], 2);
      map.current = instance;
      layer.current = L.layerGroup().addTo(instance);
      observer = new ResizeObserver(() => instance.invalidateSize());
      observer.observe(node.current);
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
    if (!ready) return;
    let active = true;
    let tiles: import("leaflet").TileLayer | undefined;
    let labels: import("leaflet").TileLayer | undefined;
    void import("leaflet").then((L) => {
      if (!active || !map.current) return;
      const style = theme === "dark" ? "Dark" : "Light";
      const base = `https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_${style}_Gray`;
      tiles = L.tileLayer(`${base}_Base/MapServer/tile/{z}/{y}/{x}`, {
        attribution: "Tiles &copy; Esri &copy; OpenStreetMap contributors",
        maxZoom: 16,
      }).addTo(map.current);
      labels = L.tileLayer(`${base}_Reference/MapServer/tile/{z}/{y}/{x}`, {
        maxZoom: 16,
      }).addTo(map.current);
    });
    return () => {
      active = false;
      tiles?.remove();
      labels?.remove();
    };
  }, [ready, theme]);
  const serialized = JSON.stringify({ incident, teams, selectedTeam });
  useEffect(() => {
    if (!ready) return;
    let active = true;
    const data = JSON.parse(serialized) as {
      incident?: Incident;
      teams: RescueTeam[];
      selectedTeam: string;
    };
    void import("leaflet").then((L) => {
      if (!active || !layer.current) return;
      layer.current.clearLayers();
      if (coordinates(data.incident?.location)) {
        const content = document.createElement("div");
        content.textContent = `${incidentNames[data.incident!.emergencyType]} · ${data.incident!.priorityLevel} · ${data.incident!.location?.address || "Stored incident location"}`;
        L.marker(
          [
            data.incident!.location!.latitude,
            data.incident!.location!.longitude,
          ],
          {
            icon: getIncidentMarkerIcon(L, data.incident!.priorityLevel, true),
            title: "Selected incident location",
          },
        )
          .bindPopup(content)
          .addTo(layer.current);
      }
      for (const team of data.teams.filter(
        (team) => team.status !== "OFFLINE" && coordinates(team.location),
      )) {
        const content = document.createElement("div");
        content.textContent = `${team.name} · ${team.status} · Stored base location, not live GPS`;
        L.marker([team.location.latitude, team.location.longitude], {
          icon: getRescueTeamMarkerIcon(
            L,
            team.status,
            team._id === data.selectedTeam,
          ),
          title: team.name,
        })
          .bindPopup(content)
          .on("click", () => {
            if (team.status === "AVAILABLE") callback.current(team._id);
          })
          .addTo(layer.current);
      }
    });
    return () => {
      active = false;
    };
  }, [serialized, ready]);
  const focusTeam = teams.find((team) => team._id === selectedTeam);
  const center = coordinates(focusTeam?.location)
    ? focusTeam.location
    : incident?.location;
  const lat = center?.latitude,
    lng = center?.longitude;
  useEffect(() => {
    if (
      ready &&
      lat !== undefined &&
      lng !== undefined &&
      coordinates({ latitude: lat, longitude: lng })
    )
      map.current?.setView([lat, lng], 12, { animate: false });
  }, [lat, lng, ready]);
  return (
    <section className="awCard awMapCard">
      <header>
        <h2>
          <MapPin size={18} />
          Incident Location &amp; Team Coverage
        </h2>
        <button
          aria-label="Focus selected map location"
          disabled={!coordinates(center)}
          onClick={() => {
            if (coordinates(center))
              map.current?.setView([center.latitude, center.longitude], 12);
          }}
        >
          <Crosshair size={18} />
        </button>
      </header>
      <div className="awMapWrap">
        <div
          ref={node}
          className="awMap"
          aria-label="Selected incident and eligible rescue team base locations"
        />
        {!coordinates(incident?.location) && (
          <p className="awMapNotice">
            {incident
              ? "Incident location requires review; no incident marker plotted."
              : "Select an incident to see stored locations."}
          </p>
        )}
        <div className="awMapLegend">
          <span>
            <i className="red" />
            Selected incident
          </span>
          <span>
            <i className="green" />
            Available team
          </span>
          <span>
            <i className="blue" />
            Busy team
          </span>
        </div>
      </div>
      <p className="awMapCaption">
        Stored locations · eligible teams for this incident · no live tracking
        or travel-time estimate
      </p>
    </section>
  );
}
