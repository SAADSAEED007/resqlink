"use client";
import { useEffect, useRef } from "react";
import Image from "next/image";
import type { LayerGroup, Marker, Map as LeafletMap } from "leaflet";
import { Crosshair, MapPin, Minus, Plus } from "lucide-react";
import type { RescueTeam } from "@/types/api";
import { getRescueTeamMarkerIcon, MARKER_ASSETS } from "@/components/dashboard/map-marker";
import { capabilityLabels, statusText, validCoordinates } from "./team-utils";

export function RescueTeamMap({ teams, selected, onSelect }: { teams: RescueTeam[]; selected: RescueTeam | null; onSelect: (id: string) => void }) {
  const element = useRef<HTMLDivElement>(null), map = useRef<LeafletMap | null>(null), layers = useRef<LayerGroup | null>(null);
  const markers = useRef(new Map<string, Marker>());
  const select = useRef(onSelect); useEffect(() => { select.current = onSelect; }, [onSelect]);
  const records = useRef(teams); useEffect(() => { records.current = teams; }, [teams]);
  const selection = useRef(selected); useEffect(() => { selection.current = selected; }, [selected]);
  const signature = JSON.stringify(teams.map(team => [team._id, team.name, team.status, team.location, team.capabilities]));
  useEffect(() => {
    let active = true; let observer: ResizeObserver | undefined;
    void import("leaflet").then(L => {
      if (!active || !element.current) return;
      const first = records.current.find(team => validCoordinates(team.location));
      const instance = L.map(element.current, { center: first ? [first.location.latitude, first.location.longitude] : [24.8607, 67.0011], zoom: 11, zoomControl: false, scrollWheelZoom: false });
      map.current = instance; layers.current = L.layerGroup().addTo(instance);
      L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}", { maxZoom: 16, attribution: 'Tiles &copy; <a href="https://www.esri.com">Esri</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' }).addTo(instance);
      L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}", { maxZoom: 16 }).addTo(instance);
      observer = new ResizeObserver(() => instance.invalidateSize({ pan: true, animate: false })); observer.observe(element.current);
      draw();
    });
    async function draw() {
      const L = await import("leaflet"); if (!active || !layers.current) return;
      layers.current.clearLayers(); markers.current.clear();
      for (const team of records.current.filter(item => validCoordinates(item.location))) {
        const icon = team.status === "OFFLINE" ? L.divIcon({ className: "rtOfflineMarker", html: '<span aria-hidden="true"><svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="white" stroke-width="2"><path d="M5 5l14 14M19 5 5 19"/></svg></span>', iconSize: [32,32], iconAnchor: [16,16] }) : getRescueTeamMarkerIcon(L, team.status, team._id === selection.current?._id);
        const content = document.createElement("div"); content.textContent = `${team.name} · ${capabilityLabels(team)} · ${statusText[team.status]}. Stored base location, not live GPS.`;
        const marker = L.marker([team.location.latitude, team.location.longitude], { icon, title: `Select team ${team.name}`, alt: `Select team ${team.name}` }).bindPopup(content).on("click", () => select.current(team._id)).addTo(layers.current);
        markers.current.set(team._id, marker);
      }
    }
    return () => { active = false; observer?.disconnect(); map.current?.remove(); map.current = null; layers.current = null; };
  }, []);
  useEffect(() => {
    let active = true;
    void import("leaflet").then(L => {
      if (!active || !layers.current) return;
      layers.current.clearLayers(); markers.current.clear();
      for (const team of records.current.filter(item => validCoordinates(item.location))) {
        const icon = team.status === "OFFLINE" ? L.divIcon({ className: "rtOfflineMarker", html: '<span aria-hidden="true">×</span>', iconSize: [32,32], iconAnchor: [16,16] }) : getRescueTeamMarkerIcon(L, team.status, team._id === selection.current?._id);
        const content = document.createElement("div"); content.textContent = `${team.name} · ${capabilityLabels(team)} · ${statusText[team.status]}. Stored base location, not live GPS.`;
        const marker = L.marker([team.location.latitude, team.location.longitude], { icon, title: `Select team ${team.name}`, alt: `Select team ${team.name}` }).bindPopup(content).on("click", () => select.current(team._id)).addTo(layers.current);
        markers.current.set(team._id, marker);
      }
    });
    return () => { active = false; };
  }, [signature]);
  useEffect(() => {
    let active = true;
    void import("leaflet").then(L => {
      if (!active) return;
      for (const team of records.current) if (team.status !== "OFFLINE") markers.current.get(team._id)?.setIcon(getRescueTeamMarkerIcon(L, team.status, team._id === selected?._id));
    });
    return () => { active = false; };
  }, [selected?._id]);
  const selectedLatitude = validCoordinates(selected?.location) ? selected.location.latitude : undefined;
  const selectedLongitude = validCoordinates(selected?.location) ? selected.location.longitude : undefined;
  useEffect(() => { if (selectedLatitude !== undefined && selectedLongitude !== undefined) map.current?.panTo([selectedLatitude, selectedLongitude], { animate: false }); }, [selected?._id, selectedLatitude, selectedLongitude]);
  return <section className="rtCard rtMapCard"><header><h2>Team Location &amp; Operational Coverage</h2><span>{teams.filter(team => validCoordinates(team.location)).length} mapped</span></header><div className="rtMapCanvas"><div ref={element} className="rtMap" aria-label="Stored rescue team base locations"/><div className="rtMapLegend"><span><Image src={MARKER_ASSETS.AVAILABLE} alt="" width={20} height={20} unoptimized/>Available</span><span><Image src={MARKER_ASSETS.BUSY} alt="" width={20} height={20} unoptimized/>On Mission</span><span><i className="rtOfflineDot"/>Offline</span><small>Stored bases · not live GPS<br/>No service boundaries inferred</small></div><div className="rtMapControls"><button aria-label="Zoom team map in" onClick={() => map.current?.zoomIn()}><Plus size={17}/></button><button aria-label="Zoom team map out" onClick={() => map.current?.zoomOut()}><Minus size={17}/></button><button aria-label="Focus selected team" disabled={!validCoordinates(selected?.location)} onClick={() => { if (selected && validCoordinates(selected.location)) map.current?.panTo([selected.location.latitude,selected.location.longitude]); }}><Crosshair size={17}/></button></div>{!teams.some(team => validCoordinates(team.location)) && <p className="rtMapEmpty"><MapPin size={17}/>No valid base coordinates on this directory page.</p>}</div></section>;
}
