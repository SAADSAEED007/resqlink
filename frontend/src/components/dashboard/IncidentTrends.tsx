"use client";

import { useEffect, useState } from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { TrendingUp } from "lucide-react";
import {
  MOCK_TRENDS_24H,
  MOCK_TRENDS_7D,
  MOCK_TRENDS_30D,
  type TrendDataPoint,
} from "./mock-data";
import { dashboard, type DashboardTrendPoint } from "@/lib/api/dashboard";
import { errorMessage } from "@/lib/api/client";

interface IncidentTrendsProps {
  loading?: boolean;
  realData?: boolean;
  refreshAt?: number | null;
}

export function IncidentTrends({ loading = false, realData = false, refreshAt = null }: IncidentTrendsProps) {
  const [range, setRange] = useState<"24h" | "7d" | "30d">("24h");
  const [realTrends, setRealTrends] = useState<{ last24Hours: DashboardTrendPoint[]; last7Days: DashboardTrendPoint[]; last30Days?: DashboardTrendPoint[] } | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!realData) return;
    const controller = new AbortController();
    void dashboard.summary(controller.signal).then((value) => { if (!controller.signal.aborted) { setRealTrends(value.trends); setError(""); } }).catch((failure) => { if (!controller.signal.aborted) setError(errorMessage(failure)); });
    return () => controller.abort();
  }, [realData, refreshAt]);

  const demoData: TrendDataPoint[] = range === "24h"
      ? MOCK_TRENDS_24H
      : range === "7d"
        ? MOCK_TRENDS_7D
        : MOCK_TRENDS_30D;
  const realPoints = range === "24h" ? realTrends?.last24Hours : range === "7d" ? realTrends?.last7Days : realTrends?.last30Days;
  const data: TrendDataPoint[] = realData
    ? (realPoints || []).map((point) => ({ time: point.label, critical: point.criticalCount, high: point.highCount || 0, medium: point.mediumCount || 0, low: point.lowCount || 0 }))
    : demoData;

  if (loading) {
    return (
      <div className="bg-[var(--command-surface)] border border-[var(--command-border)] rounded-xl flex flex-col h-[280px] p-4 animate-pulse">
        <div className="flex justify-between items-center mb-4">
          <div className="h-5 w-32 bg-[var(--command-soft)] rounded" />
          <div className="h-6 w-24 bg-[var(--command-soft)] rounded" />
        </div>
        <div className="flex-1 bg-[var(--command-soft)] rounded-lg" />
      </div>
    );
  }

  return (
    <div className="bg-[var(--command-surface)] border border-[var(--command-border)] rounded-xl flex flex-col h-[280px] overflow-hidden">
      {/* Header */}
      <div className="p-3 px-4 bg-[var(--command-soft)]/80 border-b border-[var(--command-border)] flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-[var(--command-blue)]" />
          <h2 className="text-sm font-semibold text-[var(--command-ink)] tracking-tight">
            Incident Trends <span className="rqCommandDemoLabel">{realData ? "Real Data" : "Demo"}</span>
          </h2>
        </div>

        {/* Range Buttons */}
        <div className="flex items-center bg-[var(--command-ground)] p-0.5 rounded-lg border border-[var(--command-border)] text-[11px]">
          {(["24h", "7d", "30d"] as const).map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`px-2.5 py-0.5 rounded-md font-medium transition-all ${
                range === r
                  ? "bg-[var(--command-blue)] text-white shadow-sm"
                  : "text-[var(--command-muted)] hover:text-[var(--command-ink)]"
              }`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      {error ? <div className="flex-1 grid place-items-center p-5 text-center text-xs text-[var(--command-muted)]">Unable to load real incident trends. {error}</div> : realData && realTrends && !data.some((point) => point.critical + point.high + point.medium + point.low > 0) ? <div className="flex-1 grid place-items-center p-5 text-center"><div><strong className="text-sm text-[var(--command-ink)]">No incidents reported in this period</strong><p className="mt-1 text-xs text-[var(--command-muted)]">Try selecting a longer time range.</p></div></div> :
      <>
      {/* Chart Canvas */}
      <div className="flex-1 p-2 pt-3 flex flex-col justify-between">
        <div className="w-full h-[175px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={data}
              margin={{ top: 5, right: 10, left: -25, bottom: 0 }}
            >
              <defs>
                <linearGradient id="colorCritical" x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="5%"
                    stopColor="var(--command-red)"
                    stopOpacity={0.4}
                  />
                  <stop
                    offset="95%"
                    stopColor="var(--command-red)"
                    stopOpacity={0.0}
                  />
                </linearGradient>
                <linearGradient id="colorHigh" x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="5%"
                    stopColor="var(--command-amber)"
                    stopOpacity={0.3}
                  />
                  <stop
                    offset="95%"
                    stopColor="var(--command-amber)"
                    stopOpacity={0.0}
                  />
                </linearGradient>
                <linearGradient id="colorMedium" x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="5%"
                    stopColor="var(--command-blue)"
                    stopOpacity={0.25}
                  />
                  <stop
                    offset="95%"
                    stopColor="var(--command-blue)"
                    stopOpacity={0.0}
                  />
                </linearGradient>
                <linearGradient id="colorLow" x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="5%"
                    stopColor="var(--command-blue)"
                    stopOpacity={0.2}
                  />
                  <stop
                    offset="95%"
                    stopColor="var(--command-blue)"
                    stopOpacity={0.0}
                  />
                </linearGradient>
              </defs>

              <CartesianGrid
                strokeDasharray="3 3"
                stroke="var(--command-border)"
                vertical={false}
              />

              <XAxis
                dataKey="time"
                stroke="var(--command-muted)"
                fontSize={10}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                stroke="var(--command-muted)"
                fontSize={10}
                tickLine={false}
                axisLine={false}
                domain={[0, "auto"]}
              />

              <Tooltip
                content={({ active, payload, label }) => {
                  if (active && payload && payload.length) {
                    return (
                      <div className="bg-[var(--command-soft)] border border-[var(--command-border)] rounded-lg p-2.5 shadow-xl text-xs space-y-1 z-30">
                        <div className="font-semibold text-[var(--command-ink)] mb-1.5 pb-1 border-b border-[var(--command-border)]">
                          {label}
                        </div>
                        {payload.map((entry) => (
                          <div
                            key={entry.name}
                            className="flex items-center justify-between gap-3 text-[11px]"
                          >
                            <span className="flex items-center gap-1.5 text-[var(--command-muted)]">
                              <span
                                className="w-2 h-2 rounded-full"
                                style={{ backgroundColor: entry.color }}
                              />
                              <span className="capitalize">{entry.name}</span>
                            </span>
                            <span className="font-mono font-bold text-[var(--command-ink)]">
                              {entry.value}
                            </span>
                          </div>
                        ))}
                      </div>
                    );
                  }
                  return null;
                }}
              />

              <Area
                isAnimationActive={false}
                type="monotone"
                dataKey="critical"
                name="Critical"
                stroke="var(--command-red)"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#colorCritical)"
              />
              <Area
                isAnimationActive={false}
                type="monotone"
                dataKey="high"
                name="High"
                stroke="var(--command-amber)"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#colorHigh)"
              />
              <Area
                isAnimationActive={false}
                type="monotone"
                dataKey="medium"
                name="Medium"
                stroke="var(--command-blue)"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#colorMedium)"
              />
              <Area
                isAnimationActive={false}
                type="monotone"
                dataKey="low"
                name="Low"
                stroke="var(--command-muted)"
                strokeWidth={2}
                fillOpacity={1}
                fill="none"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Legend */}
        <div className="flex items-center justify-center gap-4 text-[10px] text-[var(--command-muted)] pb-1 pt-1 border-t border-[var(--command-border)]">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[var(--command-red)]" />
            <span>Critical</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[var(--command-amber)]" />
            <span>High</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[var(--command-blue)]" />
            <span>Medium</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[var(--command-muted)]" />
            <span>Low</span>
          </div>
        </div>
      </div></>}
    </div>
  );
}
