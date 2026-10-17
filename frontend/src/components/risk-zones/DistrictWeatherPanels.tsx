"use client";
import { useEffect, useRef, useState } from "react";
import {
  BrainCircuit,
  Lightbulb,
  ListChecks,
  RefreshCw,
  CloudSun,
  ArrowUpRight,
} from "lucide-react";
import type { MonitoredDistrict, CommunityAnalysis } from "@/types/risk-zones";
import { districtWeather } from "@/lib/api/district-weather";
import { ApiError, errorMessage } from "@/lib/api/client";
import { Attention, WeatherIcon, date, human } from "./monitoring-utils";
export function DistrictAiPanel({
  district,
}: {
  district: MonitoredDistrict | null;
}) {
  const [analysis, setAnalysis] = useState<{
      value: CommunityAnalysis;
      version: string;
    } | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const lock = useRef(false),
    alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  const version = JSON.stringify([
    district?.weather?.retrievedAt,
    district?.attention?.level,
  ]);
  const available =
    !!district?.aiConfigured &&
    !!district.weather &&
    district.attention?.level !== "DATA_UNAVAILABLE";
  async function generate() {
    if (!district || !available || lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      const value = await districtWeather.analyze(district.id);
      if (alive.current) setAnalysis({ value, version });
    } catch (err) {
      if (alive.current)
        setError(
          err instanceof ApiError && [502, 503].includes(err.status)
            ? "AI provider unavailable. Check the backend Groq key/model configuration and retry; no analysis has been generated."
            : errorMessage(err),
        );
    } finally {
      lock.current = false;
      if (alive.current) setBusy(false);
    }
  }
  return (
    <section className="siCard siAi">
      <header>
        <h2>
          <BrainCircuit size={17} />
          AI Risk Analysis
        </h2>
        <span className="siProvider">
          {district?.aiConfigured ? "Powered by Groq" : "Groq not configured"}
        </span>
      </header>
      <div className="siAiBody">
        <div className="siAiIntro">
          <BrainCircuit size={20} />
          <h3>Risk Analysis &amp; Recommendations</h3>
        </div>
        <p className="siMuted">
          {district?.name || "Select a district"} ° Evidence-led preparedness
        </p>
        {!district?.aiConfigured ? (
          <div className="siEmptyCompact">
            <BrainCircuit size={26} />
            <h3>AI analysis is not configured.</h3>
            <p>
              Groq API key is not configured on the backend. District monitoring
              works independently.
            </p>
          </div>
        ) : !analysis ? (
          <div className="siEmptyCompact">
            <Lightbulb size={25} />
            <p>
              Generate a summary from the actual forecast and matching local
              assessment records.
            </p>
          </div>
        ) : (
          <>
            <div className="siAnalysisSummary">
              <Attention
                level={district.attention?.level || "DATA_UNAVAILABLE"}
              />
              <p>{analysis.value.summary}</p>
              {analysis.version !== version && (
                <p role="status">
                  Forecast evidence changed. Generate an updated analysis.
                </p>
              )}
            </div>
            <h3>
              <Lightbulb size={17} />
              Key Insights
            </h3>
            <ul>
              {analysis.value.keyInsights.map((item, i) => (
                <li key={i}>
                  {item.explanation}
                  <small>{item.evidenceReferences.join(" · ")}</small>
                </li>
              ))}
            </ul>
            <h3>
              <ListChecks size={17} />
              Preparedness Checklist
            </h3>
            <ul className="siActionsList">
              {analysis.value.preparednessActions.map((item, i) => (
                <li key={i}>
                  <label>
                    <input type="checkbox" />
                    {item.action}
                  </label>
                  <small>{item.reason}</small>
                </li>
              ))}
            </ul>
            {analysis.value.missingInformation.length > 0 && (
              <details>
                <summary>Missing information</summary>
                <ul>
                  {analysis.value.missingInformation.map((text) => (
                    <li key={text}>{text}</li>
                  ))}
                </ul>
              </details>
            )}
            <details>
              <summary>Sources &amp; limitations</summary>
              <p>
                {analysis.value.model} · {date(analysis.value.generatedAt)} ·
                Session-only result
              </p>
              {analysis.value.limitations.map((text) => (
                <p key={text}>{text}</p>
              ))}
            </details>
          </>
        )}
        {error && (
          <p className="siError" role="alert">
            {error}
          </p>
        )}
        <button
          className="siPrimary siGenerate"
          disabled={!available || busy}
          onClick={() => void generate()}
        >
          <RefreshCw size={16} className={busy ? "siSpin" : ""} />
          {busy ? "Analyzing forecast evidence…" : "Generate Updated Analysis"}
        </button>
        <p className="siFootnote">
          AI-assisted preparedness guidance. Human review required. This is not
          an official disaster warning.
        </p>
      </div>
    </section>
  );
}
export function DistrictForecastPanel({
  district,
  onHourly,
}: {
  district: MonitoredDistrict | null;
  onHourly: () => void;
}) {
  const weather = district?.weather;
  return (
    <section className="siCard siForecast">
      <header>
        <h2>
          <CloudSun size={17} />
          Weather Forecast
        </h2>
        <button className="siTextButton" disabled={!weather} onClick={onHourly}>
          View Hourly <ArrowUpRight size={13} />
        </button>
      </header>
      <div className="siForecastBody">
        <p className="siMuted">
          {district?.monitoringLocation || "Select a monitoring location"}
        </p>
        {weather ? (
          <>
            <div className="siDays">
              {weather.days.slice(0, 4).map((day) => (
                <div className="siDay" key={day.time}>
                  <strong>
                    {new Date(day.time).toLocaleDateString("en-PK", {
                      weekday: "short",
                      day: "numeric",
                      timeZone: "Asia/Karachi",
                    })}
                  </strong>
                  <WeatherIcon code={day.weatherCode} />
                  <b>{Math.round(day.maxC)}°C</b>
                  <span>{Math.round(day.minC)}° low</span>
                  <small>{day.precipitationMm} mm</small>
                  <small>{day.probabilityPercent}% max</small>
                </div>
              ))}
            </div>
            <p className="siFootnote">
              {human(weather.freshness)} forecast · {date(weather.retrievedAt)}
            </p>
            <a
              className="siSource"
              href="https://open-meteo.com/"
              target="_blank"
              rel="noreferrer"
            >
              Weather data: Open-Meteo · CC BY 4.0
            </a>
          </>
        ) : (
          <div className="siEmptyCompact">
            <CloudSun size={30} />
            <h3>Weather unavailable</h3>
            <p>{district?.error || "Waiting for this location?s forecast."}</p>
          </div>
        )}
      </div>
    </section>
  );
}
