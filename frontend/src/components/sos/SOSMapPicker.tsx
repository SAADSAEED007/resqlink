"use client";
import { useEffect, useRef, useState } from "react";
import type { IncidentLocation } from "@/types/api";
import { Button } from "@/components/ui";
import { useMapBase } from "@/components/maps/use-map-base";
import { MapFeedback } from "@/components/maps/MapFeedback";
import { validCoordinates } from "@/components/maps/map-coordinates";

export default function SOSMapPicker({
  value,
  onSelect,
}: {
  value: IncidentLocation | null;
  onSelect: (point: IncidentLocation) => void;
}) {
  const container = useRef<HTMLDivElement>(null);
  const { map, ready, status, retry } = useMapBase(container, true, "light");
  const markerRef = useRef<import("leaflet").Marker | null>(null);
  const valueKey = JSON.stringify(value);
  const source = useRef(valueKey);
  useEffect(() => {
    source.current = valueKey;
  }, [valueKey]);
  const [draft, setDraft] = useState<{
    point: IncidentLocation;
    source: string;
  } | null>(null);
  const candidate =
    draft?.source === valueKey
      ? draft.point
      : validCoordinates(value)
        ? value
        : null;
  const candidateKey = JSON.stringify(candidate);
  useEffect(() => {
    if (!ready) return;
    let active = true;
    let cleanup: (() => void) | undefined;
    void import("leaflet").then((L) => {
      if (!active || !map.current) return;
      const instance = map.current;
      const point = JSON.parse(source.current) as IncidentLocation | null;
      if (validCoordinates(point))
        instance.setView([point.latitude, point.longitude], 14);
      const marker = L.marker([0, 0], {
        draggable: true,
        title: "Candidate emergency location",
        icon: L.divIcon({
          className: "rqSosMapMarker",
          html: '<span aria-hidden="true"></span>',
          iconSize: [28, 28],
          iconAnchor: [14, 14],
        }),
      });
      markerRef.current = marker;
      const choose = (point: import("leaflet").LatLng) => {
        const wrapped = point.wrap();
        const location = {
          latitude: Number(wrapped.lat.toFixed(6)),
          longitude: Number(wrapped.lng.toFixed(6)),
        };
        if (validCoordinates(location))
          setDraft({ point: location, source: source.current });
      };
      const click = (event: import("leaflet").LeafletMouseEvent) =>
        choose(event.latlng);
      instance.on("click", click);
      marker.on("dragend", () => choose(marker.getLatLng()));
      cleanup = () => {
        instance.off("click", click);
        marker.off();
        marker.remove();
        markerRef.current = null;
      };
    });
    return () => {
      active = false;
      cleanup?.();
    };
  }, [map, ready]);
  useEffect(() => {
    if (!ready) return;
    let active = true;
    void import("leaflet").then(() => {
      if (!active || !map.current || !markerRef.current) return;
      const point = JSON.parse(candidateKey) as IncidentLocation | null;
      if (validCoordinates(point)) {
        markerRef.current.setLatLng([point.latitude, point.longitude]);
        if (!map.current.hasLayer(markerRef.current))
          markerRef.current.addTo(map.current);
      } else markerRef.current.remove();
    });
    return () => {
      active = false;
    };
  }, [candidateKey, map, ready]);
  return (
    <div className="rqSosMapPicker">
      <p className="helper">
        {candidate
          ? `Candidate point: ${candidate.latitude.toFixed(6)}, ${candidate.longitude.toFixed(6)}. Confirm it before using it in your report.`
          : "Sindh overview shown. This is not your reported location. Tap a point to choose a candidate."}
      </p>
      <div style={{ position: "relative" }}>
        <div
          ref={container}
          className="rqSosMap rqOperationalMap"
          role="group"
          aria-label="Emergency location map"
        />
        <MapFeedback status={status} retry={retry} />
      </div>
      <Button
        variant="outline"
        disabled={!ready || !candidate}
        onClick={() => {
          if (candidate && validCoordinates(candidate)) onSelect(candidate);
        }}
      >
        Confirm selected location
      </Button>
      <Button
        variant="outline"
        disabled={!ready}
        onClick={() => {
          const point = map.current?.getCenter().wrap();
          if (point) {
            const location = {
              latitude: Number(point.lat.toFixed(6)),
              longitude: Number(point.lng.toFixed(6)),
            };
            if (validCoordinates(location)) {
              setDraft({ point: location, source: valueKey });
              onSelect(location);
            }
          }
        }}
      >
        Use map center
      </Button>
      <p className="helper">
        Pan with arrow keys after focusing the map, then choose Use map center
        to confirm that point. You can also enter a landmark without using the
        map.
      </p>
    </div>
  );
}
