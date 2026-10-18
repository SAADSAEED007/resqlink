"use client";
import { useEffect, useRef, useState } from "react";
import {
  BrainCircuit,
  Lightbulb,
  ListChecks,
  RefreshCw,
  CloudSun,
  ArrowUpRight,
  ShieldCheck,
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
            ? "AI provider unavailable. Check the backend Groq key/model configuration and retry; no updated analysis has been generated."
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
        <section className="siAutomatedAssessment" aria-label="Automated Weather Assessment">
          <div className="siSectionHeading"><ShieldCheck size={16} /><h3>Automated Weather Assessment</h3></div>
          <div className="siAssessmentIdentity"><strong>{district?.name || "Select a district"}</strong><Attention level={district?.attention?.level || "DATA_UNAVAILABLE"} /></div>
          <span className="siEyebrow">Deterministic prototype rules · Not AI-generated</span>
          {district?.weather ? <div className="siEvidenceValues"><span><b>{district.weather.next24Hours.precipitationMm} mm</b>Forecast / 24h</span><span><b>{district.weather.next24Hours.maxProbabilityPercent}%</b>Max rain chance</span><span><b>{district.weather.current.windKmh} km/h</b>Current wind</span></div> : <p>Current weather evidence is unavailable. Assessments and resources can still be reviewed.</p>}
          <p>{district?.attention?.reasons.join(" ") || "No monitoring level can be assigned without valid evidence."}</p>
          <details><summary>Rule evidence &amp; limitations</summary>
            {district?.weather && <p>{district.weather.provider} · Fetched {date(district.weather.retrievedAt)} PKT. Interval: {date(district.weather.next24Hours.start)} to {date(district.weather.next24Hours.end)} PKT.</p>}
            {district?.attention?.policy && <p>Elevated: ≥ {district.attention.policy.elevatedRainMm} mm. Urgent review: ≥ {district.attention.policy.urgentRainMm} mm. {district.attention.policy.disclaimer}</p>}
            {district?.attention?.missingEvidence?.map(text => <p key={text}>{text}</p>)}
          </details>
        </section>
        <section className="siGroqSection" aria-label="Groq AI Preparedness Analysis" aria-busy={busy}>
        <div className="siSectionHeading"><BrainCircuit size={16} /><h3>Groq AI Preparedness Analysis</h3></div>
        {!district?.aiConfigured ? (
          <div className="siEmptyCompact siAiStatus">
            <BrainCircuit size={26} />
            <h3>AI analysis is not configured.</h3>
            <p>Weather monitoring and coordinator actions work independently.</p>
          </div>
        ) : !analysis ? (
          <div className="siEmptyCompact siAiStatus">
            <Lightbulb size={25} />
            <p>
              {available ? "Generate a district-specific explanation from the forecast and matching local assessments." : "A current forecast is required for AI guidance. Review existing local reports in the meantime."}
            </p>
          </div>
        ) : (
          <>
            <p className="siGeneratedMeta">{district?.name} · Generated <time dateTime={analysis.value.generatedAt}>{date(analysis.value.generatedAt)} PKT</time></p>
            <div className="siAnalysisSummary">
              <h4>Weather Evidence</h4>
              <p>{analysis.value.summary}</p>
              {analysis.version !== version && (
                <p role="status">
                  Forecast evidence changed. This is the previous analysis; generate an updated result.
                </p>
              )}
            </div>
            <h3>
              <Lightbulb size={17} />
              Why It Matters
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
              Recommended Human Actions
            </h3>
            <ul className="siActionsList">
              {analysis.value.preparednessActions.map((item, i) => (
                <li key={i}>
                  <strong>{item.action}</strong>
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
              <summary>Evidence sources &amp; limitations</summary>
              {analysis.value.evidence?.map((fact) => (
                <p key={fact.id}>
                  <strong>{fact.id}</strong>: {fact.text}
                </p>
              ))}
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
        {error && available && <p className="siFootnote">Use Generate Updated Analysis to retry. The automated assessment remains available.</p>}
        </section>
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
            <p className="siMuted">
              {weather.current.condition
                ? `${weather.current.condition} · `
                : ""}
              {weather.current.temperatureC}°C · Wind {weather.current.windKmh}{" "}
              km/h · Observation {date(weather.current.time)} (Asia/Karachi)
            </p>
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
              {human(weather.freshness)} forecast · {date(weather.retrievedAt)}{" "}
              · Asia/Karachi
            </p>
            <a
              className="siSource"
              href={
                weather.provider === "WeatherAPI.com"
                  ? "https://www.weatherapi.com/"
                  : "https://open-meteo.com/"
              }
              target="_blank"
              rel="noreferrer"
            >
              Weather data: {weather.provider}
              {weather.provider === "Open-Meteo" ? " · CC BY 4.0" : ""}
            </a>
            {weather.limitations?.map((text) => (
              <p className="siFootnote" key={text}>
                {text}
              </p>
            ))}
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
