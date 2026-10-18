"use client";

import { useEffect, useRef, useState } from "react";
import type { Marker as LeafletMarker } from "leaflet";
import { Check, Crosshair, MapPin, Navigation, X } from "lucide-react";
import { useMapBase } from "@/components/maps/use-map-base";
import { MapFeedback } from "@/components/maps/MapFeedback";
import {
  validCoordinates,
  KARACHI_CENTER,
  KARACHI_ZOOM,
} from "@/components/maps/map-coordinates";

export interface SelectedLocation {
  latitude: number;
  longitude: number;
  address?: string;
}

export interface LocationMapPickerProps {
  value?: SelectedLocation | null;
  onConfirm: (location: SelectedLocation) => void;
  onCancel?: () => void;
  initialCenter?: [number, number];
  initialZoom?: number;
  title?: string;
  confirmLabel?: string;
  helperText?: string;
}

const createSelectionPinIcon = (L: typeof import("leaflet")) => {
  return L.divIcon({
    className: "rtPickerMarkerIcon",
    html: `
      <div class="rtPickerPinWrapper" aria-hidden="true">
        <svg width="34" height="42" viewBox="0 0 34 42" fill="none" xmlns="http://www.w3.org/2000/svg" class="rtPickerPinSvg">
          <defs>
            <filter id="rtPinShadow" x="0" y="0" width="34" height="42" filterUnits="userSpaceOnUse">
              <feDropShadow dx="0" dy="2" stdDeviation="2.5" flood-color="#0f172a" flood-opacity="0.38"/>
            </filter>
          </defs>
          <g filter="url(#rtPinShadow)">
            <path d="M17 2C9.268 2 3 8.268 3 16C3 26.5 17 38 17 38C17 38 31 26.5 31 16C31 8.268 24.732 2 17 2Z" fill="#2563eb" stroke="#ffffff" stroke-width="2.5"/>
            <circle cx="17" cy="16" r="4.5" fill="#ffffff"/>
          </g>
        </svg>
      </div>
    `,
    iconSize: [34, 42],
    iconAnchor: [17, 38],
  });
};

export function LocationMapPicker({
  value,
  onConfirm,
  onCancel,
  initialCenter = KARACHI_CENTER,
  initialZoom = KARACHI_ZOOM,
  title = "Select Location on Map",
  confirmLabel = "Confirm Base Location",
  helperText = "Click anywhere on the map or drag the pin to place the team's base location.",
}: LocationMapPickerProps) {
  const container = useRef<HTMLDivElement>(null);
  const { map, ready, status, retry } = useMapBase(container, true);
  const markerRef = useRef<LeafletMarker | null>(null);

  const initialValKey = JSON.stringify(value);
  const [candidate, setCandidate] = useState<SelectedLocation | null>(() => {
    return validCoordinates(value)
      ? {
          latitude: Number(value.latitude.toFixed(6)),
          longitude: Number(value.longitude.toFixed(6)),
          address: value.address,
        }
      : null;
  });

  // Track candidate across renders
  const candidateKey = JSON.stringify(candidate);

  useEffect(() => {
    if (!ready || !map.current) return;
    let active = true;
    let cleanup: (() => void) | undefined;

    void import("leaflet").then((L) => {
      if (!active || !map.current) return;
      const instance = map.current;

      const initialPoint = JSON.parse(initialValKey) as SelectedLocation | null;
      if (validCoordinates(initialPoint)) {
        instance.setView(
          [initialPoint.latitude, initialPoint.longitude],
          Math.max(13, instance.getZoom()),
          { animate: false }
        );
      } else {
        instance.setView(initialCenter, initialZoom, { animate: false });
      }

      const marker = L.marker([0, 0], {
        draggable: true,
        title: "Selected team base location",
        icon: createSelectionPinIcon(L),
        zIndexOffset: 1500,
      });
      markerRef.current = marker;

      const setPoint = (latlng: import("leaflet").LatLng) => {
        const wrapped = latlng.wrap();
        const nextLoc: SelectedLocation = {
          latitude: Number(wrapped.lat.toFixed(6)),
          longitude: Number(wrapped.lng.toFixed(6)),
        };
        if (validCoordinates(nextLoc)) {
          setCandidate(nextLoc);
        }
      };

      const handleMapClick = (event: import("leaflet").LeafletMouseEvent) => {
        setPoint(event.latlng);
      };

      const handleMarkerDrag = () => {
        setPoint(marker.getLatLng());
      };

      instance.on("click", handleMapClick);
      marker.on("dragend", handleMarkerDrag);

      cleanup = () => {
        instance.off("click", handleMapClick);
        marker.off("dragend", handleMarkerDrag);
        marker.remove();
        markerRef.current = null;
      };
    });

    return () => {
      active = false;
      cleanup?.();
    };
  }, [map, ready, initialValKey, initialCenter, initialZoom]);

  // Sync marker position when candidate changes
  useEffect(() => {
    if (!ready || !map.current) return;
    let active = true;

    void import("leaflet").then(() => {
      if (!active || !map.current || !markerRef.current) return;
      const point = JSON.parse(candidateKey) as SelectedLocation | null;
      if (validCoordinates(point)) {
        markerRef.current.setLatLng([point.latitude, point.longitude]);
        if (!map.current.hasLayer(markerRef.current)) {
          markerRef.current.addTo(map.current);
        }
      } else {
        markerRef.current.remove();
      }
    });

    return () => {
      active = false;
    };
  }, [candidateKey, map, ready]);

  const handleUseCenter = () => {
    if (!map.current) return;
    const center = map.current.getCenter().wrap();
    const nextLoc: SelectedLocation = {
      latitude: Number(center.lat.toFixed(6)),
      longitude: Number(center.lng.toFixed(6)),
    };
    if (validCoordinates(nextLoc)) {
      setCandidate(nextLoc);
    }
  };

  const handleConfirm = () => {
    if (candidate && validCoordinates(candidate)) {
      onConfirm(candidate);
    }
  };

  return (
    <div className="rtMapPicker">
      <div className="rtMapPickerHeader">
        <div className="rtMapPickerTitleWrap">
          <MapPin size={16} className="rtMapPickerTitleIcon" />
          <h4 className="rtMapPickerTitle">{title}</h4>
        </div>
        {onCancel && (
          <button
            type="button"
            className="rtMapPickerCloseButton"
            aria-label="Close location picker"
            onClick={onCancel}
          >
            <X size={16} />
          </button>
        )}
      </div>

      <div className="rtMapPickerCanvas">
        <div
          ref={container}
          className="rtMapPickerMap rqOperationalMap"
          role="group"
          aria-label="Interactive team location selection map"
        />
        <MapFeedback status={status} retry={retry} />

        {/* Quick center shortcut overlay */}
        <div className="rtMapPickerFloatingActions">
          <button
            type="button"
            className="rtPickerFloatingBtn"
            onClick={handleUseCenter}
            title="Use current map center as candidate position"
            aria-label="Use map center as base location"
          >
            <Crosshair size={14} />
            <span>Use Center</span>
          </button>
        </div>
      </div>

      {/* Coordinate status readout */}
      <div className="rtMapPickerReadout">
        {candidate ? (
          <div className="rtPickerCoordSelected">
            <span className="rtPickerCoordStatusDot" />
            <span className="rtPickerCoordLabel">Selected Base:</span>
            <strong className="rtPickerCoordValue">
              {candidate.latitude.toFixed(6)}° N, {candidate.longitude.toFixed(6)}° E
            </strong>
          </div>
        ) : (
          <div className="rtPickerCoordEmpty">
            <Navigation size={14} className="rtPickerCoordPromptIcon" />
            <span>{helperText}</span>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="rtMapPickerFooter">
        {onCancel && (
          <button
            type="button"
            className="rtPickerBtn rtPickerBtnSecondary"
            aria-label="Cancel location selection"
            onClick={onCancel}
          >
            Cancel
          </button>
        )}
        <button
          type="button"
          className="rtPickerBtn rtPickerBtnPrimary"
          disabled={!candidate}
          onClick={handleConfirm}
        >
          <Check size={15} />
          {confirmLabel}
        </button>
      </div>
    </div>
  );
}

export default LocationMapPicker;
