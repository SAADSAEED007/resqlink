"use client";

import type { RescueTeam } from "@/types/api";
import {
  Users,
  Truck,
  Ship,
  Activity,
  Plane,
  Shield,
  MapPin,
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
    if (caps.includes("WATER_RESCUE"))
      return <Ship className="w-4 h-4 text-[var(--command-blue)]" />;
    if (caps.includes("MEDICAL"))
      return <Activity className="w-4 h-4 text-[var(--command-red)]" />;
    if (caps.includes("FIRE_RESPONSE"))
      return <Truck className="w-4 h-4 text-[var(--command-amber)]" />;
    if (
      caps.includes("EVACUATION") &&
      team.name.toLowerCase().includes("drone")
    )
      return <Plane className="w-4 h-4 text-[var(--command-green)]" />;
    return <Shield className="w-4 h-4 text-[var(--command-green)]" />;
  };

  const getCapabilityLabel = (team: RescueTeam) => {
    const caps = team.capabilities || [];
    if (caps.includes("WATER_RESCUE")) return "Flood Rescue";
    if (caps.includes("MEDICAL")) return "Medical Response";
    if (caps.includes("FIRE_RESPONSE")) return "Fire & Hazmat";
    if (caps.includes("EVACUATION")) return "Urban Search & Rescue";
    return caps[0] || "General Response";
  };

  const getStatusBadge = (status: string) => {
    if (status === "AVAILABLE") {
      return (
        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[var(--command-green)]/20 text-[var(--command-green)] border border-[var(--command-green)]/40">
          Available
        </span>
      );
    }
    if (status === "BUSY") {
      return (
        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[var(--command-blue)]/20 text-[var(--command-blue)] border border-[var(--command-blue)]/40">
          On Mission
        </span>
      );
    }
    return (
      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[var(--command-muted)]/20 text-[var(--command-muted)] border border-[var(--command-muted)]/40">
        Offline
      </span>
    );
  };

  const getBaseLocation = (team: RescueTeam) => {
    if (team.location?.address) {
      const parts = team.location.address.split(",");
      return parts[0]
        .replace("Station", "")
        .replace("Emergency Hub", "")
        .trim();
    }
    return "Location not reported";
  };

  if (loading) {
    return (
      <div className="bg-[var(--command-surface)] border border-[var(--command-border)] rounded-xl flex flex-col h-[280px] p-4 animate-pulse">
        <div className="h-5 w-40 bg-[var(--command-soft)] rounded mb-4" />
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-12 bg-[var(--command-soft)] rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  // Display top 4 teams matching reference
  const displayTeams = teams;

  return (
    <div className="rqTeamRoster bg-[var(--command-surface)] border border-[var(--command-border)] rounded-xl flex flex-col h-[280px] overflow-hidden">
      {/* Header */}
      <div className="p-3 px-4 bg-[var(--command-soft)]/80 border-b border-[var(--command-border)] flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-[var(--command-green)]" />
          <h2 className="text-sm font-semibold text-[var(--command-ink)] tracking-tight">
            Rescue Team Availability
          </h2>
        </div>
        <span className="rqCommandDemoLabel">{teams.length} teams</span>
      </div>

      {/* Team Rows */}
      <div className="flex-1 overflow-y-auto p-2.5 space-y-1.5 custom-scrollbar">
        {teams.length === 0 && (
          <p className="rqCommandEmpty">No teams available in this view.</p>
        )}
        {displayTeams.map((team) => {
          const isSelected = selectedTeam?._id === team._id;
          const capabilityLabel = getCapabilityLabel(team);
          const base = getBaseLocation(team);

          return (
            <button
              key={team._id}
              data-status={team.status}
              onClick={() => onSelectTeam(team)}
              className={`w-full text-left p-2 px-3 rounded-lg border transition-all cursor-pointer flex items-center justify-between gap-2 ${
                isSelected
                  ? "bg-[var(--command-soft)] border-[var(--command-green)]"
                  : "bg-[var(--command-soft)]/50 hover:bg-[var(--command-soft)] border-[var(--command-border)]"
              }`}
            >
              {/* Left Icon & Info */}
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="rqTeamVisual w-8 h-8 rounded-lg bg-[var(--command-ground)] border border-white/5 flex items-center justify-center shrink-0">
                  {getTeamIcon(team)}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-[var(--command-ink)] truncate">
                      {team.name}
                    </span>
                    <span className="text-[11px] text-[var(--command-muted)] truncate hidden sm:inline">
                      {capabilityLabel}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 text-[10px] text-[var(--command-muted)] mt-0.5">
                    <MapPin className="w-2.5 h-2.5" />
                    <span className="truncate">{base}</span>
                  </div>
                </div>
              </div>

              {/* Status and Capacity */}
              <div className="flex items-center gap-3 shrink-0">
                {getStatusBadge(team.status)}
                <span className="text-[10px] text-[var(--command-muted)]">
                  Capacity {team.capacity ?? "unknown"}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
