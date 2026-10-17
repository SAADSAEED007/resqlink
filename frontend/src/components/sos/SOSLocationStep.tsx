"use client";
import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { Crosshair, Map, MapPin } from "lucide-react";
import { Button, FormField, Input, LoadingSpinner } from "@/components/ui";
import {
  selectedLocation,
  locationSummary,
  type SOSDraft,
  type DraftErrors,
} from "./report";
const MapPicker = dynamic(() => import("./SOSMapPicker"), {
  ssr: false,
  loading: () => <LoadingSpinner label="Opening location picker..." />,
});
export type UpdateDraft = (patch: Partial<SOSDraft>) => void;
export function SOSLocationStep({
  draft,
  errors,
  update,
}: {
  draft: SOSDraft;
  errors: DraftErrors;
  update: UpdateDraft;
}) {
  const [showMap, setShowMap] = useState(false);
  const [locating, setLocating] = useState(false);
  const [geoError, setGeoError] = useState("");
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const version = useRef(0);
  const coordinateDetails = useRef<HTMLDetailsElement>(null);
  const addressInput = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if ((errors.latitude || errors.longitude) && coordinateDetails.current)
      coordinateDetails.current.open = true;
  }, [errors.latitude, errors.longitude]);
  useEffect(
    () => () => {
      version.current++;
    },
    [],
  );
  function change(patch: Partial<SOSDraft>) {
    version.current++;
    setLocating(false);
    update(patch);
  }
  function locate() {
    const request = ++version.current;
    setGeoError("");
    setAccuracy(null);
    if (!navigator.geolocation) {
      setGeoError(
        "Location is unavailable in this browser. Enter an address or select a point on the map.",
      );
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (result) => {
        if (request !== version.current) return;
        setLocating(false);
        if (
          !Number.isFinite(result.coords.latitude) ||
          !Number.isFinite(result.coords.longitude) ||
          Math.abs(result.coords.latitude) > 90 ||
          Math.abs(result.coords.longitude) > 180
        ) {
          setGeoError(
            "Your device returned an invalid location. Select a point or enter an address instead.",
          );
          return;
        }
        setAccuracy(result.coords.accuracy);
        update({
          latitude: result.coords.latitude.toFixed(6),
          longitude: result.coords.longitude.toFixed(6),
          locationChoice: "gps",
        });
      },
      (error) => {
        if (request !== version.current) return;
        setLocating(false);
        setGeoError(
          error.code === 1
            ? "Location permission was denied. You can enter an address or choose a map point instead."
            : error.code === 3
              ? "Finding your location took too long. Try again, use the map, or enter an address."
              : "Your location is temporarily unavailable. Use the map or enter an address instead.",
        );
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 },
    );
  }
  return (
    <div className="rqSosStepBody">
      <p className="rqSosIntro">
        Choose the place that needs help. Your location is only requested when
        you choose to share it.
      </p>
      <div className="rqSosLocationOptions">
        <Button
          variant="outline"
          loading={locating}
          loadingLabel="Finding your location"
          onClick={locate}
        >
          <Crosshair size={19} aria-hidden="true" />
          Use My Current Location
        </Button>
        <Button
          variant="outline"
          onClick={() => setShowMap(!showMap)}
          aria-expanded={showMap}
        >
          <Map size={19} aria-hidden="true" />
          {showMap ? "Hide map" : "Select on Map"}
        </Button>
        <Button
          variant="outline"
          onClick={() => {
            change({ locationChoice: "manual", latitude: "", longitude: "" });
            addressInput.current?.focus();
          }}
        >
          <MapPin size={19} aria-hidden="true" />
          Enter Location Manually
        </Button>
      </div>
      {geoError && (
        <p className="rqSosInlineNotice" role="status">
          {geoError}
        </p>
      )}
      {accuracy !== null && draft.locationChoice === "gps" && (
        <p className="helper">
          Device estimate: within approximately {Math.round(accuracy)} metres.
          Check that this is where help is needed.
        </p>
      )}
      {showMap && (
        <MapPicker
          value={selectedLocation(draft)}
          onSelect={(point) =>
            change({
              latitude: String(point.latitude),
              longitude: String(point.longitude),
              locationChoice: "map",
            })
          }
        />
      )}
      <FormField
        label="Area, address, or nearby landmark"
        description="An address alone is accepted as unverified text; it does not create GPS coordinates."
        error={errors.area}
      >
        {(props) => (
          <Input
            {...props}
            ref={addressInput}
            value={draft.area}
            maxLength={300}
            placeholder="Village, district, road, or a nearby landmark"
            onChange={(event) =>
              change({
                area: event.target.value,
                locationChoice:
                  draft.latitude || draft.longitude
                    ? draft.locationChoice
                    : "manual",
              })
            }
          />
        )}
      </FormField>
      <details className="rqSosDisclosure" ref={coordinateDetails}>
        <summary>Enter coordinates (optional)</summary>
        <div className="rqSosFieldGrid">
          <FormField label="Latitude" error={errors.latitude}>
            {(props) => (
              <Input
                {...props}
                inputMode="decimal"
                value={draft.latitude}
                placeholder="-90 to 90"
                onChange={(event) =>
                  change({
                    latitude: event.target.value,
                    locationChoice: "manual",
                  })
                }
              />
            )}
          </FormField>
          <FormField label="Longitude" error={errors.longitude}>
            {(props) => (
              <Input
                {...props}
                inputMode="decimal"
                value={draft.longitude}
                placeholder="-180 to 180"
                onChange={(event) =>
                  change({
                    longitude: event.target.value,
                    locationChoice: "manual",
                  })
                }
              />
            )}
          </FormField>
        </div>
      </details>
      <label className="rqSosChoice">
        <input
          type="checkbox"
          checked={draft.locationChoice === "unknown"}
          onChange={(event) =>
            change(
              event.target.checked
                ? {
                    locationChoice: "unknown",
                    latitude: "",
                    longitude: "",
                    area: "",
                  }
                : { locationChoice: "unset" },
            )
          }
        />
        <span>
          I don&apos;t know the exact location
          <span className="helper">
            You can continue. A coordinator will need to verify it.
          </span>
        </span>
      </label>
      {errors.locationChoice && (
        <p role="alert" className="validation">
          {errors.locationChoice}
        </p>
      )}
      <div className="rqSosLocationSummary" role="status">
        <MapPin size={18} aria-hidden="true" />
        <span>
          {draft.locationChoice === "unset"
            ? "No location shared yet"
            : locationSummary(draft)}
        </span>
      </div>
    </div>
  );
}
