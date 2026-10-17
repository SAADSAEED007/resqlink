"use client";
import { useEffect, useState } from "react";
import {
  MapPin,
  Users,
  ShieldCheck,
  House,
  ExternalLink,
  ChartNoAxesColumn,
  Info,
} from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import type {
  MonitoredDistrict,
  RiskZone,
  NearbyShelter,
} from "@/types/risk-zones";
import { riskZones } from "@/lib/api/risk-zones";
import { districtWeather } from "@/lib/api/district-weather";
import { errorMessage } from "@/lib/api/client";
import { Attention, date, human } from "./monitoring-utils";
export type DistrictTab =
  | "Overview"
  | "Forecast Evidence"
  | "Local Assessments"
  | "Nearby Resources";
export function DistrictDetails({
  district,
  tab,
  setTab,
  onCommunities,
}: {
  district: MonitoredDistrict | null;
  tab: DistrictTab;
  setTab: (tab: DistrictTab) => void;
  onCommunities: () => void;
}) {
  return (
    <section className="siCard siDetails">
      <header>
        <h2>District Weather &amp; Preparedness</h2>
        <Attention level={district?.attention?.level || "DATA_UNAVAILABLE"} />
      </header>
      {district ? (
        <>
          <div className="siDistrictIntro">
            <i>
              <MapPin size={29} />
            </i>
            <div>
              <h3>{district.name}</h3>
              <p>{district.monitoringLocation}, Sindh</p>
              <small>
                {district.latitude.toFixed(5)}° N,{" "}
                {district.longitude.toFixed(5)}° E
              </small>
            </div>
          </div>
          <div className="siTabs" role="tablist" aria-label="District details">
            {(
              [
                "Overview",
                "Forecast Evidence",
                "Local Assessments",
                "Nearby Resources",
              ] as DistrictTab[]
            ).map((name) => (
              <button
                key={name}
                role="tab"
                aria-selected={tab === name}
                onClick={() => setTab(name)}
              >
                {name}
              </button>
            ))}
          </div>
          <div className="siDetailBody" role="tabpanel" aria-label={tab}>
            {tab === "Overview" ? (
              <>
                <div className="siFacts">
                  <div>
                    <ChartNoAxesColumn size={21} />
                    <span>
                      Next 24-hour forecast
                      <b>
                        {district.weather
                          ? `${district.weather.next24Hours.precipitationMm} mm`
                          : "Unavailable"}
                      </b>
                    </span>
                  </div>
                  <div>
                    <ShieldCheck size={21} />
                    <span>
                      Monitoring attention
                      <b>
                        {district.attention
                          ? human(district.attention.level)
                          : "Waiting for forecast"}
                      </b>
                    </span>
                  </div>
                  <div>
                    <MapPin size={21} />
                    <span>
                      Forecast location<b>{district.monitoringLocation}</b>
                    </span>
                  </div>
                  <div>
                    <Info size={21} />
                    <span>
                      Source freshness
                      <b>
                        {district.weather
                          ? human(district.weather.freshness)
                          : "Unavailable"}
                      </b>
                    </span>
                  </div>
                </div>
                <div className="siReason">
                  {district.attention?.reasons.map((reason) => (
                    <p key={reason}>{reason}</p>
                  )) || <p>Forecast evidence is loading or unavailable.</p>}
                </div>
                <p className="siFootnote">
                  {district.limitation} This forecast does not represent every
                  part of the district.
                </p>
              </>
            ) : tab === "Forecast Evidence" ? (
              <ForecastEvidence district={district} />
            ) : tab === "Local Assessments" ? (
              <LocalAssessments
                key={district.id}
                district={district}
                onCommunities={onCommunities}
              />
            ) : (
              <NearbyResources key={district.id} district={district} />
            )}
          </div>
        </>
      ) : (
        <div className="siEmptyCompact">Select a monitored district.</div>
      )}
    </section>
  );
}
function ForecastEvidence({ district }: { district: MonitoredDistrict }) {
  const weather = district.weather,
    rows = weather?.hourly
      ?.filter((row) => Date.parse(row.time) > Date.parse(weather.current.time))
      .slice(0, 24);
  return weather ? (
    <>
      <p className="siMuted">
        Open-Meteo · {date(weather.retrievedAt)} · {human(weather.freshness)}
      </p>
      <div
        className="siChart"
        role="img"
        aria-label="Next 24 hourly precipitation amounts in millimeters"
      >
        {rows?.length ? (
          <ResponsiveContainer width="100%" height={160}>
            <AreaChart data={rows}>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="var(--command-border)"
              />
              <XAxis
                dataKey="time"
                tickFormatter={(value) =>
                  new Date(value).toLocaleTimeString("en-PK", {
                    hour: "2-digit",
                    timeZone: "Asia/Karachi",
                  })
                }
                minTickGap={24}
                tick={{ fontSize: 10 }}
              />
              <YAxis unit="mm" width={42} tick={{ fontSize: 10 }} />
              <Tooltip
                labelFormatter={(value) => date(String(value))}
                contentStyle={{
                  background: "var(--command-surface)",
                  borderColor: "var(--command-border)",
                  color: "var(--command-ink)",
                }}
              />
              <Area
                dataKey="precipitationMm"
                name="Precipitation (mm)"
                stroke="#1688f8"
                fill="#1688f833"
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <p>Loading hourly details…</p>
        )}
      </div>
      <div className="siFacts">
        <div>
          <span>
            Precipitation total
            <b>{weather.next24Hours.precipitationMm} mm / 24 hourly periods</b>
          </span>
        </div>
        <div>
          <span>
            Max hourly probability
            <b>{weather.next24Hours.maxProbabilityPercent}%</b>
          </span>
        </div>
        <div>
          <span>
            Current wind<b>{weather.current.windKmh} km/h</b>
          </span>
        </div>
        <div>
          <span>
            Current temperature<b>{weather.current.temperatureC}°C</b>
          </span>
        </div>
      </div>
      <details>
        <summary>Attention rule policy</summary>
        <p>{district.attention?.policy.disclaimer}</p>
        <p>
          Elevated: · {district.attention?.policy.elevatedRainMm} mm. Urgent
          review: · {district.attention?.policy.urgentRainMm} mm. These are
          configurable prototype heuristics.
        </p>
        <p>
          Window: {date(weather.next24Hours.start)} to{" "}
          {date(weather.next24Hours.end)}. Totals use 24 hourly precipitation
          periods ending after the forecast current time.
        </p>
      </details>
      <a
        className="siSource"
        href={district.coordinateSource}
        target="_blank"
        rel="noreferrer"
      >
        Monitoring coordinate source <ExternalLink size={12} />
      </a>
    </>
  ) : (
    <p className="siEmptyCompact">
      Weather unavailable. An attention level cannot be inferred.
    </p>
  );
}
function LocalAssessments({
  district,
  onCommunities,
}: {
  district: MonitoredDistrict;
  onCommunities: () => void;
}) {
  const [items, setItems] = useState<RiskZone[] | null>(null),
    [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    void riskZones
      .list(
        {
          district: district.name,
          page: 1,
          limit: 10,
          isSimulated: false,
          sort: "newest",
        },
        controller.signal,
      )
      .then((data) => setItems(data.items))
      .catch((err) => {
        if (!controller.signal.aborted) setError(errorMessage(err));
      });
    return () => controller.abort();
  }, [district.name]);
  return (
    <>
      <p className="siFootnote">
        Exact recorded district-name match. Human-recorded severity is separate
        from weather attention. Showing up to 10 latest communities.
      </p>
      {error ? (
        <p role="alert" className="siError">
          {error}
        </p>
      ) : items === null ? (
        <p role="status">Loading local records…</p>
      ) : !items.length ? (
        <div className="siEmptyCompact">
          <Users size={27} />
          <h3>No local community assessments recorded yet.</h3>
          <p>District weather monitoring remains available.</p>
        </div>
      ) : (
        items.map((zone) => (
          <div className="siLocalRecord" key={zone._id}>
            <strong>{zone.communityName}</strong>
            <span>{human(zone.hazardSeverity)} recorded severity</span>
            <small>
              {human(zone.assessmentStatus)} ·{" "}
              {date(zone.fieldAssessment?.requestedAt)}
            </small>
            {zone.fieldAssessment && (
              <p>{zone.fieldAssessment.assessmentNotes}</p>
            )}
          </div>
        ))
      )}
      <button onClick={onCommunities} className="siSecondary">
        Open Community Assessments
      </button>
    </>
  );
}
function NearbyResources({ district }: { district: MonitoredDistrict }) {
  const [items, setItems] = useState<NearbyShelter[] | null>(null),
    [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    void districtWeather
      .shelters(district.latitude, district.longitude, controller.signal)
      .then((data) => setItems(data.items))
      .catch((err) => {
        if (!controller.signal.aborted) setError(errorMessage(err));
      });
    return () => controller.abort();
  }, [district.latitude, district.longitude]);
  return (
    <>
      <p className="siFootnote">
        Up to 10 recorded shelters within 25 km of the monitoring point.
        Distances are approximate straight-line distances, not travel estimates
        or district-boundary matches.
      </p>
      {error ? (
        <p role="alert" className="siError">
          {error}
        </p>
      ) : items === null ? (
        <p role="status">Loading nearby shelters…</p>
      ) : !items.length ? (
        <div className="siEmptyCompact">
          <House size={27} />
          <p>No recorded shelters within this search radius.</p>
        </div>
      ) : (
        items.map((shelter) => (
          <ShelterRow key={shelter._id} shelter={shelter} />
        ))
      )}
    </>
  );
}
function ShelterRow({ shelter }: { shelter: NearbyShelter }) {
  const [resources, setResources] = useState<
      | { category: string; quantity: number; unit: string; status: string }[]
      | null
    >(null),
    [error, setError] = useState("");
  async function load() {
    try {
      setResources(await districtWeather.resources(shelter._id));
    } catch (err) {
      setError(errorMessage(err));
    }
  }
  return (
    <div className="siLocalRecord">
      <strong>
        <House size={15} />
        {shelter.name}
      </strong>
      <p>{shelter.address}</p>
      <small>
        {shelter.availableSpaces} available / {shelter.totalCapacity} capacity ·{" "}
        {human(shelter.status)}
        {shelter.approximateDistanceKm !== undefined
          ? ` · ${shelter.approximateDistanceKm} km straight-line`
          : ""}
      </small>
      <details
        onToggle={(event) => {
          if (event.currentTarget.open && resources === null && !error)
            void load();
        }}
      >
        <summary>Relief inventory</summary>
        {error ? (
          <p role="alert">{error}</p>
        ) : resources === null ? (
          <p>Loading inventory…</p>
        ) : !resources.length ? (
          <p>No inventory recorded.</p>
        ) : (
          resources.map((resource, index) => (
            <p key={index}>
              {human(resource.category)}: {resource.quantity} {resource.unit} ·{" "}
              {human(resource.status)}
            </p>
          ))
        )}
      </details>
    </div>
  );
}
