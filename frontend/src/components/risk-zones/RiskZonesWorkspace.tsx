"use client";
import { useState } from "react";
import dynamic from "next/dynamic";
import {
  Globe2,
  RefreshCw,
  Search,
  MapPin,
  ChevronRight,
  AlertTriangle,
  CloudRain,
  ShieldCheck,
  Info,
  ArrowUpRight,
} from "lucide-react";
import { useDistrictMonitoring } from "./use-district-monitoring";
import { CommunityAssessments } from "./CommunityAssessments";
import { DistrictDetails, type DistrictTab } from "./DistrictDetails";
import {
  DistrictAiPanel,
  DistrictForecastPanel,
} from "./DistrictWeatherPanels";
import {
  Attention,
  WeatherIcon,
  attentionLabels,
  date,
} from "./monitoring-utils";
import type { AttentionLevel } from "@/types/risk-zones";
import "./sindh-intelligence.css";
const MonitoringMap = dynamic(
  () =>
    import("./SindhMonitoringMap").then((module) => module.SindhMonitoringMap),
  {
    ssr: false,
    loading: () => (
      <div className="siCard siMapSkeleton" role="status">
        Loading Sindh map…
      </div>
    ),
  },
);
export function RiskZonesWorkspace() {
  const [mode, setMode] = useState("districts"),
    [communitiesOpened, setCommunitiesOpened] = useState(false),
    [tab, setTab] = useState<DistrictTab>("Overview");
  const model = useDistrictMonitoring(),
    { selected } = model;
  const counts = [
    model.records.length,
    ...(["URGENT_REVIEW", "ELEVATED", "ROUTINE"] as AttentionLevel[]).map(
      (level) =>
        model.records.filter((item) => item.attention?.level === level).length,
    ),
  ];
  const unavailable = model.records.filter(
    (item) => !item.attention || item.attention.level === "DATA_UNAVAILABLE",
  ).length;
  const weather = selected?.weather;
  return (
    <div className="siWorkspace">
      <header className="siPageHeader">
        <i className="siPageIcon">
          <Globe2 size={29} />
        </i>
        <div>
          <h1>Sindh Disaster Risk Intelligence</h1>
          <p>
            Weather-informed monitoring and proactive disaster preparedness
            across Sindh.
          </p>
        </div>
        <div className="siHeaderWeather">
          <WeatherIcon code={weather?.current.weatherCode} />
          <div>
            <strong>{selected?.name || "Sindh Monitoring"}</strong>
            <b>
              {weather
                ? `${weather.current.temperatureC}°C`
                : "Forecast pending"}
            </b>
            <small>
              {weather
                ? `${weather.next24Hours.precipitationMm} mm / next 24h`
                : "Representative locations"}
            </small>
            {weather && (
              <small>
                {weather.freshness} forecast · {date(weather.current.time)}
              </small>
            )}
          </div>
        </div>
        <button
          className="siPrimary"
          disabled={model.refreshing}
          title="Checks the shared forecast cache. Provider requests respect cache expiry and cooldown."
          onClick={model.refresh}
        >
          <RefreshCw size={16} className={model.refreshing ? "siSpin" : ""} />
          {model.refreshing ? "Fetching forecasts…" : "Refresh Weather"}
        </button>
      </header>
      <div
        className="siMainTabs"
        role="tablist"
        aria-label="Risk intelligence views"
      >
        <button
          role="tab"
          aria-selected={mode === "districts"}
          onClick={() => setMode("districts")}
        >
          District Monitoring
        </button>
        <button
          role="tab"
          aria-selected={mode === "communities"}
          onClick={() => {
            setCommunitiesOpened(true);
            setMode("communities");
          }}
        >
          Community Assessments
        </button>
        <span>
          <i />
          Prototype decision support
        </span>
      </div>
      {communitiesOpened && (
        <section hidden={mode !== "communities"}>
          <CommunityAssessments />
        </section>
      )}
      {mode === "districts" && (
        <>
          <section
            className="siMetrics"
            aria-label="District monitoring totals"
          >
            {[
              {
                name: "Monitored Districts",
                icon: Globe2,
                tone: "blue",
                caption: "Verified monitoring locations",
              },
              {
                name: "Urgent Review",
                icon: AlertTriangle,
                tone: "red",
                caption: "Human review attention",
              },
              {
                name: "Elevated Attention",
                icon: CloudRain,
                tone: "amber",
                caption: "Review forecast evidence",
              },
              {
                name: "Routine Monitoring",
                icon: ShieldCheck,
                tone: "blue",
                caption: "Below prototype thresholds",
              },
            ].map((metric, index) => (
              <article className={`siMetric ${metric.tone}`} key={metric.name}>
                <i>
                  <metric.icon size={29} />
                </i>
                <div>
                  <h2>{metric.name}</h2>
                  <strong>
                    {index > 0 && !model.overview ? "?" : counts[index]}
                  </strong>
                  <p>{metric.caption}</p>
                </div>
              </article>
            ))}
          </section>
          <div className="siCoverage">
            <span>
              <Info size={13} />
              {model.overview?.coverage ||
                "Verified seven-district subset · Remaining Sindh districts are not configured."}
            </span>
            <span>
              {model.refreshing
                ? "Forecast retrieval in progress"
                : `${unavailable} data unavailable`}{" "}
              ·{" "}
              {model.records.some((item) => item.weather)
                ? `Last forecast update ${date(
                    model.records
                      .filter((item) => item.weather)
                      .map((item) => item.weather!.retrievedAt)
                      .sort()
                      .at(-1),
                  )} (Asia/Karachi)`
                : "No successful forecast update"}
            </span>
          </div>
          {model.overview?.provider?.state === "COOLDOWN" && (
            <p className="siError" role="status">
              {model.overview.provider.reason === "RATE_LIMITED"
                ? "Weather provider rate limited."
                : "Weather provider temporarily unavailable."}{" "}
              Refresh respects provider cooldown. Next provider check is allowed
              after {date(model.overview.provider.retryAt)} (Asia/Karachi).{" "}
              Cached forecasts retain their original timestamps; stale forecasts
              are not used for attention classification.
            </p>
          )}
          {model.error && (
            <p className="siError" role="alert">
              {model.error}{" "}
              <button onClick={model.refresh}>Retry Weather</button>
            </p>
          )}
          <div className="siGrid">
            <section className="siCard siDirectory">
              <header>
                <h2>
                  Sindh Districts <small>({model.records.length})</small>
                </h2>
                <span>{model.records.length} configured locations</span>
              </header>
              <div className="siDirectoryFilters">
                <label className="siSearch">
                  <Search size={16} />
                  <input
                    aria-label="Search districts"
                    placeholder="Search districts…"
                    value={model.search}
                    onChange={(event) => model.setSearch(event.target.value)}
                  />
                </label>
                <select
                  aria-label="Filter weather attention"
                  value={model.filter}
                  onChange={(event) =>
                    model.setFilter(event.target.value as AttentionLevel | "")
                  }
                >
                  <option value="">All attention levels</option>
                  {Object.entries(attentionLabels).map(([value, text]) => (
                    <option key={value} value={value}>
                      {text}
                    </option>
                  ))}
                </select>
              </div>
              <div className="siDirectoryList">
                {!model.records.length ? (
                  <div className="siEmptyCompact" role="status">
                    {model.error
                      ? "Monitoring registry is unavailable."
                      : "Loading verified monitoring locations…"}
                  </div>
                ) : !model.visible.length ? (
                  <div className="siEmptyCompact">
                    No districts match these filters.{" "}
                    <button
                      onClick={() => {
                        model.setSearch("");
                        model.setFilter("");
                      }}
                    >
                      Clear filters
                    </button>
                  </div>
                ) : (
                  model.visible.map((item) => (
                    <button
                      className="siDistrictRow"
                      key={item.id}
                      aria-pressed={model.selectedId === item.id}
                      onClick={() => model.setSelectedId(item.id)}
                    >
                      <i
                        className={`siDistrictIcon ${(item.attention?.level || "DATA_UNAVAILABLE").toLowerCase()}`}
                      >
                        <WeatherIcon
                          code={item.weather?.current.weatherCode}
                          size={26}
                        />
                      </i>
                      <div>
                        <strong>{item.name}</strong>
                        <small>
                          <MapPin size={11} />
                          {item.monitoringLocation}
                        </small>
                        <span className="siRowStats">
                          {item.weather
                            ? `${item.weather.next24Hours.precipitationMm} mm / 24h · ${item.weather.next24Hours.maxProbabilityPercent}% max probability`
                            : model.refreshing
                              ? "Retrieving forecast…"
                              : "Forecast unavailable"}
                        </span>
                        <small className="siRetrieved">
                          {item.weather
                            ? `${item.weather.freshness} · ${date(item.weather.retrievedAt)}`
                            : "No current provider evidence"}
                        </small>
                      </div>
                      <div className="siRowEnd">
                        <Attention
                          level={item.attention?.level || "DATA_UNAVAILABLE"}
                        />
                        <ChevronRight size={16} />
                      </div>
                    </button>
                  ))
                )}
              </div>
              <footer>
                <span>
                  {model.visible.length} of {model.records.length} monitored
                  locations
                </span>
                <a
                  href="https://www.pbs.gov.pk/result-excel/"
                  target="_blank"
                  rel="noreferrer"
                >
                  District source <ArrowUpRight size={12} />
                </a>
              </footer>
            </section>
            <div className="siCenterColumn">
              <MonitoringMap
                items={model.records}
                selectedId={model.selectedId}
                onSelect={model.setSelectedId}
              />
              <div className="siDetailsSlot">
                {model.detailError && (
                  <p className="siError" role="alert">
                    {model.detailError}
                  </p>
                )}
                <DistrictDetails
                  district={selected}
                  tab={tab}
                  setTab={setTab}
                  onCommunities={() => {
                    setCommunitiesOpened(true);
                    setMode("communities");
                  }}
                />
              </div>
            </div>
            <div className="siRightColumn">
              <div className="siAiSlot">
                <DistrictAiPanel
                  key={selected?.id || "none"}
                  district={selected}
                />
              </div>
              <div className="siForecastSlot">
                <DistrictForecastPanel
                  district={selected}
                  onHourly={() => setTab("Forecast Evidence")}
                />
              </div>
            </div>
          </div>
        </>
      )}
      <p className="siPageNotice">
        Weather attention is separate from recorded community risk. No automatic
        dispatch or official warnings. Forecast shown for a representative
        district monitoring location.
      </p>
    </div>
  );
}
