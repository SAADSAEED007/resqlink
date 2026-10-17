"use client";

import type { RescueTeam } from "@/types/api";
import {
  Users,
  ArrowRight,
  Truck,
  Ship,
  Activity,
  Plane,
  Shield,
  MapPin,
  Car,
} from "lucide-react";

interface RescueTeamAvailabilityProps {
  teams: RescueTeam[];
  selectedTeam: RescueTeam | null;
  onSelectTeam: (team: RescueTeam) => void;
  loading?: boolean;
}

export function RescueTeamAvailability({
  teams,
  selectedTeam,
  onSelectTeam,
  loading = false,
}: RescueTeamAvailabilityProps) {
  const getTeamIcon = (team: RescueTeam) => {
    const caps = team.capabilities || [];
    if (caps.includes("WATER_RESCUE")) return <Ship className="w-4 h-4 text-[#2378F6]" />;
    if (caps.includes("MEDICAL")) return <Activity className="w-4 h-4 text-[#F04452]" />;
    if (caps.includes("FIRE_RESPONSE")) return <Truck className="w-4 h-4 text-[#F5B942]" />;
    if (caps.includes("EVACUATION") && team.name.toLowerCase().includes("drone"))
      return <Plane className="w-4 h-4 text-[#18C785]" />;
    return <Shield className="w-4 h-4 text-[#18C785]" />;
  };

  const getCapabilityLabel = (team: RescueTeam) => {
    const caps = team.capabilities || [];
    if (caps.includes("WATER_RESCUE")) return "Flood Rescue";
    if (caps.includes("MEDICAL")) return "Medical Response";
    if (caps.includes("FIRE_RESPONSE")) return "Fire & Hazmat";
    if (team.name.toLowerCase().includes("delta")) return "Drone & Recon";
    if (caps.includes("EVACUATION")) return "Urban Search & Rescue";
    return caps[0] || "General Response";
  };

  const getStatusBadge = (status: string) => {
    if (status === "AVAILABLE") {
      return (
        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#18C785]/20 text-[#18C785] border border-[#18C785]/40">
          Available
        </span>
      );
    }
    if (status === "BUSY") {
      return (
        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#2378F6]/20 text-[#2378F6] border border-[#2378F6]/40">
          On Mission
        </span>
      );
    }
    return (
      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#91A8C2]/20 text-[#91A8C2] border border-[#91A8C2]/40">
        Offline
      </span>
    );
  };

  const getBaseLocation = (team: RescueTeam) => {
    if (team.location?.address) {
      const parts = team.location.address.split(",");
      return parts[0].replace("Station", "").replace("Emergency Hub", "").trim();
    }
    return "Karachi Central";
  };

  if (loading) {
    return (
      <div className="bg-[#0B1D33] border border-[#203650] rounded-xl flex flex-col h-[280px] p-4 animate-pulse">
        <div className="h-5 w-40 bg-[#122A45] rounded mb-4" />
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-12 bg-[#122A45] rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  // Display top 4 teams matching reference
  const displayTeams = teams.slice(0, 4);

  return (
    <div className="bg-[#0B1D33] border border-[#203650] rounded-xl flex flex-col h-[280px] overflow-hidden">
      {/* Header */}
      <div className="p-3 px-4 bg-[#07182B]/80 border-b border-[#203650] flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-[#18C785]" />
          <h2 className="text-sm font-semibold text-[#EAF3FF] tracking-tight">
            Rescue Team Availability
          </h2>
        </div>
        <button
          onClick={() => {
            if (teams.length > 0) onSelectTeam(teams[0]);
          }}
          className="text-xs font-medium text-[#2378F6] hover:text-[#5BA0F8] flex items-center gap-1 transition-colors"
        >
          <span>View All</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Team Rows */}
      <div className="flex-1 overflow-y-auto p-2.5 space-y-1.5 custom-scrollbar">
        {displayTeams.map((team) => {
          const isSelected = selectedTeam?._id === team._id;
          const capabilityLabel = getCapabilityLabel(team);
          const base = getBaseLocation(team);

          return (
            <div
              key={team._id}
              onClick={() => onSelectTeam(team)}
              className={`p-2 px-3 rounded-lg border transition-all cursor-pointer flex items-center justify-between gap-2 ${
                isSelected
                  ? "bg-[#122A45] border-[#18C785]"
                  : "bg-[#07182B]/50 hover:bg-[#10253F] border-[#1A314C]"
              }`}
            >
              {/* Left Icon & Info */}
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-[#061425] border border-white/5 flex items-center justify-center shrink-0">
                  {getTeamIcon(team)}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-[#EAF3FF] truncate">
                      {team.name}
                    </span>
                    <span className="text-[11px] text-[#91A8C2] truncate hidden sm:inline">
                      {capabilityLabel}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 text-[10px] text-[#627D98] mt-0.5">
                    <MapPin className="w-2.5 h-2.5" />
                    <span className="truncate">{base}</span>
                  </div>
                </div>
              </div>

              {/* Status and Capacity */}
              <div className="flex items-center gap-3 shrink-0">
                {getStatusBadge(team.status)}
                <div className="hidden sm:flex items-center gap-2 text-[11px] text-[#91A8C2] font-mono">
                  <span className="flex items-center gap-0.5" title="Crew members">
                    <Users className="w-3 h-3 text-[#627D98]" />
                    <span>{team.capacity || 4}</span>
                  </span>
                  <span className="flex items-center gap-0.5" title="Vehicles">
                    <Car className="w-3 h-3 text-[#627D98]" />
                    <span>{team.status === "BUSY" ? 2 : 1}</span>
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
