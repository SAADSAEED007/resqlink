"use client";

import { useEffect, useState } from "react";
import {
  Clock,
  ShieldCheck,
  AlertOctagon,
  Navigation,
  CheckCircle2,
  Camera,
} from "lucide-react";
import { MOCK_ACTIVITIES, type ActivityItem } from "./mock-data";
import { dashboard, type DashboardActivity } from "@/lib/api/dashboard";
import { errorMessage } from "@/lib/api/client";

interface RecentActivityProps {
  loading?: boolean;
  realData?: boolean;
  refreshAt?: number | null;
}

export function RecentActivity({ loading = false, realData = false, refreshAt = null }: RecentActivityProps) {
  const [records, setRecords] = useState<DashboardActivity[] | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!realData) return;
    const controller = new AbortController();
    void dashboard.activity(controller.signal).then((value) => { if (!controller.signal.aborted) { setRecords(value.items); setError(""); } }).catch((failure) => { if (!controller.signal.aborted) setError(errorMessage(failure)); });
    return () => controller.abort();
  }, [realData, refreshAt]);
  const activity: ActivityItem[] = realData ? (records || []).map((item): ActivityItem => ({
    id: item.id, timestamp: item.timestamp, title: item.title, subtitle: item.metadata?.incidentId ? `Incident ${item.metadata.incidentId.slice(-6)}` : "Operational record", timeAgo: relativeTime(item.timestamp),
    iconType: item.type === "TEAM_ASSIGNED" ? "assignment" : item.type === "ASSIGNMENT_COMPLETED" ? "completed" : item.type === "INCIDENT_RESOLVED" ? "resolved" : "alert",
    statusText: item.status || item.priority || "Recorded", statusTone: item.priority === "CRITICAL" ? "red" : item.type === "TEAM_ASSIGNED" ? "green" : "blue",
  })) : MOCK_ACTIVITIES;
  const getActivityIcon = (type: ActivityItem["iconType"]) => {
    switch (type) {
      case "assignment":
        return <ShieldCheck className="w-4 h-4 text-[var(--command-green)]" />;
      case "alert":
        return <AlertOctagon className="w-4 h-4 text-[var(--command-red)]" />;
      case "en_route":
        return <Navigation className="w-4 h-4 text-[var(--command-amber)]" />;
      case "resolved":
        return <CheckCircle2 className="w-4 h-4 text-[var(--command-blue)]" />;
      case "completed":
        return <Camera className="w-4 h-4 text-[#2DD4BF]" />;
    }
  };

  const getStatusBadge = (text: string, tone: ActivityItem["statusTone"]) => {
    const toneMap = {
      blue: "bg-[var(--command-blue)]/20 text-[var(--command-blue)] border-[var(--command-blue)]/40",
      red: "bg-[var(--command-red)]/20 text-[var(--command-red)] border-[var(--command-red)]/40",
      amber:
        "bg-[var(--command-amber)]/20 text-[var(--command-amber)] border-[var(--command-amber)]/40",
      green:
        "bg-[var(--command-green)]/20 text-[var(--command-green)] border-[var(--command-green)]/40",
      teal: "bg-[#0D9488]/20 text-[#2DD4BF] border-[#0D9488]/40",
    };

    return (
      <span
        className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${toneMap[tone]}`}
      >
        {text}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="bg-[var(--command-surface)] border border-[var(--command-border)] rounded-xl flex flex-col h-[280px] p-4 animate-pulse">
        <div className="h-5 w-44 bg-[var(--command-soft)] rounded mb-4" />
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-10 bg-[var(--command-soft)] rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[var(--command-surface)] border border-[var(--command-border)] rounded-xl flex flex-col h-[280px] overflow-hidden">
      {/* Header */}
      <div className="p-3 px-4 bg-[var(--command-soft)]/80 border-b border-[var(--command-border)] flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-[var(--command-blue)]" />
          <h2 className="text-sm font-semibold text-[var(--command-ink)] tracking-tight">
            Recent Activity &amp; Assignments
          </h2>
        </div>
        <span className="rqCommandDemoLabel">{realData ? "Real Data" : "Simulated activity"}</span>
      </div>

      {/* Activity Timeline List */}
      <div className="flex-1 overflow-y-auto p-2.5 space-y-2 custom-scrollbar">
        {error ? <p className="p-4 text-center text-xs text-[var(--command-muted)]">Unable to load real activity. {error}</p> : realData && records && !activity.length ? <p className="p-4 text-center text-xs text-[var(--command-muted)]">No recent recorded activity.</p> : activity.map((act) => (
          <div
            key={act.id}
            className="rqActivityRow p-2 px-2.5 rounded-lg bg-[var(--command-soft)]/50 hover:bg-[var(--command-soft)] border border-[var(--command-border)] transition-colors flex items-center justify-between gap-3"
          >
            {/* Left: Time + Icon */}
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="text-[10px] text-[var(--command-muted)] font-mono shrink-0 w-14 truncate">
                {act.timeAgo}
              </span>
              <div className="w-7 h-7 rounded-lg bg-[var(--command-ground)] border border-white/5 flex items-center justify-center shrink-0">
                {getActivityIcon(act.iconType)}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-medium text-[var(--command-ink)] truncate leading-tight">
                  {act.title}
                </p>
                <p className="text-[10px] text-[var(--command-muted)] truncate mt-0.5">
                  {act.subtitle}
                </p>
              </div>
            </div>

            {/* Right: Status Pill */}
            <div className="shrink-0">
              {getStatusBadge(act.statusText, act.statusTone)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function relativeTime(timestamp: string) {
  const minutes = Math.max(0, Math.round((Date.now() - new Date(timestamp).getTime()) / 60000));
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  return new Intl.DateTimeFormat("en-PK", { timeZone: "Asia/Karachi", month: "short", day: "numeric" }).format(new Date(timestamp));
}
