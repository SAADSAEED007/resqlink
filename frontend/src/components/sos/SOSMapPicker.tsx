"use client";
import { useEffect, useRef, useState } from "react";
import type { IncidentLocation } from "@/types/api";
import { Button, LoadingSpinner } from "@/components/ui";
export default function SOSMapPicker({
  value,
  onSelect,
}: {
  value: IncidentLocation | null;
  onSelect: (point: IncidentLocation) => void;
}) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<import("leaflet").Map | null>(null);
  const markerRef = useRef<import("leaflet").Marker | null>(null);
  const onSelectRef = useRef(onSelect);
  const initialValue = useRef(value);
  const [status, setStatus] = useState("loading");
  const [tileError, setTileError] = useState(false);
  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);
  useEffect(() => {
    let cancelled = false;
    async function init() {
      const L = await import("leaflet");
      if (cancelled || !container.current) return;
      const point = initialValue.current;
      const map = L.map(container.current, {
        center: point ? [point.latitude, point.longitude] : [24.8607, 67.0011],
        zoom: point ? 14 : 10,
        zoomControl: true,
        attributionControl: true,
      });
      mapRef.current = map;
      const tiles = L.tileLayer(
        "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
        {
          maxZoom: 19,
          attribution:
            '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        },
      ).addTo(map);
      tiles.on("tileerror", () => {
        if (!cancelled) setTileError(true);
      });
      const marker = L.marker(
        point ? [point.latitude, point.longitude] : [24.8607, 67.0011],
        {
          draggable: true,
          title: "Selected emergency location",
          icon: L.divIcon({
            className: "rqSosMapMarker",
            html: '<span aria-hidden="true"></span>',
            iconSize: [28, 28],
            iconAnchor: [14, 14],
          }),
        },
      );
      markerRef.current = marker;
      if (point) marker.addTo(map);
      map.on("click", (event: import("leaflet").LeafletMouseEvent) => {
        onSelectRef.current({
          latitude: Number(event.latlng.lat.toFixed(6)),
          longitude: Number(event.latlng.wrap().lng.toFixed(6)),
        });
      });
      marker.on("dragend", () => {
        const point = marker.getLatLng().wrap();
        onSelectRef.current({
          latitude: Number(point.lat.toFixed(6)),
          longitude: Number(point.lng.toFixed(6)),
        });
      });
      setStatus("ready");
      map.invalidateSize();
    }
    void init().catch(() => {
      if (!cancelled) setStatus("error");
    });
    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
  }, []);
  useEffect(() => {
    const map = mapRef.current;
    const marker = markerRef.current;
    if (!map || !marker) return;
    if (value) {
      marker.setLatLng([value.latitude, value.longitude]);
      if (!map.hasLayer(marker)) marker.addTo(map);
      map.panTo([value.latitude, value.longitude]);
    } else marker.remove();
  }, [value, status]);
  return (
    <div className="rqSosMapPicker">
      <p className="helper">
        {value
          ? "Selected point shown. Tap elsewhere or drag the marker to adjust."
          : "Starting view: Karachi. This is not your reported location. Tap a point to select it."}
      </p>
      <div
        ref={container}
        className="rqSosMap"
        role="group"
        aria-label="Emergency location map"
      />
      {status === "loading" && <LoadingSpinner label="Loading map..." />}
      {status === "error" && (
        <p role="alert" className="validation">
          The map could not be opened. Enter an address or coordinates below.
        </p>
      )}
      {tileError && (
        <p role="status" className="helper">
          Map tiles could not be loaded. You can still enter an address or
          coordinates.
        </p>
      )}
      <Button
        variant="outline"
        disabled={status !== "ready"}
        onClick={() => {
          const point = mapRef.current?.getCenter().wrap();
          if (point)
            onSelect({
              latitude: Number(point.lat.toFixed(6)),
              longitude: Number(point.lng.toFixed(6)),
            });
        }}
      >
        Use map center
      </Button>
      <p className="helper">
        You can pan with arrow keys after focusing the map, then choose Use map
        center. Manual entry is available below.
      </p>
    </div>
  );
}
