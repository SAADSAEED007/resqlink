import { Cloud, CloudRain, CloudSun, Sun, Wind } from "lucide-react";
import type { AttentionLevel } from "@/types/risk-zones";
export const attentionLabels: Record<AttentionLevel, string> = {
  ROUTINE: "Routine",
  ELEVATED: "Elevated",
  URGENT_REVIEW: "Urgent Review",
  DATA_UNAVAILABLE: "Data Unavailable",
};
export const date = (value?: string | null) =>
  value
    ? new Date(value).toLocaleString("en-PK", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "Asia/Karachi",
      })
    : "Not retrieved";
export const human = (value: string) =>
  value
    .toLowerCase()
    .replaceAll("_", " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
export function Attention({ level }: { level: AttentionLevel }) {
  return (
    <span className={`siBadge ${level.toLowerCase()}`}>
      {attentionLabels[level]}
    </span>
  );
}
export function WeatherIcon({
  code,
  size = 30,
}: {
  code?: number;
  size?: number;
}) {
  const Icon =
    code === undefined
      ? Wind
      : code === 0
        ? Sun
        : code < 3
          ? CloudSun
          : code < 50
            ? Cloud
            : CloudRain;
  return <Icon size={size} aria-hidden="true" />;
}
