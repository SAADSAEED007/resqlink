"use client";
import { useEffect, useRef, useState } from "react";
import { teams as teamApi } from "@/lib/api/teams";
import { ApiError, errorMessage } from "@/lib/api/client";
import type { Capability, Paginated, RescueTeam, TeamStatus } from "@/types/api";
import { useDashboard } from "@/components/dashboard/dashboard-context";


function validTeam(team: RescueTeam | undefined): team is RescueTeam {
  // Keep an otherwise valid team visible when its base is missing; map adapters
  // independently decide whether a real coordinate pair can be plotted.
  return !!team && typeof team._id === "string" && typeof team.name === "string" && typeof team.teamCode === "string" && Array.isArray(team.capabilities) && Number.isFinite(team.capacity) && ["AVAILABLE", "BUSY", "OFFLINE"].includes(team.status);
}

export function useRescueTeams() {
  const dashboard = useDashboard();
  const { isDemoMode, demo } = dashboard;
  const [data, setData] = useState<Paginated<RescueTeam>>({ items: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 0 } });
  const [counts, setCounts] = useState<number[] | null>(null);
  const [countError, setCountError] = useState("");
  const [page, setPage] = useState(1), [status, setStatus] = useState<TeamStatus | "">(""), [capability, setCapability] = useState<Capability | "">("");
  const [search, setSearch] = useState(""), [query, setQuery] = useState(""), [sort, setSort] = useState("code");
  const [selectedId, setSelectedId] = useState(""), [profile, setProfile] = useState<RescueTeam | null>(null);
  const [profileError, setProfileError] = useState("");
  const [loading, setLoading] = useState(true), [error, setError] = useState(""), [attempt, setAttempt] = useState(0);
  const [busy, setBusy] = useState(false), [mutationError, setMutationError] = useState(""), [message, setMessage] = useState("");
  const [uncertain, setUncertain] = useState(false);
  const lock = useRef(false), alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  useEffect(() => { const timer = setTimeout(() => { setQuery(search.trim()); setPage(1); }, 300); return () => clearTimeout(timer); }, [search]);
  useEffect(() => {
    const controller = new AbortController(); let running = false; let timer: ReturnType<typeof setTimeout>;
    async function load() {
      if (running || lock.current || document.hidden || controller.signal.aborted) return;
      running = true;
      try {
        let next: Paginated<RescueTeam>;
        if (isDemoMode) {
          const filtered = demo.teams.filter(team => (!status || team.status === status) && (!capability || team.capabilities.includes(capability)) && (!query || `${team.name} ${team.teamCode}`.toLowerCase().includes(query.toLowerCase())));
          next = { items: filtered.slice((page - 1) * 20, page * 20), pagination: { page, limit: 20, total: filtered.length, totalPages: Math.ceil(filtered.length / 20) } };
          setCounts([demo.teams.length, ...["AVAILABLE", "BUSY", "OFFLINE"].map(value => demo.teams.filter(team => team.status === value).length)]);
        } else {
          next = await teamApi.list({ page, limit: 20, status: status || undefined, capability: capability || undefined, search: query || undefined, isSimulated: false }, controller.signal);
          if (!Array.isArray(next?.items) || !next.pagination || !Number.isFinite(next.pagination.total) || next.items.some(team => !validTeam(team))) throw new ApiError("Invalid team response. Please retry.", 0, "protocol");
          const totals = await Promise.allSettled([undefined, "AVAILABLE", "BUSY", "OFFLINE"].map(value => teamApi.list({ page: 1, limit: 1, status: value as TeamStatus | undefined, isSimulated: false }, controller.signal)));
          if (controller.signal.aborted) return;
          if (totals.every(result => result.status === "fulfilled" && Number.isFinite(result.value?.pagination?.total))) {
            setCounts(totals.map(result => result.status === "fulfilled" ? result.value.pagination.total : 0)); setCountError("");
          } else { setCounts(null); setCountError("Exact totals are temporarily unavailable."); }
        }
        if (!controller.signal.aborted) { setData(next); setError(""); setSelectedId(previous => previous || next.items[0]?._id || ""); }
      } catch (failure) { if (!controller.signal.aborted) setError(errorMessage(failure)); }
      finally { running = false; if (!controller.signal.aborted) { setLoading(false); if (!document.hidden) timer = setTimeout(() => void load(), 9000); } }
    }
    function visible() { clearTimeout(timer); if (!document.hidden) void load(); }
    timer = setTimeout(() => void load(), 0);
    document.addEventListener("visibilitychange", visible);
    return () => { controller.abort(); clearTimeout(timer); document.removeEventListener("visibilitychange", visible); };
  }, [page, status, capability, query, attempt, isDemoMode, demo.teams]);
  useEffect(() => {
    if (!selectedId) return;
    const controller = new AbortController(); let running = false; let timer: ReturnType<typeof setTimeout>;
    async function load() {
      if (running || lock.current || document.hidden) return; running = true;
      try {
        const record = isDemoMode ? demo.teams.find(team => team._id === selectedId) : await teamApi.get(selectedId, controller.signal);
        if (!validTeam(record) || record._id !== selectedId) throw new ApiError("Team profile unavailable.", 404);
        if (!controller.signal.aborted) { setProfile(record); setProfileError(""); }
      } catch (failure) { if (!controller.signal.aborted) setProfileError(errorMessage(failure)); }
      finally { running = false; if (!controller.signal.aborted && !document.hidden) timer = setTimeout(() => void load(), 9000); }
    }
    const visible = () => { clearTimeout(timer); if (!document.hidden) void load(); };
    timer = setTimeout(() => void load(), 0); document.addEventListener("visibilitychange", visible);
    return () => { controller.abort(); clearTimeout(timer); document.removeEventListener("visibilitychange", visible); };
  }, [selectedId, attempt, isDemoMode, demo.teams]);
  async function mutate(task: () => Promise<RescueTeam>, success: string, simulation?: import("@/components/dashboard/demo-environment").DemoAction) {
    if (lock.current || uncertain) return false;
    if (isDemoMode) {lock.current=true; try {if(!simulation) throw new Error("This demo action is not supported."); dashboard.demoAction(simulation);setMessage("Team state updated in simulation.");setMutationError("");return true;}catch(error){setMutationError(error instanceof Error ? error.message : "Simulation failed.");return false;}finally{lock.current=false;}}
    lock.current = true; setBusy(true); setMutationError(""); setMessage("");
    try {
      const result = await task(); if (!result?._id || !/^[a-f\d]{24}$/i.test(result._id)) throw new ApiError("Invalid server confirmation", 0, "protocol");
      if (alive.current) { setProfile(result); setSelectedId(result._id); setMessage(success); setAttempt(value => value + 1); void dashboard.refresh(); }
      return true;
    } catch (failure) {
      if (alive.current) {
        const ambiguous = !(failure instanceof ApiError) || failure.status === 0 || failure.status >= 500;
        setUncertain(ambiguous); setMutationError(ambiguous ? "The change is unconfirmed and may have reached the server. Refresh and inspect records before acknowledging a retry." : errorMessage(failure)); setAttempt(value => value + 1);
      }
      return false;
    } finally { lock.current = false; if (alive.current) setBusy(false); }
  }
  const items = [...data.items].sort((a,b) => sort === "name" ? a.name.localeCompare(b.name) : sort === "status" ? a.status.localeCompare(b.status) || a.name.localeCompare(b.name) : a.teamCode.localeCompare(b.teamCode));
  const selected = profile?._id === selectedId ? profile : data.items.find(team => team._id === selectedId) || null;
  return { isDemoMode, data, items, counts, countError, page, setPage, status, setStatus, capability, setCapability, search, setSearch, sort, setSort,
    selectedId, setSelectedId, selected, profileError, loading, error, busy, mutationError, message, uncertain, mutate,
    acknowledge: () => setUncertain(false), reload: () => setAttempt(value => value + 1), refreshVersion: attempt };
}
export type RescueTeamsModel = ReturnType<typeof useRescueTeams>;
