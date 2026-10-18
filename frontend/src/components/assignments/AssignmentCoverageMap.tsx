"use client";
import { useEffect, useRef } from "react";
import Link from "next/link";
import { MapPin, Crosshair } from "lucide-react";
import {
  getIncidentMarkerIcon,
  getRescueTeamMarkerIcon,
} from "@/components/dashboard/map-marker";
import type { Incident, RescueTeam } from "@/types/api";
import { incidentNames } from "./assignment-data";
import { useMapBase } from "@/components/maps/use-map-base";
import { MapFeedback } from "@/components/maps/MapFeedback";
import {
  mapPosition,
  outsideOperationalRegion,
  validCoordinates,
  type MapPosition,
} from "@/components/maps/map-coordinates";
import { fitMapPositions, positionsKey } from "@/components/maps/map-bounds";
import { teamPopup } from "@/components/maps/map-popups";
import { bindMarkerActivation } from "@/components/maps/map-markers";

export function AssignmentCoverageMap({
  incident,
  teams,
  selectedTeam,
  selectTeam,
  eligibleTeamIds,
}: {
  incident?: Incident;
  teams: RescueTeam[];
  selectedTeam: string;
  selectTeam: (id: string) => void;
  eligibleTeamIds: string[];
}) {
  const node = useRef<HTMLDivElement>(null);
  const { map, ready, status, retry } = useMapBase(node, true);
  const callback = useRef(selectTeam);
  useEffect(() => {
    callback.current = selectTeam;
  }, [selectTeam]);
  const mapped = teams.filter((team) => validCoordinates(team.location));
  const incidentPoint = mapPosition(incident?.location);
  const positions = [
    ...(incidentPoint ? [incidentPoint] : []),
    ...mapped.map((team) => mapPosition(team.location)!),
  ];
  const viewKey = JSON.stringify([
    incident?._id,
    JSON.parse(positionsKey(positions)),
  ]);
  const signature = JSON.stringify({
    incident,
    teams: mapped,
    selectedTeam,
    eligibleTeamIds,
  });
  const markers = useRef(new Map<string, import("leaflet").Marker>());
  const eligibleIds = useRef(new Set(eligibleTeamIds));
  useEffect(() => {
    eligibleIds.current = new Set(eligibleTeamIds);
  }, [eligibleTeamIds]);
  const popupSelection = useRef("");
  useEffect(() => {
    if (!ready) {
      markers.current.clear();
      return;
    }
    let active = true;
    void import("leaflet").then((L) => {
      if (!active || !map.current) return;
      const data = JSON.parse(signature) as {
        incident?: Incident;
        teams: RescueTeam[];
        selectedTeam: string;
        eligibleTeamIds: string[];
      };
      const point = mapPosition(data.incident?.location);
      const ids = new Set([
        ...data.teams.map((team) => team._id),
        ...(point && data.incident ? [data.incident._id] : []),
      ]);
      for (const [id, marker] of markers.current)
        if (!ids.has(id)) {
          marker.remove();
          markers.current.delete(id);
        }
      if (point && data.incident) {
        const content = document.createElement("div");
        content.textContent = `${incidentNames[data.incident.emergencyType]} · ${data.incident.priorityLevel} · Reported location. ${data.incident.location?.address || "Address not recorded"}${outsideOperationalRegion(data.incident.location!) ? " · Outside approximate Sindh operational extent" : ""}`;
        const link = document.createElement("a");
        link.href = `/dashboard/incidents/${encodeURIComponent(data.incident._id)}`;
        link.textContent = "View Incident Details";
        content.append(document.createElement("br"), link);
        let marker = markers.current.get(data.incident._id);
        if (!marker) {
          marker = L.marker(point, {
            title: "Selected incident location",
            alt: "Reported incident location",
          })
            .bindPopup(content)
            .addTo(map.current);
          markers.current.set(data.incident._id, marker);
        } else marker.setLatLng(point).setPopupContent(content);
        marker.setIcon(
          getIncidentMarkerIcon(L, data.incident.priorityLevel, true),
        );
      }
      for (const team of data.teams) {
        const eligible = data.eligibleTeamIds.includes(team._id);
        let marker = markers.current.get(team._id);
        if (!marker) {
          marker = L.marker(mapPosition(team.location)!, {
            icon: getRescueTeamMarkerIcon(
              L,
              team.status,
              team._id === data.selectedTeam,
            ),
            title: team.name,
            alt: `${team.name}: stored team base location`,
          })
            .bindPopup(teamPopup(team, eligible), { autoPan: false })
            .addTo(map.current);
          bindMarkerActivation(marker, () => {
            if (eligibleIds.current.has(team._id)) callback.current(team._id);
          });
          markers.current.set(team._id, marker);
        } else
          marker
            .setLatLng(mapPosition(team.location)!)
            .setPopupContent(teamPopup(team, eligible));
        marker
          .setIcon(
            getRescueTeamMarkerIcon(
              L,
              team.status,
              team._id === data.selectedTeam,
            ),
          )
          .setOpacity(eligible || team._id === data.selectedTeam ? 1 : 0.65);
        if (
          team._id === data.selectedTeam &&
          popupSelection.current !== data.selectedTeam
        )
          marker.openPopup();
      }
      popupSelection.current = data.selectedTeam;
    });
    return () => {
      active = false;
    };
  }, [map, ready, signature]);
  useEffect(() => {
    if (ready && map.current)
      fitMapPositions(
        map.current,
        (JSON.parse(viewKey) as [string | null, MapPosition[]])[1],
      );
  }, [map, ready, viewKey]);
  return (
    <section className="awCard awMapCard">
      <header>
        <h2>
          <MapPin size={18} />
          Incident Location &amp; Team Coverage
        </h2>
        <button
          aria-label="Fit incident and team locations"
          onClick={() => {
            if (map.current) fitMapPositions(map.current, positions);
          }}
        >
          <Crosshair size={18} />
        </button>
      </header>
      <div className="awMapWrap">
        <div
          ref={node}
          className="awMap rqOperationalMap"
          aria-label="Selected incident and stored rescue team base locations"
        />
        <div className="awMapNotice">
          {incident ? (
            <>
              {incidentNames[incident.emergencyType]} · {incident.priorityLevel}
              <br />
              {incidentPoint
                ? "Reported incident location and stored team bases."
                : "Incident location has not been mapped yet. Team locations shown. Incident position requires verification."}
              <br />
              <Link
                href={`/dashboard/incidents/${encodeURIComponent(incident._id)}`}
              >
                View Incident Details
              </Link>
            </>
          ) : (
            "Select an incident. Stored team bases are shown."
          )}
          {!positions.length && (
            <>
              <br />
              No verified map positions available for these records. Sindh
              overview shown.
            </>
          )}
        </div>
        <MapFeedback status={status} retry={retry} />
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
          <span>
            <i style={{ background: "#64748b" }} />
            Offline team
          </span>
        </div>
      </div>
      <p className="awMapCaption">
        Stored team base locations · eligible teams can be selected manually ·
        no live tracking or travel-time estimate
      </p>
    </section>
  );
}
