"use client";

import { useDashboard } from "./dashboard-context";
import { MetricCard } from "./MetricCard";
import { OperationsMap } from "./OperationsMap";
import { PriorityIncidentQueue } from "./PriorityIncidentQueue";
import { RescueTeamAvailability } from "./RescueTeamAvailability";
import { IncidentTrends } from "./IncidentTrends";
import { RecentActivity } from "./RecentActivity";
import { IncidentDetailModal } from "./IncidentDetailModal";
import {
  Flame,
  AlertTriangle,
  Users,
  CheckCircle2,
  RefreshCw,
  AlertOctagon,
  Sparkles,
} from "lucide-react";

export function DashboardOverview() {
  const {
    filteredIncidents,
    filteredTeams,
    loading,
    error,
    isDemoMode,
    setIsDemoMode,
    selectedIncident,
    setSelectedIncident,
    selectedTeam,
    setSelectedTeam,
    refresh,
    isRefreshing,
    stats,
  } = useDashboard();

  // Sparkline mock trends matching screenshot
  const activeIncidentsPoints = [8, 9, 7, 10, 11, 9, 13, 12];
  const criticalCasesPoints = [2, 3, 2, 4, 3, 5, 4, 4];
  const availableTeamsPoints = [7, 7, 6, 6, 5, 6, 7, 6];
  const resolvedPoints = [10, 12, 13, 15, 14, 16, 17, 18];

  return (
    <div className="space-y-4">
      {/* Simulation / Demo Mode Banner if active */}
      {isDemoMode && (
        <div className="bg-[#122A45]/80 border border-[#2378F6]/30 rounded-xl px-4 py-2.5 flex items-center justify-between gap-3 text-xs text-[#EAF3FF] backdrop-blur-md">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-[#2378F6] shrink-0" />
            <span>
              <strong>Demonstration Mode:</strong> Displaying simulated Karachi flood response data. Realistic coordinates, teams, and priority queues are loaded for presentation.
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setIsDemoMode(false)}
              className="text-[11px] underline text-[#91A8C2] hover:text-[#EAF3FF]"
            >
              Switch to Live API
            </button>
            <button
              onClick={() => void refresh()}
              disabled={isRefreshing}
              className="p-1 rounded bg-[#07182B] hover:bg-[#10253F] text-[#91A8C2] hover:text-[#EAF3FF] transition-colors"
              title="Refresh Data"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>
      )}

      {/* Error State Banner if live API fails */}
      {error && !isDemoMode && (
        <div className="bg-[#F04452]/10 border border-[#F04452]/30 rounded-xl p-4 flex items-center justify-between gap-4 text-xs text-[#EAF3FF]">
          <div className="flex items-center gap-2.5">
            <AlertOctagon className="w-5 h-5 text-[#F04452] shrink-0" />
            <div>
              <p className="font-semibold text-[#F04452]">Backend API Connection Unavailable</p>
              <p className="text-[#91A8C2]">{error}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => void refresh()}
              className="px-3 py-1.5 rounded-lg bg-[#122A45] hover:bg-[#183659] text-xs font-medium text-[#EAF3FF] transition-colors"
            >
              Try Again
            </button>
            <button
              onClick={() => setIsDemoMode(true)}
              className="px-3 py-1.5 rounded-lg bg-[#2378F6] hover:bg-[#1D65D4] text-xs font-semibold text-white transition-colors"
            >
              Load Demo Data
            </button>
          </div>
        </div>
      )}

      {/* 1. TOP KPI METRICS GRID */}
      <section aria-label="Key Performance Indicators" className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3.5">
        <MetricCard
          label="Active Incidents"
          value={stats.activeIncidents}
          trendText="+33% vs. previous 24h"
          trendDirection="up"
          trendColor="red"
          icon={<Flame className="w-5 h-5 text-[#F04452]" />}
          iconBgColor="rgba(240, 68, 82, 0.15)"
          sparklinePoints={activeIncidentsPoints}
          sparklineColor="#F04452"
          loading={loading && !isDemoMode}
        />

        <MetricCard
          label="Critical Cases"
          value={stats.criticalCases}
          trendText="+2 requiring immediate response"
          trendDirection="up"
          trendColor="amber"
          icon={<AlertTriangle className="w-5 h-5 text-[#F5B942]" />}
          iconBgColor="rgba(245, 185, 66, 0.15)"
          sparklinePoints={criticalCasesPoints}
          sparklineColor="#F5B942"
          loading={loading && !isDemoMode}
        />

        <MetricCard
          label="Available Teams"
          value={stats.availableTeams}
          secondaryValue={`/ ${stats.totalTeams}`}
          trendText={`${stats.busyTeams} teams on mission`}
          trendColor="muted"
          icon={<Users className="w-5 h-5 text-[#18C785]" />}
          iconBgColor="rgba(24, 199, 133, 0.15)"
          sparklinePoints={availableTeamsPoints}
          sparklineColor="#18C785"
          loading={loading && !isDemoMode}
        />

        <MetricCard
          label="Resolved Today"
          value={stats.resolvedToday}
          trendText="+50% successfully closed"
          trendDirection="up"
          trendColor="blue"
          icon={<CheckCircle2 className="w-5 h-5 text-[#2378F6]" />}
          iconBgColor="rgba(35, 120, 246, 0.15)"
          sparklinePoints={resolvedPoints}
          sparklineColor="#2378F6"
          loading={loading && !isDemoMode}
        />
      </section>

      {/* 2. MIDDLE SECTION: OPERATIONS MAP + PRIORITY QUEUE */}
      <section aria-label="Operations Overview" className="grid grid-cols-1 lg:grid-cols-12 gap-3.5">
        {/* Left: Operations Map (~68% width) */}
        <div className="lg:col-span-8">
          <OperationsMap
            incidents={filteredIncidents}
            teams={filteredTeams}
            selectedIncident={selectedIncident}
            onSelectIncident={(inc) => setSelectedIncident(inc)}
            onSelectTeam={(team) => setSelectedTeam(team)}
            loading={loading && !isDemoMode}
          />
        </div>

        {/* Right: Priority Incident Queue (~32% width) */}
        <div className="lg:col-span-4">
          <PriorityIncidentQueue
            incidents={filteredIncidents}
            selectedIncident={selectedIncident}
            onSelectIncident={(inc) => setSelectedIncident(inc)}
            loading={loading && !isDemoMode}
          />
        </div>
      </section>

      {/* 3. BOTTOM SECTION: RESCUE TEAMS + TRENDS + RECENT ACTIVITY */}
      <section aria-label="Operations Analytics and Activity" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
        <RescueTeamAvailability
          teams={filteredTeams}
          selectedTeam={selectedTeam}
          onSelectTeam={(team) => setSelectedTeam(team)}
          loading={loading && !isDemoMode}
        />

        <IncidentTrends loading={loading && !isDemoMode} />

        <RecentActivity loading={loading && !isDemoMode} />
      </section>

      {/* Interactive Detail Modal */}
      <IncidentDetailModal
        incident={selectedIncident}
        onClose={() => setSelectedIncident(null)}
      />
    </div>
  );
}
