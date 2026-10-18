import { ApiError, request, queryString } from "./client";
import type {
  MonitoredDistrict,
  MonitoringOverview,
  CommunityAnalysis,
  NearbyShelter,
} from "@/types/risk-zones";
const root = "/weather/districts";
function checked(record: MonitoredDistrict) {
  if (
    !record ||
    typeof record.id !== "string" ||
    typeof record.name !== "string" ||
    !Number.isFinite(record.latitude) ||
    !Number.isFinite(record.longitude)
  )
    throw new ApiError("Invalid district monitoring record", 0, "protocol");
  if (
    record.attention &&
    !["ROUTINE", "ELEVATED", "URGENT_REVIEW", "DATA_UNAVAILABLE"].includes(
      record.attention.level,
    )
  )
    throw new ApiError("Invalid weather attention level", 0, "protocol");
  if (
    record.weather &&
    (!Number.isFinite(record.weather.current?.temperatureC) ||
      !Number.isFinite(record.weather.next24Hours?.precipitationMm) ||
      !Number.isFinite(record.weather.next24Hours?.maxProbabilityPercent) ||
      !Array.isArray(record.weather.days))
  )
    throw new ApiError("Incomplete forecast response", 0, "protocol");
  return record;
}
export const districtWeather = {
  registry: (signal?: AbortSignal) =>
    request<{
      items: MonitoredDistrict[];
      coverage: string;
      datasetVersion: string;
    }>(root, { signal }).then((value) => {
      if (!Array.isArray(value?.items))
        throw new ApiError("Invalid district registry", 0, "protocol");
      value.items.forEach(checked);
      return value;
    }),
  overview: (signal?: AbortSignal, refresh = false) =>
    request<MonitoringOverview>(
      `${root}/overview${refresh ? "?refresh=true" : ""}`,
      {
        signal,
        timeoutMs: 35000,
      },
    ).then((value) => {
      if (!Array.isArray(value?.items))
        throw new ApiError("Invalid district overview", 0, "protocol");
      value.items.forEach(checked);
      return value;
    }),
  get: (id: string, signal?: AbortSignal) =>
    request<MonitoredDistrict>(`${root}/${encodeURIComponent(id)}`, {
      signal,
      timeoutMs: 12000,
    }).then(checked),
  analyze: (id: string) =>
    request<CommunityAnalysis>(
      `${root}/${encodeURIComponent(id)}/ai-analysis`,
      { method: "POST", body: {}, timeoutMs: 35000 },
    ),
  shelters: (latitude: number, longitude: number, signal?: AbortSignal) =>
    request<{ items: NearbyShelter[] }>(
      `/shelters${queryString({ latitude, longitude, radiusKm: 25, limit: 10, page: 1, isSimulated: false })}`,
      { signal },
    ),
  resources: (id: string, signal?: AbortSignal) =>
    request<
      { category: string; quantity: number; unit: string; status: string }[]
    >(`/shelters/${encodeURIComponent(id)}/resources`, { signal }),
};
