"use client";
import { useEffect, useRef, useState } from "react";
import type { Map as LeafletMap } from "leaflet";
import Image from "next/image";
import { MapPin, Minus, Plus, ExternalLink } from "lucide-react";
import type { Incident, RescueTeam, IncidentLocation } from "@/types/api";
import { getIncidentMarkerIcon, getRescueTeamMarkerIcon, MARKER_ASSETS, type MarkerKind } from "../map-marker";

export function validLocation(location?: IncidentLocation | null): location is IncidentLocation {
  return !!location && Number.isFinite(location.latitude) && Number.isFinite(location.longitude) && Math.abs(location.latitude) <= 90 && Math.abs(location.longitude) <= 180;
}
export function IncidentLocationMap({ incident, teams }: { incident: Incident; teams: RescueTeam[] }) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<LeafletMap | null>(null);
  const [failed, setFailed] = useState(false);
  const location = validLocation(incident.location) ? incident.location : null;
  const latitude = location?.latitude, longitude = location?.longitude;
  const markers = teams.filter(team => validLocation(team.location));
  const positions = JSON.stringify(markers.map(team => ({ id: team._id, name: team.name, lat: team.location.latitude, lng: team.location.longitude, status: team.status })));
  useEffect(() => {
    if (latitude === undefined || longitude === undefined) return;
    let active = true;
    let observer: ResizeObserver | undefined;
    void import("leaflet").then(L => {
      if (!active || !container.current) return;
      const instance = L.map(container.current, { center: [latitude, longitude], zoom: 13, zoomControl: false, scrollWheelZoom: false });
      map.current = instance;
      L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}", {
        maxZoom: 16,
        attribution: 'Tiles &copy; <a href="https://www.esri.com">Esri</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).on("tileerror", () => { if (active) setFailed(true); }).addTo(instance);
      L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}", { maxZoom: 16 }).addTo(instance);
      const popup = document.createElement("div");
      popup.textContent = "Reported incident location. Focus halo is decorative; affected area is not mapped.";
      L.marker([latitude, longitude], { icon: getIncidentMarkerIcon(L, incident.priorityLevel || "CRITICAL"), title: "Reported incident location", alt: "Reported incident location" }).bindPopup(popup).addTo(instance);
      observer = new ResizeObserver(() => instance.invalidateSize({ pan: true, animate: false }));
      observer.observe(container.current);
    }).catch(() => { if (active) setFailed(true); });
    return () => { active = false; observer?.disconnect(); map.current?.remove(); map.current = null; };
  }, [latitude, longitude, incident.priorityLevel]);
  useEffect(() => {
    let active = true;
    let cleanup: (() => void) | undefined;
    void import("leaflet").then(L => {
      if (!active || !map.current) return;
      const group = L.layerGroup().addTo(map.current);
      for (const team of JSON.parse(positions) as { id: string; name: string; lat: number; lng: number; status: string }[]) {
        const text = document.createElement("span"); text.textContent = `${team.name} — ${team.status}. Reported position, not live GPS.`;
        L.marker([team.lat, team.lng], { icon: getRescueTeamMarkerIcon(L, team.status), title: team.name, alt: `Rescue team: ${team.name}` }).bindPopup(text).addTo(group);
      }
      cleanup = () => group.remove();
    });
    return () => { active = false; cleanup?.(); };
  }, [positions, latitude, longitude]);
  return <section className="rqDetailCard rqDetailLocation">
    <header><h2>Incident Location</h2>{location && <a href={`https://www.openstreetmap.org/?mlat=${location.latitude}&mlon=${location.longitude}#map=15/${location.latitude}/${location.longitude}`} target="_blank" rel="noreferrer">Open in Maps <ExternalLink size={12} /></a>}</header>
    {location ? <div className="rqDetailMapCanvas"><div ref={container} className="rqDetailMap" aria-label="Reported incident location map" /><div className="rqDetailMapZoom"><button aria-label="Zoom incident map in" onClick={() => map.current?.zoomIn()}><Plus size={17}/></button><button aria-label="Zoom incident map out" onClick={() => map.current?.zoomOut()}><Minus size={17}/></button></div><div className="rqDetailMapLegend"><span><Image src={MARKER_ASSETS[(incident.priorityLevel as MarkerKind) || "CRITICAL"] || MARKER_ASSETS.CRITICAL} alt="Reported location" className="rqLegendIconImg" width={18} height={18} unoptimized /> Reported location</span><small>Focus halo only · impact area unavailable</small>{markers.length > 0 && <span><Image src={MARKER_ASSETS.BUSY} alt="Rescue team" className="rqLegendIconImg" width={18} height={18} unoptimized /> Reported team position</span>}</div></div> : <div className="rqDetailMapMissing"><MapPin size={36}/><h3>Location verification required</h3><p>{incident.location?.address || "No location description supplied."}</p><small>No coordinates have been assumed.</small></div>}
    {failed && <p role="status" className="rqDetailFootnote">Map tiles could not load. Use Open in Maps to inspect the reported coordinates.</p>}
  </section>;
}
