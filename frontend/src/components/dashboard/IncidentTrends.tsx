"use client";

import { useState } from "react";
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

interface IncidentTrendsProps {
  loading?: boolean;
}

export function IncidentTrends({ loading = false }: IncidentTrendsProps) {
  const [range, setRange] = useState<"24h" | "7d" | "30d">("24h");

  const data: TrendDataPoint[] =
    range === "24h"
      ? MOCK_TRENDS_24H
      : range === "7d"
        ? MOCK_TRENDS_7D
        : MOCK_TRENDS_30D;

  if (loading) {
    return (
      <div className="bg-[#0B1D33] border border-[#203650] rounded-xl flex flex-col h-[280px] p-4 animate-pulse">
        <div className="flex justify-between items-center mb-4">
          <div className="h-5 w-32 bg-[#122A45] rounded" />
          <div className="h-6 w-24 bg-[#122A45] rounded" />
        </div>
        <div className="flex-1 bg-[#122A45] rounded-lg" />
      </div>
    );
  }

  return (
    <div className="bg-[#0B1D33] border border-[#203650] rounded-xl flex flex-col h-[280px] overflow-hidden">
      {/* Header */}
      <div className="p-3 px-4 bg-[#07182B]/80 border-b border-[#203650] flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-[#2378F6]" />
          <h2 className="text-sm font-semibold text-[#EAF3FF] tracking-tight">
            Incident Trends
          </h2>
        </div>

        {/* Range Buttons */}
        <div className="flex items-center bg-[#061425] p-0.5 rounded-lg border border-[#203650] text-[11px]">
          {(["24h", "7d", "30d"] as const).map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`px-2.5 py-0.5 rounded-md font-medium transition-all ${
                range === r
                  ? "bg-[#2378F6] text-white shadow-sm"
                  : "text-[#91A8C2] hover:text-[#EAF3FF]"
              }`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      {/* Chart Canvas */}
      <div className="flex-1 p-2 pt-3 flex flex-col justify-between">
        <div className="w-full h-[175px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 5, right: 10, left: -25, bottom: 0 }}>
              <defs>
                <linearGradient id="colorCritical" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#F04452" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#F04452" stopOpacity={0.0} />
                </linearGradient>
                <linearGradient id="colorHigh" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#F5B942" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#F5B942" stopOpacity={0.0} />
                </linearGradient>
                <linearGradient id="colorMedium" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#EAB308" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#EAB308" stopOpacity={0.0} />
                </linearGradient>
                <linearGradient id="colorLow" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#2378F6" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#2378F6" stopOpacity={0.0} />
                </linearGradient>
              </defs>

              <CartesianGrid strokeDasharray="3 3" stroke="#162B42" vertical={false} />

              <XAxis
                dataKey="time"
                stroke="#627D98"
                fontSize={10}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                stroke="#627D98"
                fontSize={10}
                tickLine={false}
                axisLine={false}
                domain={[0, "auto"]}
              />

              <Tooltip
                content={({ active, payload, label }) => {
                  if (active && payload && payload.length) {
                    return (
                      <div className="bg-[#07182B] border border-[#203650] rounded-lg p-2.5 shadow-xl text-xs space-y-1 z-30">
                        <div className="font-semibold text-[#EAF3FF] mb-1.5 pb-1 border-b border-[#162B42]">
                          {label}
                        </div>
                        {payload.map((entry) => (
                          <div
                            key={entry.name}
                            className="flex items-center justify-between gap-3 text-[11px]"
                          >
                            <span className="flex items-center gap-1.5 text-[#91A8C2]">
                              <span
                                className="w-2 h-2 rounded-full"
                                style={{ backgroundColor: entry.color }}
                              />
                              <span className="capitalize">{entry.name}</span>
                            </span>
                            <span className="font-mono font-bold text-[#EAF3FF]">
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
                type="monotone"
                dataKey="critical"
                name="Critical"
                stroke="#F04452"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#colorCritical)"
              />
              <Area
                type="monotone"
                dataKey="high"
                name="High"
                stroke="#F5B942"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#colorHigh)"
              />
              <Area
                type="monotone"
                dataKey="medium"
                name="Medium"
                stroke="#EAB308"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#colorMedium)"
              />
              <Area
                type="monotone"
                dataKey="low"
                name="Low"
                stroke="#2378F6"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#colorLow)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Legend */}
        <div className="flex items-center justify-center gap-4 text-[10px] text-[#91A8C2] pb-1 pt-1 border-t border-[#162B42]">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[#F04452]" />
            <span>Critical</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[#F5B942]" />
            <span>High</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[#EAB308]" />
            <span>Medium</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[#2378F6]" />
            <span>Low</span>
          </div>
        </div>
      </div>
    </div>
  );
}
