"use client";

import {
  Clock,
  ArrowRight,
  ShieldCheck,
  AlertOctagon,
  Navigation,
  CheckCircle2,
  Camera,
} from "lucide-react";
import { MOCK_ACTIVITIES, type ActivityItem } from "./mock-data";

interface RecentActivityProps {
  loading?: boolean;
}

export function RecentActivity({ loading = false }: RecentActivityProps) {
  const getActivityIcon = (type: ActivityItem["iconType"]) => {
    switch (type) {
      case "assignment":
        return <ShieldCheck className="w-4 h-4 text-[#18C785]" />;
      case "alert":
        return <AlertOctagon className="w-4 h-4 text-[#F04452]" />;
      case "en_route":
        return <Navigation className="w-4 h-4 text-[#F5B942]" />;
      case "resolved":
        return <CheckCircle2 className="w-4 h-4 text-[#2378F6]" />;
      case "completed":
        return <Camera className="w-4 h-4 text-[#2DD4BF]" />;
    }
  };

  const getStatusBadge = (text: string, tone: ActivityItem["statusTone"]) => {
    const toneMap = {
      blue: "bg-[#2378F6]/20 text-[#2378F6] border-[#2378F6]/40",
      red: "bg-[#F04452]/20 text-[#F04452] border-[#F04452]/40",
      amber: "bg-[#F5B942]/20 text-[#F5B942] border-[#F5B942]/40",
      green: "bg-[#18C785]/20 text-[#18C785] border-[#18C785]/40",
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
      <div className="bg-[#0B1D33] border border-[#203650] rounded-xl flex flex-col h-[280px] p-4 animate-pulse">
        <div className="h-5 w-44 bg-[#122A45] rounded mb-4" />
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-10 bg-[#122A45] rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#0B1D33] border border-[#203650] rounded-xl flex flex-col h-[280px] overflow-hidden">
      {/* Header */}
      <div className="p-3 px-4 bg-[#07182B]/80 border-b border-[#203650] flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-[#2378F6]" />
          <h2 className="text-sm font-semibold text-[#EAF3FF] tracking-tight">
            Recent Activity &amp; Assignments
          </h2>
        </div>
        <button className="text-xs font-medium text-[#2378F6] hover:text-[#5BA0F8] flex items-center gap-1 transition-colors">
          <span>View All</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Activity Timeline List */}
      <div className="flex-1 overflow-y-auto p-2.5 space-y-2 custom-scrollbar">
        {MOCK_ACTIVITIES.map((act) => (
          <div
            key={act.id}
            className="p-2 px-2.5 rounded-lg bg-[#07182B]/50 hover:bg-[#10253F] border border-[#1A314C] transition-colors flex items-center justify-between gap-3"
          >
            {/* Left: Time + Icon */}
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="text-[10px] text-[#627D98] font-mono shrink-0 w-14 truncate">
                {act.timeAgo}
              </span>
              <div className="w-7 h-7 rounded-lg bg-[#061425] border border-white/5 flex items-center justify-center shrink-0">
                {getActivityIcon(act.iconType)}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-medium text-[#EAF3FF] truncate leading-tight">
                  {act.title}
                </p>
                <p className="text-[10px] text-[#91A8C2] truncate mt-0.5">
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
