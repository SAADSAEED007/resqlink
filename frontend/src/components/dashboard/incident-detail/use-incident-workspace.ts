"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { incidents } from "@/lib/api/incidents";
import { ApiError, errorMessage } from "@/lib/api/client";
import type { Incident, Recommendations } from "@/types/api";
import { eligibleDemoTeam, type DemoAction } from "../demo-environment";
import { useDashboard } from "../dashboard-context";

export function useIncidentWorkspace(id: string) {
  const dashboard = useDashboard();
  const { isDemoMode, refresh } = dashboard;
  const [incident, setIncident] = useState<Incident | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [recommendations, setRecommendations] = useState<Recommendations | null>(null);
  const [recommendationError, setRecommendationError] = useState("");
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [actionError, setActionError] = useState("");
  const [uncertain, setUncertain] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const lock = useRef(false);
  const active = useRef(false);
  const generation = useRef(0);
  const validId = /^[a-f\d]{24}$/i.test(id);
  const isDemoRef = id === "INC-2024-0814-001" || id.startsWith("INC-");
  const isSimulatedTarget = isDemoMode && !validId;
  const demo = useMemo(() => isSimulatedTarget ? dashboard.demo.incidents.find(record => record._id === id || (id === "INC-2024-0814-001" && record._id === dashboard.demo.incidents[0]?._id)) || null : null, [isSimulatedTarget, dashboard.demo.incidents, id]);

  const loadRecommendations = useCallback(async (record: Incident, signal?: AbortSignal) => {
    if (isSimulatedTarget || record.isSimulated) {
      if (!signal?.aborted && active.current) {
        setRecommendations({ manualSelectionRequired: true, distanceType: "APPROXIMATE_STRAIGHT_LINE_KM", message: "Eligible simulated teams; coordinator selection required.", items: dashboard.demo.teams.filter(team => eligibleDemoTeam(record, team)).map(team => ({ team, approximateDistanceKm: 0, capacityWarning: record.peopleAffected && record.peopleAffected > team.capacity ? "Reported people exceed team capacity; review resources." : null })) });
        setRecommendationError("");
      }
      return;
    }
    if (record.status !== "PENDING" || record.assignedTeam) {
      if (!signal?.aborted && active.current) setRecommendations(null);
      return;
    }
    try {
      const result = await incidents.recommendations(record._id, signal);
      if (!signal?.aborted && active.current) {
        setRecommendations(result);
        setRecommendationError("");
      }
    } catch (failure) {
      if (!signal?.aborted && active.current) {
        setRecommendations(null);
        setRecommendationError(errorMessage(failure));
      }
    }
  }, [isSimulatedTarget, dashboard.demo.teams]);

  useEffect(() => {
    active.current = true;
    const run = ++generation.current;
    const controller = new AbortController();
    let running = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    async function load() {
      if (running || lock.current || document.hidden) return;
      running = true;
      try {
        if (!validId && !isSimulatedTarget) throw new ApiError("Invalid incident reference.", 400);
        const record = isSimulatedTarget ? demo : await incidents.get(id, controller.signal);
        if (!record) throw new ApiError("Incident not found.", 404);
        if (
          !record._id ||
          (record._id !== id && !(isDemoMode && id === "INC-2024-0814-001")) ||
          !["CRITICAL", "HIGH", "MEDIUM", "LOW"].includes(record.priorityLevel) ||
          (record.description != null && typeof record.description !== "string") ||
          !["PENDING", "ASSIGNED", "IN_PROGRESS", "RESOLVED", "CANCELLED"].includes(record.status)
        )
          throw new ApiError("The incident response could not be read. Please retry.", 0, "protocol");
        if (controller.signal.aborted || run !== generation.current || lock.current) return;
        setIncident(record);
        setError("");
        await loadRecommendations(record, controller.signal);
      } catch (failure) {
        if (!controller.signal.aborted && run === generation.current) {
          setError(failure instanceof ApiError && failure.status === 404 ? "Incident not found. It may have been removed or the reference is incorrect." : failure instanceof ApiError && failure.status === 400 ? failure.message : errorMessage(failure));
        }
      } finally {
        running = false;
        if (!controller.signal.aborted && run === generation.current) setLoading(false);
      }
    }
    function schedule() {
      clearTimeout(timer);
      void load().finally(() => {
        if (!controller.signal.aborted && !isDemoMode && !document.hidden) timer = setTimeout(schedule, 7000);
      });
    }
    function visible() { if (!document.hidden) schedule(); else clearTimeout(timer); }
    schedule();
    document.addEventListener("visibilitychange", visible);
    return () => {
      active.current = false;
      controller.abort();
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", visible);
    };
  }, [id, isDemoMode, demo, validId, isDemoRef, isSimulatedTarget, attempt, loadRecommendations]);

  async function mutate(task: () => Promise<{ _id: string }>, success: string, simulation?: DemoAction) {
    if (lock.current || !incident || (!isDemoMode && incident.isSimulated) || (uncertain && !acknowledged)) return false;
    if (isDemoMode) {
      lock.current = true;
      try { if (!simulation) throw new Error("This demo action is not supported."); dashboard.demoAction(simulation); setFeedback("Simulation updated successfully."); setActionError(""); return true; }
      catch (failure) { setActionError(failure instanceof Error ? failure.message : "Simulation could not be updated."); return false; }
      finally { lock.current = false; }
    }
    lock.current = true;
    const run = generation.current;
    setBusy(true); setActionError(""); setFeedback("");
    try {
      const result = await task();
      if (!result?._id || !/^[a-f\d]{24}$/i.test(result._id)) throw new ApiError("Invalid server confirmation", 0, "protocol");
      if (!active.current || run !== generation.current) { void refresh(); return true; }
      setFeedback(success); setUncertain(false); setAcknowledged(false);
      try {
        const current = await incidents.get(id);
        if (active.current && run === generation.current) {
          setIncident(current);
          await loadRecommendations(current);
        }
      } catch {
        if (active.current && run === generation.current) {
          setUncertain(true);
          setActionError("The change was confirmed, but current details could not be reloaded. Refresh records before another change.");
        }
      }
      await refresh();
      return true;
    } catch (failure) {
      if (!active.current || run !== generation.current) return false;
      const ambiguous = !(failure instanceof ApiError) || failure.status === 0 || failure.status >= 500;
      setUncertain(ambiguous); setAcknowledged(false);
      setActionError(ambiguous ? "The change is unconfirmed and may have reached the server. Reload current records before retrying; do not assume it failed." : errorMessage(failure));
      await refresh();
      setAttempt(value => value + 1);
      return false;
    } finally {
      lock.current = false;
      if (active.current) setBusy(false);
    }
  }
  return { ...dashboard, incident: isSimulatedTarget ? (demo ?? incident) : incident, loading, error, recommendations, recommendationError,
    busy, feedback, actionError, uncertain, acknowledged, setAcknowledged, mutate,
    reload: () => setAttempt(value => value + 1),
    blocked: busy || (uncertain && !acknowledged) || (!isDemoMode && !!incident?.isSimulated),
  };
}
