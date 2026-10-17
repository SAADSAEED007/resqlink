"use client";

import { useDashboard } from "./dashboard-context";
import { MetricCard } from "./MetricCard";
import { OperationsMap } from "./OperationsMap";
import { PriorityIncidentQueue } from "./PriorityIncidentQueue";
import { RescueTeamAvailability } from "./RescueTeamAvailability";
import { IncidentTrends } from "./IncidentTrends";
import { RecentActivity } from "./RecentActivity";
import { IncidentDetailModal } from "./IncidentDetailModal";
import { MOCK_TRENDS_24H } from "./mock-data";
import {
  RefreshCw,
  AlertOctagon,
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
    lastUpdated,
  } = useDashboard();

  return (
    <div className="space-y-4">
      <div className="rqCommandMode" role="status">
        <span>
          <strong>{isDemoMode ? "Demonstration Mode" : "API records"}</strong>{" "}
          &middot;{" "}
          {isDemoMode
            ? "Showing simulated emergency response data"
            : "Loaded API records / refreshes every 7 seconds"}
        </span>
        <div>
          <small>
            {!isDemoMode && lastUpdated
              ? `Updated ${new Date(lastUpdated).toLocaleTimeString()}`
              : ""}
          </small>
          <button onClick={() => setIsDemoMode(!isDemoMode)}>
            {isDemoMode ? "Connect to API" : "Use demo data"}
          </button>
          <button
            aria-label="Refresh data"
            title={isDemoMode ? "Demo data is a fixed snapshot" : "Refresh data"}
            disabled={isRefreshing || isDemoMode}
            onClick={() => void refresh()}
          >
            <RefreshCw
              size={16}
              className={isRefreshing ? "animate-spin" : ""}
            />
          </button>
        </div>
      </div>

      {/* Error State Banner if live API fails */}
      {error && !isDemoMode && (
        <div className="bg-[var(--command-red)]/10 border border-[var(--command-red)]/30 rounded-xl p-4 flex items-center justify-between gap-4 text-xs text-[var(--command-ink)]">
          <div className="flex items-center gap-2.5">
            <AlertOctagon className="w-5 h-5 text-[var(--command-red)] shrink-0" />
            <div>
              <p className="font-semibold text-[var(--command-red)]">
                Backend API Connection Unavailable
              </p>
              <p className="text-[var(--command-muted)]">{error}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => void refresh()}
              className="px-3 py-1.5 rounded-lg bg-[var(--command-soft)] hover:bg-[var(--command-soft)] text-xs font-medium text-[var(--command-ink)] transition-colors"
            >
              Try Again
            </button>
            <button
              onClick={() => setIsDemoMode(true)}
              className="px-3 py-1.5 rounded-lg bg-[var(--command-blue)] hover:bg-[#1D65D4] text-xs font-semibold text-white transition-colors"
            >
              Load Demo Data
            </button>
          </div>
        </div>
      )}

      {/* 1. TOP KPI METRICS GRID */}
      <section
        aria-label="Key Performance Indicators"
        className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4"
      >
        <MetricCard
          label="Active Incidents"
          value={stats.activeIncidents}
          trendText="Open reports"
          trendColor="red"
          iconSrc="/images/icons/kpi-active-incidents.webp"
          sparklinePoints={isDemoMode ? MOCK_TRENDS_24H.map(point => point.critical + point.high + point.medium + point.low) : undefined}
          sparklineColor="#ee354b"
          loading={loading && !isDemoMode}
        />

        <MetricCard
          label="Critical Cases"
          value={stats.criticalCases}
          trendText="Needs priority review"
          trendColor="amber"
          iconSrc="/images/icons/kpi-critical-cases.webp"
          sparklinePoints={isDemoMode ? MOCK_TRENDS_24H.map(point => point.critical) : undefined}
          sparklineColor="#f6bf69"
          loading={loading && !isDemoMode}
        />

        <MetricCard
          label="Available Teams"
          value={stats.availableTeams}
          secondaryValue={`/ ${stats.totalTeams}`}
          trendText={`${stats.busyTeams} teams on mission`}
          trendColor="muted"
          iconSrc="/images/icons/kpi-available-teams.webp"
          loading={loading && !isDemoMode}
        />

        <MetricCard
          label="Resolved Today"
          value={stats.resolvedToday}
          trendText="Resolved records updated today"
          trendColor="blue"
          iconSrc="/images/icons/kpi-resolved-today.webp"
          loading={loading && !isDemoMode}
        />
      </section>

      {/* 2. MIDDLE SECTION: OPERATIONS MAP + PRIORITY QUEUE */}
      <section
        aria-label="Operations Overview"
        className="grid grid-cols-1 lg:grid-cols-12 gap-4"
      >
        {/* Left: Operations Map (~68% width) */}
        <div className="lg:col-span-8 min-w-0">
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
        <div className="lg:col-span-4 min-w-0">
          <PriorityIncidentQueue
            incidents={filteredIncidents}
            selectedIncident={selectedIncident}
            onSelectIncident={(inc) => setSelectedIncident(inc)}
            loading={loading && !isDemoMode}
          />
        </div>
      </section>

      {/* 3. BOTTOM SECTION: RESCUE TEAMS + TRENDS + RECENT ACTIVITY */}
      <section
        aria-label="Operations Analytics and Activity"
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
      >
        <RescueTeamAvailability
          teams={filteredTeams}
          selectedTeam={selectedTeam}
          onSelectTeam={(team) => setSelectedTeam(team)}
          loading={loading && !isDemoMode}
        />

        {isDemoMode ? (
          <IncidentTrends loading={false} />
        ) : (
          <section className="rqCommandCard rqCommandEmpty">
            <h2>Incident Trends</h2>
            <p>Historical trend data is not available from the current API.</p>
          </section>
        )}

        {isDemoMode ? (
          <RecentActivity loading={false} />
        ) : (
          <section className="rqCommandCard rqCommandEmpty">
            <h2>Recent Activity &amp; Assignments</h2>
            <p>An activity feed is not available from the current API.</p>
          </section>
        )}
      </section>

      {selectedTeam && (
        <section className="rqCommandCard rqCommandTeamDetail">
          <div>
            <h2>{selectedTeam.name}</h2>
            <p>
              {selectedTeam.status} /{" "}
              {selectedTeam.capabilities.join(", ").replaceAll("_", " ")}
            </p>
            <p>
              {selectedTeam.location?.address || "Location not reported"} /
              Capacity: {selectedTeam.capacity ?? "Unknown"}
            </p>
            <small>Reported position only. No live GPS feed.</small>
          </div>
          <button onClick={() => setSelectedTeam(null)}>
            Close team details
          </button>
        </section>
      )}

      {/* Interactive Detail Modal */}
      <IncidentDetailModal
        incident={selectedIncident}
        onClose={() => setSelectedIncident(null)}
      />
    </div>
  );
}
