"use client";

import Image from "next/image";
import type { CSSProperties, ReactNode } from "react";

interface SparklineProps {
  color: string;
  points: number[];
}

function Sparkline({ color, points }: SparklineProps) {
  const width = 110;
  const height = 36;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;

  const coords = points.map((val, idx) => {
    const x = (idx / (points.length - 1)) * width;
    const y = height - ((val - min) / range) * (height - 8) - 4;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  const pathD = `M ${coords.join(" L ")}`;

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      fill="none"
      aria-hidden="true"
      className="overflow-visible shrink-0"
    >
      <defs>
        <linearGradient
          id={`grad-${color.replace("#", "")}`}
          x1="0"
          y1="0"
          x2="0"
          y2="1"
        >
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0.0" />
        </linearGradient>
      </defs>
      <path
        d={`${pathD} L ${width},${height} L 0,${height} Z`}
        fill={`url(#grad-${color.replace("#", "")})`}
      />
      <path
        d={pathD}
        stroke={color}
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export interface MetricCardProps {
  label: string;
  value: string | number;
  secondaryValue?: string;
  trendText?: string;
  trendDirection?: "up" | "down" | "neutral";
  trendColor?: "red" | "amber" | "green" | "blue" | "muted";
  icon?: ReactNode;
  iconSrc?: string;
  iconBgColor?: string;
  sparklinePoints?: number[];
  sparklineColor?: string;
  loading?: boolean;
}

export function MetricCard({
  label,
  value,
  secondaryValue,
  trendText,
  trendDirection,
  trendColor = "muted",
  icon,
  iconSrc,
  iconBgColor = "rgba(35, 120, 246, 0.15)",
  sparklinePoints,
  sparklineColor = "var(--command-blue)",
  loading = false,
}: MetricCardProps) {
  const trendClasses: Record<string, string> = {
    red: "text-[var(--command-red)]",
    amber: "text-[var(--command-amber)]",
    green: "text-[var(--command-green)]",
    blue: "text-[var(--command-blue)]",
    muted: "text-[var(--command-muted)]",
  };

  if (loading) {
    return (
      <div className="bg-[var(--command-surface)] border border-[var(--command-border)] rounded-xl p-4 min-h-[110px] animate-pulse">
        <div className="flex items-center justify-between">
          <div className="h-4 w-28 bg-[var(--command-soft)] rounded" />
          <div className="w-10 h-10 rounded-lg bg-[var(--command-soft)]" />
        </div>
        <div className="mt-3 h-8 w-16 bg-[var(--command-soft)] rounded" />
        <div className="mt-2 h-3 w-36 bg-[var(--command-soft)] rounded" />
      </div>
    );
  }

  return (
    <div style={{ "--metric-accent": `var(--command-${label === "Available Teams" ? "green" : trendColor === "muted" ? "blue" : trendColor})` } as CSSProperties} className="rqCommandMetric bg-[var(--command-surface)] border border-[var(--command-border)] hover:border-[var(--command-blue)] transition-colors rounded-xl p-3.5 px-4 flex items-center justify-between gap-2 shadow-sm relative overflow-hidden group">
      <div className="flex items-center gap-3 min-w-0 flex-1">
        {iconSrc ? (
          <div
            className="w-12 h-12 sm:w-[52px] sm:h-[52px] xl:w-[56px] xl:h-[56px] shrink-0 flex items-center justify-center relative select-none"
            aria-hidden="true"
          >
            <Image
              src={iconSrc}
              alt=""
              width={56}
              height={56}
              priority
              className="w-full h-full object-contain filter drop-shadow-[0_4px_12px_rgba(0,0,0,0.18)] group-hover:scale-105 transition-transform duration-200 motion-reduce:transform-none"
            />
          </div>
        ) : (
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0 border border-white/5"
            style={{ background: iconBgColor }}
            aria-hidden="true"
          >
            {icon}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold tracking-wider uppercase text-[var(--command-muted)] whitespace-nowrap">
            {label}
          </p>
          <div className="flex items-baseline gap-1 mt-0.5">
            <span className="text-2xl font-extrabold tracking-tight text-[var(--command-ink)] font-sans">
              {value}
            </span>
            {secondaryValue && (
              <span className="text-sm font-semibold text-[var(--command-muted)]">
                {secondaryValue}
              </span>
            )}
          </div>
          {trendText && (
            <p
              className={`text-[10px] font-medium mt-0.5 flex items-center gap-0.5 whitespace-nowrap ${trendClasses[trendColor]}`}
            >
              {trendDirection === "up" && (
                <span className="font-bold">&uarr;</span>
              )}
              {trendDirection === "down" && (
                <span className="font-bold">&darr;</span>
              )}
              <span>{trendText}</span>
            </p>
          )}
        </div>
      </div>

      {sparklinePoints && (
        <div className="rqMetricSparkline hidden sm:block shrink-0" aria-label="Simulated trend">
          <Sparkline color={sparklineColor} points={sparklinePoints} />
          <small>Simulated</small>
        </div>
      )}
    </div>
  );
}
