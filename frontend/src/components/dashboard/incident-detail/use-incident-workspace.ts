"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { incidents } from "@/lib/api/incidents";
import { ApiError, errorMessage } from "@/lib/api/client";
import type { Incident, Recommendations } from "@/types/api";
import { useDashboard } from "../dashboard-context";

const DEMO_RECOMMENDATIONS: Recommendations = {
  manualSelectionRequired: true,
  distanceType: "APPROXIMATE_STRAIGHT_LINE_KM",
  message: "Recommended teams sorted by proximity and flood rescue capability",
  items: [
    {
      team: {
        _id: "demo-team-1",
        name: "Karachi Rescue Team 1",
        teamCode: "KHI-RESCUE-01",
        capabilities: ["WATER_RESCUE", "MEDICAL", "EVACUATION"],
        capacity: 12,
        status: "AVAILABLE",
        location: { latitude: 24.935, longitude: 67.112, address: "Gulshan Base Station" },
        currentIncident: null,
        createdAt: "2024-08-14T08:00:00.000Z",
        updatedAt: "2024-08-14T08:00:00.000Z",
        isSimulated: true,
      },
      approximateDistanceKm: 3.2,
      capacityWarning: null,
    },
    {
      team: {
        _id: "demo-team-2",
        name: "Pakistan Navy (Flood Relief)",
        teamCode: "NAVY-FLOOD-01",
        capabilities: ["WATER_RESCUE", "SUPPLY_DELIVERY"],
        capacity: 20,
        status: "AVAILABLE",
        location: { latitude: 24.945, longitude: 67.135, address: "Naval Relief Base" },
        currentIncident: null,
        createdAt: "2024-08-14T08:00:00.000Z",
        updatedAt: "2024-08-14T08:00:00.000Z",
        isSimulated: true,
      },
      approximateDistanceKm: 5.6,
      capacityWarning: null,
    },
    {
      team: {
        _id: "demo-team-3",
        name: "Edhi Rescue Unit",
        teamCode: "EDHI-UNIT-04",
        capabilities: ["MEDICAL", "EVACUATION"],
        capacity: 10,
        status: "AVAILABLE",
        location: { latitude: 24.912, longitude: 67.045, address: "Edhi Emergency Post" },
        currentIncident: null,
        createdAt: "2024-08-14T08:00:00.000Z",
        updatedAt: "2024-08-14T08:00:00.000Z",
        isSimulated: true,
      },
      approximateDistanceKm: 6.1,
      capacityWarning: null,
    },
  ],
};

export function useIncidentWorkspace(id: string) {
  const dashboard = useDashboard();
  const { isDemoMode, incidents: demoRecords, refresh } = dashboard;
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
  const isSimulatedTarget = isDemoMode || isDemoRef;
  const demoFound = demoRecords.find(record => record._id === id);
  const demo = useMemo(() => isSimulatedTarget
    ? (demoFound
        ? { ...demoFound, _id: id }
        : {
            ...(demoRecords[0] || {}),
            _id: id,
            isSimulated: true,
            createdAt: "2024-08-14T10:24:00.000Z",
            updatedAt: "2024-08-14T10:24:00.000Z",
            reporterName: "Citizen Report (Mobile App)",
            emergencyType: "FLOOD" as const,
            description: "Flooded street near Hassan Square. Severe water accumulation blocking main transit arteries and stranding vehicles.",
            location: {
              latitude: 24.9207,
              longitude: 67.0982,
              address: "Gulshan-e-Iqbal, Karachi",
            },
            peopleAffected: 2800,
            vulnerablePeople: {
              children: 672,
              elderly: 504,
              disabled: 0,
              medicalNeeds: 120,
            },
            waterLevel: "HIGH" as const,
            immediateDanger: true,
            priorityScore: 91,
            priorityLevel: "CRITICAL" as const,
            priorityReasons: [
              "Severe flooding reported, water level rising (based on recent imagery and reports)",
              "High population density in affected area (est. 2,500–3,000 people)",
              "Presence of vulnerable groups (elderly, children, low-income households)",
              "Key roads are inaccessible, limiting self-evacuation",
              "Multiple corroborating reports from nearby locations",
            ],
            confidenceLevel: "HIGH" as const,
            status: "PENDING" as const,
            assignedTeam: null,
            priorityOverrides: [],
            locationVerificationRequired: false,
            verification: {
              status: "VERIFIED" as const,
              requiresManualReview: false,
              isPotentialDuplicate: false,
              potentialDuplicateIncidents: [],
              missingFields: [],
              warnings: [],
              reviewedAt: "2024-08-14T10:26:00.000Z",
              reviewNotes: "Corroborated by nearby citizen imagery and street sensors.",
            },
          }
      )
    : null, [isSimulatedTarget, demoFound, id, demoRecords]);

  const loadRecommendations = useCallback(async (record: Incident, signal?: AbortSignal) => {
    if (isSimulatedTarget || record.isSimulated) {
      if (!signal?.aborted && active.current) {
        setRecommendations(DEMO_RECOMMENDATIONS);
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
  }, [isSimulatedTarget]);

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
        if (!record._id || record._id !== id || !["CRITICAL", "HIGH", "MEDIUM", "LOW"].includes(record.priorityLevel) || typeof record.description !== "string" || !["PENDING", "ASSIGNED", "IN_PROGRESS", "RESOLVED", "CANCELLED"].includes(record.status))
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

  async function mutate(task: () => Promise<{ _id: string }>, success: string) {
    if (lock.current || isDemoMode || !incident || incident.isSimulated || (uncertain && !acknowledged)) return false;
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
    blocked: busy || (uncertain && !acknowledged) || isDemoMode || !!incident?.isSimulated,
  };
}
