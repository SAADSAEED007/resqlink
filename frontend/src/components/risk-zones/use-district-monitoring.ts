"use client";
import { useEffect, useState } from "react";
import { districtWeather } from "@/lib/api/district-weather";
import { errorMessage } from "@/lib/api/client";
import type {
  MonitoredDistrict,
  MonitoringOverview,
  AttentionLevel,
} from "@/types/risk-zones";
export function useDistrictMonitoring() {
  const [registry, setRegistry] = useState<MonitoredDistrict[]>([]),
    [overview, setOverview] = useState<MonitoringOverview | null>(null),
    [detail, setDetail] = useState<MonitoredDistrict | null>(null);
  const [selectedId, setSelectedId] = useState("hyderabad"),
    [search, setSearch] = useState(""),
    [filter, setFilter] = useState<AttentionLevel | "">("");
  const [error, setError] = useState(""),
    [detailError, setDetailError] = useState(""),
    [refreshing, setRefreshing] = useState(true),
    [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    void districtWeather
      .registry(controller.signal)
      .then((data) => {
        setRegistry(data.items);
      })
      .catch((err) => {
        if (!controller.signal.aborted) setError(errorMessage(err));
      });
    return () => controller.abort();
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    void districtWeather
      .overview(controller.signal)
      .then((data) => {
        setOverview(data);
        setError("");
      })
      .catch((err) => {
        if (!controller.signal.aborted) setError(errorMessage(err));
      })
      .finally(() => {
        if (!controller.signal.aborted) setRefreshing(false);
      });
    return () => controller.abort();
  }, [attempt]);
  const selectedVersion = overview?.items.find((item) => item.id === selectedId)
    ?.weather?.retrievedAt;
  useEffect(() => {
    // Overview populates the shared server cache before detail requests start.
    // Browsing/refreshing unchanged evidence does not request detail again.
    if (!selectedVersion) return;
    const controller = new AbortController();
    void districtWeather
      .get(selectedId, controller.signal)
      .then((data) => {
        setDetail(data);
        setDetailError("");
      })
      .catch((err) => {
        if (!controller.signal.aborted) setDetailError(errorMessage(err));
      });
    return () => controller.abort();
  }, [selectedId, selectedVersion]);
  useEffect(() => {
    const interval = setInterval(
      () => {
        if (!document.hidden) {
          setRefreshing(true);
          setAttempt((n) => n + 1);
        }
      },
      15 * 60 * 1000,
    );
    return () => clearInterval(interval);
  }, []);
  const records = (registry.length ? registry : overview?.items || []).map(
    (item) => overview?.items.find((value) => value.id === item.id) || item,
  );
  const current = records.find((item) => item.id === selectedId) || null;
  const selected = current
    ? {
        ...current,
        weather:
          current.weather &&
          detail?.id === selectedId &&
          detail.weather?.retrievedAt === current.weather.retrievedAt
            ? { ...current.weather, hourly: detail.weather.hourly }
            : current.weather,
      }
    : null;
  const visible = records.filter(
    (item) =>
      (!search ||
        `${item.name} ${item.monitoringLocation}`
          .toLowerCase()
          .includes(search.toLowerCase())) &&
      (!filter || (item.attention?.level || "DATA_UNAVAILABLE") === filter),
  );
  return {
    records,
    visible,
    selected,
    selectedId,
    setSelectedId,
    search,
    setSearch,
    filter,
    setFilter,
    error,
    detailError,
    refreshing,
    overview,
    attempt,
    refresh: () => {
      setRefreshing(true);
      setAttempt((n) => n + 1);
    },
  };
}
