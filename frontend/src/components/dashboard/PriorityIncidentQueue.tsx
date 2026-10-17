"use client";

import { useState } from "react";
import type { Incident } from "@/types/api";
import { ListFilter, MapPin, Clock, ArrowRight, AlertCircle } from "lucide-react";
import Image from "next/image";

interface PriorityIncidentQueueProps {
  incidents: Incident[];
  selectedIncident: Incident | null;
  onSelectIncident: (inc: Incident) => void;
  loading?: boolean;
}

function ConfidenceRing({
  percentage,
  tone,
}: {
  percentage: number;
  tone: "red" | "amber" | "yellow" | "blue";
}) {
  const radius = 17;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  const strokeColors = {
    red: "#F04452",
    amber: "#F5B942",
    yellow: "#EAB308",
    blue: "#2378F6",
  };

  return (
    <div className="flex flex-col items-center justify-center shrink-0">
      <div className="relative w-11 h-11 flex items-center justify-center">
        <svg className="w-11 h-11 -rotate-90" viewBox="0 0 42 42">
          <circle
            cx="21"
            cy="21"
            r={radius}
            stroke="#122A45"
            strokeWidth="3"
            fill="transparent"
          />
          <circle
            cx="21"
            cy="21"
            r={radius}
            stroke={strokeColors[tone]}
            strokeWidth="3.5"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            fill="transparent"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-[10px] font-bold text-[#EAF3FF] font-sans">
            {percentage}%
          </span>
        </div>
      </div>
      <span className="text-[8px] font-medium text-[#91A8C2] uppercase tracking-tight mt-0.5">
        AI Confidence
      </span>
    </div>
  );
}

export function PriorityIncidentQueue({
  incidents,
  selectedIncident,
  onSelectIncident,
  loading = false,
}: PriorityIncidentQueueProps) {
  // Sort Critical > High > Medium > Low
  const priorityWeight = {
    CRITICAL: 4,
    HIGH: 3,
    MEDIUM: 2,
    LOW: 1,
  };

  const sorted = [...incidents].sort(
    (a, b) =>
      (priorityWeight[b.priorityLevel] || 0) -
        (priorityWeight[a.priorityLevel] || 0) ||
      b.priorityScore - a.priorityScore,
  );

  const getThumbnail = (inc: Incident, idx: number) => {
    if (inc.emergencyType === "FLOOD") return "/images/incidents/urban-flooding.jpg";
    if (inc.emergencyType === "STRANDED") return "/images/incidents/building-collapse.jpg";
    if (inc.emergencyType === "OTHER") return "/images/incidents/fallen-tree.jpg";
    if (idx % 2 === 0) return "/images/incidents/water-logging.jpg";
    return "/images/incidents/urban-flooding.jpg";
  };

  const getConfidencePercentage = (inc: Incident) => {
    if (inc.priorityScore) return inc.priorityScore;
    if (inc.confidenceLevel === "HIGH") return 92;
    if (inc.confidenceLevel === "MEDIUM") return 74;
    return 58;
  };

  const getPriorityTone = (priority: string): "red" | "amber" | "yellow" | "blue" => {
    switch (priority) {
      case "CRITICAL":
        return "red";
      case "HIGH":
        return "amber";
      case "MEDIUM":
        return "yellow";
      default:
        return "blue";
    }
  };

  const getBadgeClasses = (priority: string) => {
    switch (priority) {
      case "CRITICAL":
        return "bg-[#F04452]/20 text-[#F04452] border border-[#F04452]/40";
      case "HIGH":
        return "bg-[#F5B942]/20 text-[#F5B942] border border-[#F5B942]/40";
      case "MEDIUM":
        return "bg-[#EAB308]/20 text-[#EAB308] border border-[#EAB308]/40";
      default:
        return "bg-[#2378F6]/20 text-[#2378F6] border border-[#2378F6]/40";
    }
  };

  const [now] = useState(() => Date.now());

  const getTimeAgo = (dateStr: string) => {
    const diff = now - new Date(dateStr).getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return "Just now";
    if (minutes < 60) return `${minutes} min ago`;
    const hours = Math.floor(minutes / 60);
    if (hours === 1) return "1 hour ago";
    if (hours < 24) return `${hours} hours ago`;
    return `${Math.floor(hours / 24)}d ago`;
  };

  const getDisplayTitle = (inc: Incident) => {
    if (inc.emergencyType === "FLOOD" && inc.priorityLevel === "CRITICAL")
      return "Severe Urban Flooding";
    if (inc.emergencyType === "STRANDED") return "Building Structure Collapse";
    if (inc.emergencyType === "OTHER") return "Road Blockage (Fallen Tree)";
    if (inc.priorityLevel === "LOW") return "Water Logging";
    return `${inc.emergencyType} Incident`;
  };

  if (loading) {
    return (
      <div className="bg-[#0B1D33] border border-[#203650] rounded-xl flex flex-col h-[440px] lg:h-[480px] p-4 animate-pulse">
        <div className="h-5 w-48 bg-[#122A45] rounded mb-4" />
        <div className="space-y-3 flex-1">
          {[1, 2, 3, 4].map((n) => (
            <div key={n} className="h-20 bg-[#122A45] rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#0B1D33] border border-[#203650] rounded-xl flex flex-col h-[440px] lg:h-[480px] overflow-hidden">
      {/* Header */}
      <div className="p-3.5 px-4 bg-[#07182B]/80 border-b border-[#203650] flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <ListFilter className="w-4 h-4 text-[#2378F6]" />
          <h2 className="text-sm font-semibold text-[#EAF3FF] tracking-tight">
            Priority Incident Queue
          </h2>
          <span className="text-[11px] font-medium text-[#91A8C2] bg-[#122A45] px-1.5 py-0.5 rounded-full">
            {sorted.length}
          </span>
        </div>
        <button
          onClick={() => {
            if (sorted.length > 0) onSelectIncident(sorted[0]);
          }}
          className="text-xs font-medium text-[#2378F6] hover:text-[#5BA0F8] flex items-center gap-1 transition-colors"
        >
          <span>View All</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Incident List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2.5 custom-scrollbar">
        {sorted.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 text-[#91A8C2]">
            <AlertCircle className="w-8 h-8 mb-2 opacity-40" />
            <p className="text-xs">No incidents match current filter.</p>
          </div>
        ) : (
          sorted.map((inc, idx) => {
            const isSelected = selectedIncident?._id === inc._id;
            const tone = getPriorityTone(inc.priorityLevel);
            const percentage = getConfidencePercentage(inc);
            const title = getDisplayTitle(inc);
            const timeAgo = getTimeAgo(inc.createdAt);
            const thumb = getThumbnail(inc, idx);

            return (
              <div
                key={inc._id}
                onClick={() => onSelectIncident(inc)}
                className={`p-2.5 rounded-lg border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                  isSelected
                    ? "bg-[#122A45] border-[#2378F6] shadow-md shadow-[#2378F6]/10"
                    : "bg-[#07182B]/60 hover:bg-[#10253F] border-[#1C334E]"
                }`}
              >
                {/* Left Thumbnail */}
                <div className="relative w-16 h-16 rounded-md overflow-hidden bg-[#061425] shrink-0 border border-white/5">
                  <Image
                    src={thumb}
                    alt={title}
                    fill
                    sizes="64px"
                    className="object-cover"
                  />
                </div>

                {/* Center Content */}
                <div className="flex-1 min-w-0 pr-1">
                  <div className="flex items-center gap-1.5 mb-1">
                    <span
                      className={`text-[9px] font-bold px-1.5 py-0.5 rounded tracking-wider uppercase ${getBadgeClasses(
                        inc.priorityLevel,
                      )}`}
                    >
                      {inc.priorityLevel}
                    </span>
                  </div>
                  <h3 className="text-xs font-semibold text-[#EAF3FF] truncate leading-tight">
                    {title}
                  </h3>
                  <div className="flex items-center gap-2 mt-1 text-[11px] text-[#91A8C2]">
                    <span className="flex items-center gap-1 truncate max-w-[120px] sm:max-w-[140px]">
                      <MapPin className="w-3 h-3 text-[#627D98] shrink-0" />
                      <span className="truncate">
                        {inc.location?.address || "Location unverified"}
                      </span>
                    </span>
                    <span>&bull;</span>
                    <span className="flex items-center gap-1 shrink-0">
                      <Clock className="w-3 h-3 text-[#627D98]" />
                      <span>{timeAgo}</span>
                    </span>
                  </div>
                </div>

                {/* Right Confidence Ring */}
                <div className="shrink-0 pl-1 border-l border-[#162B42]">
                  <ConfidenceRing percentage={percentage} tone={tone} />
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
