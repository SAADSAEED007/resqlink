import { Radio, Clock3 } from "lucide-react";
import type { MonitoredDistrict } from "@/types/risk-zones";
import { date, freshnessLabels } from "./monitoring-utils";

export function WeatherMonitoringStatus({ records, loading }: { records: MonitoredDistrict[]; loading: boolean }) {
  const forecasts = records.flatMap(record => record.weather ? [record.weather] : []);
  const stale = forecasts.filter(weather => weather.freshness === "stale").length;
  const reporting = forecasts.length;
  const state = !forecasts.length ? "unavailable" : stale === forecasts.length ? "stale" : forecasts.some(weather => weather.freshness === "fresh") ? "fresh" : "cached";
  const fetched = forecasts.map(weather => weather.retrievedAt).filter(value => Number.isFinite(Date.parse(value))).sort().at(-1);
  return <div className={`siMonitoringStatus ${state}`} role="status" aria-label="Weather monitoring status" aria-live="polite">
    <span className="siFeedIcon"><Radio size={18} aria-hidden="true" /></span>
    <div><strong>{loading && !forecasts.length ? "Checking weather forecasts" : reporting ? "Weather monitoring active" : stale ? "Weather monitoring delayed" : "Weather unavailable"}</strong>
      <span>{reporting}/{records.length} configured locations reporting{stale ? ` · ${stale} delayed` : ""}{records.length > forecasts.length ? ` · ${records.length - forecasts.length} unavailable` : ""}</span>
    </div>
    <div className="siFeedTime"><b>{freshnessLabels[state]}</b><span><Clock3 size={12} aria-hidden="true" />{fetched ? <>Last fetched <time dateTime={fetched} title={date(fetched)}>{date(fetched)} PKT</time></> : "No successful forecast update"}</span></div>
  </div>;
}
