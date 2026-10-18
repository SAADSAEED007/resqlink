"use client";
import { useEffect, useRef } from "react";
import Image from "next/image";
import { Crosshair, MapPin, Minus, Plus } from "lucide-react";
import type { RescueTeam } from "@/types/api";
import {
  getRescueTeamMarkerIcon,
  MARKER_ASSETS,
} from "@/components/dashboard/map-marker";
import { useMapBase } from "@/components/maps/use-map-base";
import { MapFeedback } from "@/components/maps/MapFeedback";
import {
  mapPosition,
  type MapPosition,
} from "@/components/maps/map-coordinates";
import { fitMapPositions, positionsKey } from "@/components/maps/map-bounds";
import { teamPopup } from "@/components/maps/map-popups";
import { validCoordinates } from "./team-utils";
import { bindMarkerActivation } from "@/components/maps/map-markers";

export function RescueTeamMap({
  teams,
  selected,
  onSelect,
}: {
  teams: RescueTeam[];
  selected: RescueTeam | null;
  onSelect: (id: string) => void;
}) {
  const element = useRef<HTMLDivElement>(null);
  const { map, ready, status, retry } = useMapBase(element);
  const select = useRef(onSelect);
  useEffect(() => {
    select.current = onSelect;
  }, [onSelect]);
  const mapped = teams.filter((team) => validCoordinates(team.location));
  const signature = JSON.stringify(mapped);
  const points = mapped.map((team) => mapPosition(team.location)!);
  const pointKey = positionsKey(points);
  const view = useRef<{ points: string; selected?: string } | null>(null);
  const markers = useRef(new Map<string, import("leaflet").Marker>());
  const popupSelection = useRef<string | null>(null);
  useEffect(() => {
    if (!ready) {
      markers.current.clear();
      return;
    }
    let active = true;
    void import("leaflet").then((L) => {
      if (!active || !map.current) return;
      const records = JSON.parse(signature) as RescueTeam[];
      const ids = new Set(records.map((team) => team._id));
      for (const [id, marker] of markers.current)
        if (!ids.has(id)) {
          marker.remove();
          markers.current.delete(id);
        }
      for (const team of records) {
        let marker = markers.current.get(team._id);
        if (!marker) {
          marker = L.marker(mapPosition(team.location)!, {
            icon: getRescueTeamMarkerIcon(
              L,
              team.status,
              team._id === selected?._id,
            ),
            title: `Select team ${team.name}`,
            alt: `Select team ${team.name}`,
          })
            .bindPopup(teamPopup(team), { autoPan: false })
            .addTo(map.current);
          bindMarkerActivation(marker, () => select.current(team._id));
          markers.current.set(team._id, marker);
        } else
          marker
            .setLatLng(mapPosition(team.location)!)
            .setPopupContent(teamPopup(team));
        marker
          .setIcon(
            getRescueTeamMarkerIcon(L, team.status, team._id === selected?._id),
          )
          .setZIndexOffset(team._id === selected?._id ? 1000 : 0);
        if (
          team._id === selected?._id &&
          popupSelection.current &&
          popupSelection.current !== selected._id
        )
          marker.openPopup();
      }
      popupSelection.current = selected?._id || null;
    });
    return () => {
      active = false;
    };
  }, [map, ready, signature, selected?._id]);
  const selectedKey = JSON.stringify(mapPosition(selected?.location));
  useEffect(() => {
    if (!ready || !map.current) return;
    const previous = view.current;
    const point = JSON.parse(selectedKey) as MapPosition | null;
    if (!previous || previous.points !== pointKey)
      fitMapPositions(map.current, JSON.parse(pointKey) as MapPosition[]);
    else if (previous.selected !== selected?._id && point)
      map.current.setView(point, 12, { animate: true });
    view.current = { points: pointKey, selected: selected?._id };
  }, [map, ready, pointKey, selected?._id, selectedKey]);
  return (
    <section className="rtCard rtMapCard">
      <header>
        <h2>Team Location &amp; Operational Coverage</h2>
        <span>{mapped.length} mapped</span>
      </header>
      <div className="rtMapCanvas">
        <div
          ref={element}
          className="rtMap rqOperationalMap"
          aria-label="Stored rescue team base locations"
        />
        <div className="rtMapLegend">
          <span>
            <Image
              src={MARKER_ASSETS.AVAILABLE}
              alt=""
              width={20}
              height={20}
              unoptimized
            />
            Available
          </span>
          <span>
            <Image
              src={MARKER_ASSETS.BUSY}
              alt=""
              width={20}
              height={20}
              unoptimized
            />
            On Mission
          </span>
          <span>
            <i className="rtOfflineDot" />
            Offline
          </span>
          <small>
            Stored team base locations · not live GPS
            <br />
            No service boundaries inferred
          </small>
        </div>
        <div className="rtMapControls">
          <button
            aria-label="Zoom team map in"
            onClick={() => map.current?.zoomIn()}
          >
            <Plus size={17} />
          </button>
          <button
            aria-label="Zoom team map out"
            onClick={() => map.current?.zoomOut()}
          >
            <Minus size={17} />
          </button>
          <button
            aria-label="Fit team base locations"
            onClick={() => {
              if (map.current) fitMapPositions(map.current, points);
            }}
          >
            <Crosshair size={17} />
          </button>
        </div>
        <MapFeedback status={status} retry={retry} />
        {!mapped.length && (
          <p className="rtMapEmpty">
            <MapPin size={17} />
            No verified map positions available for these records. Sindh
            overview shown.
          </p>
        )}
        {selected &&
          !validCoordinates(selected.location) &&
          mapped.length > 0 && (
            <p className="rtMapEmpty">
              Selected team location requires verification. Other stored bases
              are shown.
            </p>
          )}
      </div>
    </section>
  );
}
