"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
  type ReactNode,
} from "react";
import { applyDemoAction, createDemoEnvironment, type DemoAction, type DemoEnvironment } from "./demo-environment";
import type { Incident, RescueTeam, Assignment } from "@/types/api";
import { incidents as incidentsApi } from "@/lib/api/incidents";
import { teams as teamsApi } from "@/lib/api/teams";
import { assignments as assignmentsApi } from "@/lib/api/assignments";
import { errorMessage } from "@/lib/api/client";
import {
  MOCK_INCIDENTS,
  MOCK_RESCUE_TEAMS,
  MOCK_ASSIGNMENTS,
} from "./mock-data";

export interface DashboardStats {
  activeIncidents: number;
  criticalCases: number;
  availableTeams: number;
  totalTeams: number;
  busyTeams: number;
  resolvedToday: number;
}

interface DashboardContextType {
  incidents: Incident[];
  teams: RescueTeam[];
  assignments: Assignment[];
  loading: boolean;
  error: string | null;
  isDemoMode: boolean;
  setIsDemoMode: (val: boolean) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  selectedIncident: Incident | null;
  setSelectedIncident: (incident: Incident | null) => void;
  selectedTeam: RescueTeam | null;
  setSelectedTeam: (team: RescueTeam | null) => void;
  refresh: () => Promise<void>;
  isRefreshing: boolean;
  lastUpdated: number | null;
  filteredIncidents: Incident[];
  filteredTeams: RescueTeam[];
  stats: DashboardStats;
  demo: DemoEnvironment;
  demoAction: (action: DemoAction) => { _id: string };
}

const DashboardContext = createContext<DashboardContextType | null>(null);

export function DashboardProvider({ children }: { children: ReactNode }) {
  const [demo, setDemo] = useState(createDemoEnvironment);
  const demoRef = useRef(demo);
  const [liveIncidents, setLiveIncidents] = useState<Incident[]>([]);
  const [liveTeams, setLiveTeams] = useState<RescueTeam[]>([]);
  const [liveAssignments, setLiveAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Demo mode is the intentional fresh-session default for judge demonstrations.
  // The query parameter remains available for explicit links and testing.
  const [isDemoMode, setMode] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (params.get("demo") === "false") return false;
      if (params.get("demo") === "true") return true;
    }
    return true;
  });
  const modeRef = useRef(isDemoMode);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(
    null,
  );
  const [selectedTeam, setSelectedTeam] = useState<RescueTeam | null>(null);

  const setIsDemoMode = useCallback((value: boolean) => { modeRef.current = value; setMode(value); setSelectedIncident(null); setSelectedTeam(null); }, []);
  const demoAction = useCallback((action: DemoAction) => {
    if (!modeRef.current) throw new Error("Switch to Demo Mode to simulate an action.");
    const next = applyDemoAction(demoRef.current, action);
    demoRef.current = next; setDemo(next);
    return { _id: action.type === "assign" ? next.assignments[0]._id : "incidentId" in action ? action.incidentId : "teamId" in action ? action.teamId : "demo-reset" };
  }, []);

  const [attempt, setAttempt] = useState(0);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  const refreshTask = useRef<(() => Promise<void>) | null>(null);

  useEffect(() => {
    if (isDemoMode) {
      refreshTask.current = null;
      return;
    }
    let active = true;
    let running = false;
    let refreshOnComplete = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let controller: AbortController | null = null;
    async function load() {
      if (!active || document.hidden) return;
      if (running) {
        refreshOnComplete = true;
        return;
      }
      running = true;
      setIsRefreshing(true);
      controller = new AbortController();
      const results = await Promise.allSettled([
        incidentsApi.list({ limit: 100, sort: "priority", isSimulated: false }, controller.signal),
        teamsApi.list({ limit: 100, isSimulated: false }, controller.signal),
        assignmentsApi.list({ limit: 100, isSimulated: false }, controller.signal),
      ]);
      if (!active) return;
      const [incidentResult, teamResult, assignmentResult] = results;
      if (incidentResult.status === "fulfilled") {
        setLiveIncidents(incidentResult.value.items);
        setSelectedIncident((previous) =>
          previous
            ? incidentResult.value.items.find(
                (item) => item._id === previous._id,
              ) || previous
            : null,
        );
      }
      if (teamResult.status === "fulfilled") {
        setLiveTeams(teamResult.value.items);
        setSelectedTeam((previous) =>
          previous
            ? teamResult.value.items.find(
                (item) => item._id === previous._id,
              ) || previous
            : null,
        );
      }
      if (assignmentResult.status === "fulfilled")
        setLiveAssignments(assignmentResult.value.items);
      const failed = results.find((result) => result.status === "rejected");
      setError(
        failed?.status === "rejected" ? errorMessage(failed.reason) : null,
      );
      if (!failed) setLastUpdated(Date.now());
      setLoading(false);
      setIsRefreshing(false);
      running = false;
      clearTimeout(timer);
      if (!document.hidden) {
        if (refreshOnComplete) {
          refreshOnComplete = false;
          void load();
        } else timer = setTimeout(() => void load(), 7000);
      }
    }
    function visibility() {
      clearTimeout(timer);
      if (document.hidden) controller?.abort();
      else if (running) refreshOnComplete = true;
      else void load();
    }
    refreshTask.current = load;
    document.addEventListener("visibilitychange", visibility);
    void load();
    return () => {
      active = false;
      clearTimeout(timer);
      controller?.abort();
      refreshTask.current = null;
      document.removeEventListener("visibilitychange", visibility);
    };
  }, [isDemoMode, attempt]);

  const refresh = useCallback(async () => {
    if (refreshTask.current) await refreshTask.current();
    else setAttempt((value) => value + 1);
  }, []);

  const currentIncidents = useMemo(() => {
    if (isDemoMode) return demo.incidents;
    return liveIncidents;
  }, [isDemoMode, liveIncidents, demo.incidents]);

  const currentTeams = useMemo(() => {
    if (isDemoMode) return demo.teams;
    return liveTeams;
  }, [isDemoMode, liveTeams, demo.teams]);

  const currentAssignments = useMemo(() => {
    if (isDemoMode) return demo.assignments;
    return liveAssignments;
  }, [isDemoMode, liveAssignments, demo.assignments]);

  const filteredIncidents = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return currentIncidents;
    return currentIncidents.filter((inc) => {
      const address = inc.location?.address?.toLowerCase() || "";
      const desc = inc.description?.toLowerCase() || "";
      const reporter = inc.reporterName?.toLowerCase() || "";
      const type = inc.emergencyType?.toLowerCase() || "";
      const priority = inc.priorityLevel?.toLowerCase() || "";
      return (
        address.includes(q) ||
        desc.includes(q) ||
        reporter.includes(q) ||
        type.includes(q) ||
        priority.includes(q)
      );
    });
  }, [currentIncidents, searchQuery]);

  const filteredTeams = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return currentTeams;
    return currentTeams.filter((team) => {
      const name = team.name?.toLowerCase() || "";
      const code = team.teamCode?.toLowerCase() || "";
      const status = team.status?.toLowerCase() || "";
      const caps = team.capabilities?.join(" ").toLowerCase() || "";
      const addr = team.location?.address?.toLowerCase() || "";
      return (
        name.includes(q) ||
        code.includes(q) ||
        status.includes(q) ||
        caps.includes(q) ||
        addr.includes(q)
      );
    });
  }, [currentTeams, searchQuery]);

  const stats = useMemo<DashboardStats>(() => {
    const active = currentIncidents.filter(
      (i) => i.status !== "RESOLVED" && i.status !== "CANCELLED",
    ).length;
    const critical = currentIncidents.filter(
      (i) =>
        i.priorityLevel === "CRITICAL" &&
        i.status !== "RESOLVED" &&
        i.status !== "CANCELLED",
    ).length;
    const available = currentTeams.filter(
      (t) => t.status === "AVAILABLE",
    ).length;
    const totalTeams = currentTeams.length;
    const busy = currentTeams.filter((t) => t.status === "BUSY").length;
    const today = new Date().toDateString();
    const resolved = currentIncidents.filter(
      (i) =>
        i.status === "RESOLVED" &&
        new Date(i.updatedAt).toDateString() === today,
    ).length;

    return {
      activeIncidents: active,
      criticalCases: critical,
      availableTeams: available,
      totalTeams: totalTeams,
      busyTeams: busy,
      resolvedToday: resolved,
    };
  }, [currentIncidents, currentTeams]);

  const value = useMemo(
    () => ({
      incidents: currentIncidents,
      teams: currentTeams,
      assignments: currentAssignments,
      loading: isDemoMode ? false : loading,
      error,
      isDemoMode,
      setIsDemoMode,
      searchQuery,
      setSearchQuery,
      selectedIncident: selectedIncident ? currentIncidents.find(i=>i._id===selectedIncident._id) || null : null,
      setSelectedIncident,
      selectedTeam: selectedTeam ? currentTeams.find(t=>t._id===selectedTeam._id) || null : null,
      setSelectedTeam,
      refresh,
      isRefreshing: isDemoMode ? false : isRefreshing,
      lastUpdated,
      filteredIncidents,
      filteredTeams,
      stats,
      demo, demoAction,
    }),
    [
      currentIncidents,
      currentTeams,
      currentAssignments,
      loading,
      error,
      isDemoMode,
      searchQuery,
      selectedIncident,
      selectedTeam,
      refresh,
      isRefreshing,
      lastUpdated,
      filteredIncidents,
      filteredTeams,
      stats, demo, demoAction, setIsDemoMode,
    ],
  );

  return (
    <DashboardContext.Provider value={value}>
      {children}
    </DashboardContext.Provider>
  );
}

const defaultDashboardContext: DashboardContextType = {
  demo: createDemoEnvironment(),
  demoAction: () => { throw new Error("Demo provider is unavailable."); },
  incidents: MOCK_INCIDENTS,
  teams: MOCK_RESCUE_TEAMS,
  assignments: MOCK_ASSIGNMENTS,
  loading: false,
  error: null,
  isDemoMode: true,
  setIsDemoMode: () => {},
  searchQuery: "",
  setSearchQuery: () => {},
  selectedIncident: null,
  setSelectedIncident: () => {},
  selectedTeam: null,
  setSelectedTeam: () => {},
  refresh: async () => {},
  isRefreshing: false,
  lastUpdated: null,
  filteredIncidents: MOCK_INCIDENTS,
  filteredTeams: MOCK_RESCUE_TEAMS,
  stats: {
    activeIncidents: 12,
    criticalCases: 4,
    availableTeams: 6,
    totalTeams: 8,
    busyTeams: 2,
    resolvedToday: 18,
  },
};

export function useDashboard() {
  const context = useContext(DashboardContext);
  return context || defaultDashboardContext;
}
