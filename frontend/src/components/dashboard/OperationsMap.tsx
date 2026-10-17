"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import type { Incident, RescueTeam } from "@/types/api";
import { MOCK_HOSPITALS } from "./mock-data";
import {
  MapPin,
  Maximize2,
  Minimize2,
  Plus,
  Minus,
  Crosshair,
  AlertTriangle,
} from "lucide-react";
import "leaflet/dist/leaflet.css";

interface OperationsMapProps {
  incidents: Incident[];
  teams: RescueTeam[];
  selectedIncident: Incident | null;
  onSelectIncident: (inc: Incident | null) => void;
  onSelectTeam: (team: RescueTeam | null) => void;
  loading?: boolean;
}

type MapMode = "map" | "satellite" | "heatmap";

const KARACHI_CENTER: [number, number] = [24.8607, 67.0011];
const DEFAULT_ZOOM = 12;

export function OperationsMap({
  incidents,
  teams,
  selectedIncident,
  onSelectIncident,
  onSelectTeam,
  loading = false,
}: OperationsMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const heatLayerRef = useRef<L.LayerGroup | null>(null);

  const [mode, setMode] = useState<MapMode>("map");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isMapReady, setIsMapReady] = useState(false);

  // Filter valid coordinates
  const validIncidents = useMemo(
    () =>
      incidents.filter(
        (i) =>
          i.location &&
          typeof i.location.latitude === "number" &&
          typeof i.location.longitude === "number" &&
          !isNaN(i.location.latitude) &&
          !isNaN(i.location.longitude),
      ),
    [incidents],
  );

  const validTeams = useMemo(
    () =>
      teams.filter(
        (t) =>
          t.location &&
          typeof t.location.latitude === "number" &&
          typeof t.location.longitude === "number",
      ),
    [teams],
  );

  const unverifiedCount = incidents.length - validIncidents.length;

  // Initialize Map
  useEffect(() => {
    let isCancelled = false;

    async function initMap() {
      if (!mapContainerRef.current) return;
      if (mapInstanceRef.current) return;

      const L = await import("leaflet");

      if (isCancelled || !mapContainerRef.current) return;

      // Create Leaflet Map
      const map = L.map(mapContainerRef.current, {
        center: KARACHI_CENTER,
        zoom: DEFAULT_ZOOM,
        zoomControl: false,
        attributionControl: false,
        minZoom: 10,
        maxZoom: 18,
      });

      // ArcGIS World Dark Gray Base default tile layer (clean dark canvas, no watermark)
      const baseTiles = L.tileLayer(
        "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}",
        {
          attribution:
            '&copy; <a href="https://www.esri.com">Esri</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
          maxZoom: 16,
        },
      ).addTo(map);

      // Label reference overlay for Karachi streets & districts
      L.tileLayer(
        "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}",
        {
          attribution: "",
          maxZoom: 16,
          opacity: 0.85,
        },
      ).addTo(map);

      tileLayerRef.current = baseTiles;

      const markersGroup = L.layerGroup().addTo(map);
      markersLayerRef.current = markersGroup;

      const heatGroup = L.layerGroup();
      heatLayerRef.current = heatGroup;

      mapInstanceRef.current = map;
      setIsMapReady(true);
    }

    initMap();

    return () => {
      isCancelled = true;
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Update Tile Mode
  useEffect(() => {
    async function updateTiles() {
      const map = mapInstanceRef.current;
      if (!map) return;
      const L = await import("leaflet");

      if (tileLayerRef.current) {
        map.removeLayer(tileLayerRef.current);
      }

      let newTileUrl = "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}";
      let attr = '&copy; <a href="https://www.esri.com">Esri</a> &copy; OpenStreetMap';

      if (mode === "satellite") {
        newTileUrl = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";
        attr = "Tiles &copy; Esri &mdash; Source: Esri, USGS";
      }

      const layer = L.tileLayer(newTileUrl, {
        attribution: attr,
        maxZoom: 18,
      }).addTo(map);

      tileLayerRef.current = layer;

      // Handle heatmap layer
      if (heatLayerRef.current) {
        if (mode === "heatmap") {
          heatLayerRef.current.clearLayers();
          validIncidents.forEach((inc) => {
            if (!inc.location) return;
            const radius = inc.priorityLevel === "CRITICAL" ? 2200 : 1400;
            const color = inc.priorityLevel === "CRITICAL" ? "#F04452" : "#F5B942";
            const circle = L.circle([inc.location.latitude, inc.location.longitude], {
              radius,
              fillColor: color,
              fillOpacity: 0.35,
              stroke: false,
            });
            circle.addTo(heatLayerRef.current!);
          });
          map.addLayer(heatLayerRef.current);
        } else if (map.hasLayer(heatLayerRef.current)) {
          map.removeLayer(heatLayerRef.current);
        }
      }
    }

    if (isMapReady) {
      updateTiles();
    }
  }, [mode, isMapReady, validIncidents]);

  // Render Markers
  useEffect(() => {
    async function renderMarkers() {
      const map = mapInstanceRef.current;
      const markersGroup = markersLayerRef.current;
      if (!map || !markersGroup) return;

      const L = await import("leaflet");
      markersGroup.clearLayers();

      // 1. Hospital Markers
      MOCK_HOSPITALS.forEach((hosp) => {
        const hospitalIcon = L.divIcon({
          className: "custom-map-icon",
          html: `
            <div style="
              width: 26px;
              height: 26px;
              background: #0B1D33;
              border: 1.5px solid #EAF3FF;
              border-radius: 6px;
              display: flex;
              align-items: center;
              justify-content: center;
              color: #F04452;
              font-weight: 800;
              font-size: 16px;
              box-shadow: 0 0 10px rgba(0,0,0,0.6);
            ">
              +
            </div>
          `,
          iconSize: [26, 26],
          iconAnchor: [13, 13],
        });

        const marker = L.marker([hosp.latitude, hosp.longitude], { icon: hospitalIcon });
        marker.bindPopup(`
          <div style="background:#0B1D33; color:#EAF3FF; padding:10px; border-radius:8px; font-family:sans-serif; min-width:180px;">
            <div style="font-weight:600; font-size:13px; color:#EAF3FF; margin-bottom:4px;">🏥 ${hosp.name}</div>
            <div style="font-size:11px; color:#91A8C2;">Emergency Trauma Facility</div>
            <div style="margin-top:6px; font-size:11px; color:#18C785; font-weight:500;">
              ● ${hosp.bedsAvailable} Beds Available
            </div>
          </div>
        `);
        marker.addTo(markersGroup);
      });

      // 2. Rescue Team Markers
      validTeams.forEach((team) => {
        const isBusy = team.status === "BUSY";
        const bgColor = isBusy ? "#2378F6" : "#18C785";
        const teamIcon = L.divIcon({
          className: "custom-map-icon",
          html: `
            <div style="
              width: 32px;
              height: 32px;
              background: ${bgColor};
              border: 2px solid #EAF3FF;
              border-radius: 50%;
              display: flex;
              align-items: center;
              justify-content: center;
              color: white;
              box-shadow: 0 0 14px ${bgColor}88;
              cursor: pointer;
              transition: transform 0.2s;
            ">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/>
                <circle cx="7" cy="17" r="2"/>
                <path d="M9 17h6"/>
                <circle cx="17" cy="17" r="2"/>
              </svg>
            </div>
          `,
          iconSize: [32, 32],
          iconAnchor: [16, 16],
        });

        const marker = L.marker([team.location.latitude, team.location.longitude], {
          icon: teamIcon,
        });

        marker.on("click", () => {
          onSelectTeam(team);
        });

        marker.bindPopup(`
          <div style="background:#0B1D33; color:#EAF3FF; padding:12px; border-radius:10px; font-family:sans-serif; min-width:210px; border:1px solid #203650;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
              <span style="font-weight:700; font-size:14px; color:#EAF3FF;">${team.name}</span>
              <span style="font-size:10px; font-weight:700; padding:2px 8px; border-radius:12px; background:${isBusy ? "rgba(35,120,246,0.2)" : "rgba(24,199,133,0.2)"}; color:${isBusy ? "#2378F6" : "#18C785"};">
                ${team.status}
              </span>
            </div>
            <div style="font-size:11px; color:#91A8C2; margin-bottom:4px;">
              Capabilities: ${team.capabilities.join(", ")}
            </div>
            <div style="font-size:11px; color:#91A8C2;">
              Location: ${team.location.address || "Karachi Base"}
            </div>
            <div style="margin-top:6px; font-size:11px; color:#EAF3FF;">
              Crew capacity: <strong>${team.capacity}</strong>
            </div>
          </div>
        `);
        marker.addTo(markersGroup);
      });

      // 3. Incident Markers
      validIncidents.forEach((inc) => {
        if (!inc.location) return;

        const isCritical = inc.priorityLevel === "CRITICAL";
        const isHigh = inc.priorityLevel === "HIGH";
        const isMedium = inc.priorityLevel === "MEDIUM";

        const color = isCritical
          ? "#F04452"
          : isHigh
            ? "#F5B942"
            : isMedium
              ? "#EAB308"
              : "#2378F6";

        const size = isCritical ? 36 : isHigh ? 30 : 26;

        const pulseRing = isCritical
          ? `<div style="
              position: absolute;
              width: 100%;
              height: 100%;
              border-radius: 50%;
              background: ${color};
              opacity: 0.6;
              animation: ping 1.8s cubic-bezier(0, 0, 0.2, 1) infinite;
            "></div>`
          : "";

        const incidentIcon = L.divIcon({
          className: "custom-map-icon",
          html: `
            <div style="position:relative; width:${size}px; height:${size}px; display:flex; align-items:center; justify-content:center; cursor:pointer;">
              ${pulseRing}
              <div style="
                position: relative;
                width: ${size}px;
                height: ${size}px;
                background: ${color};
                border: 2px solid #EAF3FF;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                color: white;
                font-weight: 800;
                font-size: ${size > 30 ? "15px" : "12px"};
                box-shadow: 0 0 16px ${color}bb;
              ">
                !
              </div>
            </div>
          `,
          iconSize: [size, size],
          iconAnchor: [size / 2, size / 2],
        });

        const marker = L.marker([inc.location.latitude, inc.location.longitude], {
          icon: incidentIcon,
        });

        marker.on("click", () => {
          onSelectIncident(inc);
        });

        // Popup matching the reference design card: image thumbnail + title + badge
        const thumbnailSrc =
          inc.emergencyType === "FLOOD"
            ? "/images/incidents/urban-flooding.jpg"
            : inc.emergencyType === "STRANDED"
              ? "/images/incidents/building-collapse.jpg"
              : "/images/incidents/fallen-tree.jpg";

        marker.bindPopup(`
          <div style="background:#0B1D33; color:#EAF3FF; border-radius:10px; overflow:hidden; font-family:sans-serif; width:220px; border:1px solid #203650;">
            <div style="height:90px; width:100%; position:relative; overflow:hidden; background:#07182B;">
              <img src="${thumbnailSrc}" alt="${inc.emergencyType}" style="width:100%; height:100%; object-fit:cover;" />
              <span style="position:absolute; top:6px; right:6px; font-size:10px; font-weight:700; padding:2px 7px; border-radius:4px; background:${color}; color:#fff;">
                ${inc.priorityLevel}
              </span>
            </div>
            <div style="padding:10px;">
              <div style="font-weight:700; font-size:13px; color:#EAF3FF; line-height:1.2; margin-bottom:4px;">
                ${inc.emergencyType}: ${inc.description.slice(0, 42)}...
              </div>
              <div style="font-size:11px; color:#91A8C2; margin-bottom:8px;">
                📍 ${inc.location.address || "Karachi"}
              </div>
              <div style="display:flex; justify-content:space-between; align-items:center; font-size:10px; color:#91A8C2; border-top:1px solid #162B42; padding-top:6px;">
                <span>Affected: <strong>${inc.peopleAffected}</strong></span>
                <span style="color:#18C785;">${inc.confidenceLevel} Confidence</span>
              </div>
            </div>
          </div>
        `);

        marker.addTo(markersGroup);
      });
    }

    if (isMapReady) {
      renderMarkers();
    }
  }, [isMapReady, validIncidents, validTeams, onSelectIncident, onSelectTeam]);

  // Center on selected incident if triggered
  useEffect(() => {
    if (selectedIncident?.location && mapInstanceRef.current) {
      mapInstanceRef.current.flyTo(
        [selectedIncident.location.latitude, selectedIncident.location.longitude],
        14,
        { duration: 1.2 },
      );
    }
  }, [selectedIncident]);

  const handleZoomIn = () => {
    mapInstanceRef.current?.zoomIn();
  };

  const handleZoomOut = () => {
    mapInstanceRef.current?.zoomOut();
  };

  const handleResetView = () => {
    mapInstanceRef.current?.flyTo(KARACHI_CENTER, DEFAULT_ZOOM, { duration: 1 });
  };

  return (
    <div
      className={`bg-[#0B1D33] border border-[#203650] rounded-xl flex flex-col overflow-hidden relative ${
        isFullscreen ? "fixed inset-4 z-50 shadow-2xl" : "h-[440px] lg:h-[480px]"
      }`}
    >
      {/* Map Header Bar */}
      <div className="p-3.5 px-4 bg-[#07182B]/90 backdrop-blur-md border-b border-[#203650] flex items-center justify-between gap-3 shrink-0 z-10">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-[#2378F6]/15 border border-[#2378F6]/30 flex items-center justify-center shrink-0 text-[#2378F6]">
            <MapPin className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-[#EAF3FF] tracking-tight truncate">
                Operations Map
              </h2>
              <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#F04452]/20 text-[#F04452] border border-[#F04452]/40">
                <span className="w-1.5 h-1.5 rounded-full bg-[#F04452] animate-pulse" />
                Live
              </span>
            </div>
            <p className="text-[11px] text-[#91A8C2] truncate hidden sm:block">
              Live incident locations and rescue team positions &ndash; Karachi
            </p>
          </div>
        </div>

        {/* View Controls & Fullscreen */}
        <div className="flex items-center gap-2">
          {/* Mode Switchers */}
          <div className="flex items-center bg-[#061425] p-0.5 rounded-lg border border-[#203650] text-xs">
            <button
              onClick={() => setMode("map")}
              className={`px-2.5 py-1 rounded-md font-medium transition-all ${
                mode === "map"
                  ? "bg-[#2378F6] text-white shadow-sm"
                  : "text-[#91A8C2] hover:text-[#EAF3FF]"
              }`}
            >
              Map
            </button>
            <button
              onClick={() => setMode("satellite")}
              className={`px-2.5 py-1 rounded-md font-medium transition-all ${
                mode === "satellite"
                  ? "bg-[#2378F6] text-white shadow-sm"
                  : "text-[#91A8C2] hover:text-[#EAF3FF]"
              }`}
            >
              Satellite
            </button>
            <button
              onClick={() => setMode("heatmap")}
              className={`px-2.5 py-1 rounded-md font-medium transition-all ${
                mode === "heatmap"
                  ? "bg-[#2378F6] text-white shadow-sm"
                  : "text-[#91A8C2] hover:text-[#EAF3FF]"
              }`}
            >
              Heatmap
            </button>
          </div>

          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="w-8 h-8 rounded-lg bg-[#061425] hover:bg-[#122A45] border border-[#203650] flex items-center justify-center text-[#91A8C2] hover:text-[#EAF3FF] transition-colors"
            title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
          >
            {isFullscreen ? (
              <Minimize2 className="w-4 h-4" />
            ) : (
              <Maximize2 className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>

      {/* Map Canvas Container */}
      <div className="flex-1 relative w-full h-full bg-[#061425]">
        <div ref={mapContainerRef} className="w-full h-full" />

        {/* Loading overlay */}
        {loading && (
          <div className="absolute inset-0 bg-[#061425]/80 backdrop-blur-sm flex items-center justify-center z-20">
            <div className="flex flex-col items-center gap-2">
              <div className="w-7 h-7 border-2 border-[#2378F6] border-t-transparent rounded-full animate-spin" />
              <span className="text-xs text-[#91A8C2]">Loading Karachi Operations Map...</span>
            </div>
          </div>
        )}

        {/* Top-Left Map Legend Overlay */}
        <div className="absolute top-3 left-3 z-10 bg-[#07182B]/90 backdrop-blur-md border border-[#203650] rounded-lg p-2.5 text-[11px] space-y-1.5 shadow-lg max-w-[160px]">
          <div className="text-[10px] font-bold text-[#91A8C2] uppercase tracking-wider mb-1">
            Map Legend
          </div>
          <div className="flex items-center gap-2 text-[#EAF3FF]">
            <span className="w-2.5 h-2.5 rounded-full bg-[#F04452] shadow-[0_0_6px_#F04452]" />
            <span>Critical Incident</span>
          </div>
          <div className="flex items-center gap-2 text-[#EAF3FF]">
            <span className="w-2.5 h-2.5 rounded-full bg-[#F5B942]" />
            <span>High Priority</span>
          </div>
          <div className="flex items-center gap-2 text-[#EAF3FF]">
            <span className="w-2.5 h-2.5 rounded-full bg-[#EAB308]" />
            <span>Medium Priority</span>
          </div>
          <div className="flex items-center gap-2 text-[#EAF3FF]">
            <span className="w-2.5 h-2.5 rounded-full bg-[#2378F6]" />
            <span>Low Priority</span>
          </div>
          <div className="flex items-center gap-2 text-[#EAF3FF]">
            <span className="w-2.5 h-2.5 rounded-full bg-[#18C785] shadow-[0_0_6px_#18C785]" />
            <span>Rescue Team</span>
          </div>
          <div className="flex items-center gap-2 text-[#EAF3FF]">
            <span className="w-2.5 h-2.5 rounded-sm bg-[#0B1D33] border border-[#EAF3FF] text-[8px] flex items-center justify-center text-[#F04452] font-bold">
              +
            </span>
            <span>Hospital</span>
          </div>
        </div>

        {/* Bottom-Left Scale & Sea Indicator */}
        <div className="absolute bottom-3 left-3 z-10 flex flex-col gap-1 pointer-events-none">
          <div className="text-[11px] font-medium italic text-[#627D98] tracking-wider">
            Arabian Sea
          </div>
          <div className="bg-[#07182B]/85 backdrop-blur-sm border border-[#203650] rounded px-2 py-0.5 text-[9px] text-[#91A8C2] flex items-center gap-2">
            <span>0</span>
            <span className="w-8 h-0.5 bg-[#91A8C2]" />
            <span>5</span>
            <span className="w-8 h-0.5 bg-[#91A8C2]" />
            <span>10 km</span>
          </div>
        </div>

        {/* Bottom-Right Custom Zoom Controls */}
        <div className="absolute bottom-3 right-3 z-10 flex flex-col gap-1.5">
          <button
            onClick={handleZoomIn}
            className="w-8 h-8 rounded-lg bg-[#07182B]/90 hover:bg-[#122A45] border border-[#203650] flex items-center justify-center text-[#EAF3FF] shadow-md transition-colors"
            title="Zoom In"
          >
            <Plus className="w-4 h-4" />
          </button>
          <button
            onClick={handleZoomOut}
            className="w-8 h-8 rounded-lg bg-[#07182B]/90 hover:bg-[#122A45] border border-[#203650] flex items-center justify-center text-[#EAF3FF] shadow-md transition-colors"
            title="Zoom Out"
          >
            <Minus className="w-4 h-4" />
          </button>
          <button
            onClick={handleResetView}
            className="w-8 h-8 rounded-lg bg-[#07182B]/90 hover:bg-[#122A45] border border-[#203650] flex items-center justify-center text-[#2378F6] shadow-md transition-colors"
            title="Reset View to Karachi"
          >
            <Crosshair className="w-4 h-4" />
          </button>
        </div>

        {/* Unverified Coordinates Alert */}
        {unverifiedCount > 0 && (
          <div className="absolute top-3 right-3 z-10 bg-[#F5B942]/15 border border-[#F5B942]/30 rounded-lg px-2.5 py-1 text-[11px] text-[#F5B942] backdrop-blur-md flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>{unverifiedCount} report location unverified</span>
          </div>
        )}
      </div>
    </div>
  );
}
