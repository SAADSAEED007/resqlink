"use client";
import { useDashboard } from "@/components/dashboard/dashboard-context";
import { eligibleDemoTeam } from "@/components/dashboard/demo-environment";
import { filterDemoIncidents } from "@/components/dashboard/incident-filters";
import { useCallback, useEffect, useRef, useState } from "react";
import { incidents, type IncidentQuery } from "@/lib/api/incidents";
import { assignments } from "@/lib/api/assignments";
import { teams } from "@/lib/api/teams";
import { ApiError, errorMessage } from "@/lib/api/client";
import type {
  Incident,
  Recommendations,
  RescueTeam,
  Paginated,
} from "@/types/api";
import { recordId, todayRange, type AssignmentRecord } from "./assignment-data";

export function useAssignmentWorkspace(demo: boolean) {
  const environment = useDashboard();
  const [filters, setFilters] = useState<IncidentQuery>({
    page: 1,
    sort: "priority",
  });
  const [history, setHistory] = useState(false),
    [assignmentPage, setAssignmentPage] = useState(1);
  const [apiSnapshot, setSnapshot] = useState<{
    queue: Paginated<Incident>;
    records: Paginated<AssignmentRecord>;
    activity: AssignmentRecord[];
    metrics: number[];
  } | null>(null);
  const [selection, setSelection] = useState<{
    kind: "incident" | "assignment";
    id: string;
  } | null>(null);
  const [apiDetail, setDetail] = useState<{
    incident: Incident;
    assignment?: AssignmentRecord;
    recommendations?: Recommendations;
  } | null>(null);
  const [selectedTeam, setSelectedTeam] = useState(""),
    [notes, setNotes] = useState("");
  const [error, setError] = useState(""),
    [detailError, setDetailError] = useState("");
  const [loadingDetail, setLoadingDetail] = useState(false),
    [busy, setBusy] = useState(false),
    [uncertain, setUncertain] = useState(false);
  const [message, setMessage] = useState(""),
    [attempt, setAttempt] = useState(0);
  const locked = useRef(false),
    detailVersion = useRef(0);
  const refresh = useCallback(() => setAttempt((value) => value + 1), []);
  useEffect(() => {
    if (demo) return;
    const controller = new AbortController();
    let active = true,
      running = false;
    async function load() {
      if (running || document.hidden || locked.current) return;
      running = true;
      try {
        const signal = controller.signal;
        const [
          queue,
          records,
          pending,
          critical,
          activeCount,
          completed,
          recent,
          recentCompleted,
        ] = await Promise.all([
          incidents.list(
            { ...filters, unassigned: true, isSimulated: false, limit: 6 },
            signal,
          ),
          assignments.list<AssignmentRecord>(
            {
              status: history ? "COMPLETED" : "ACTIVE",
              page: assignmentPage,
              limit: 5,
              isSimulated: false,
              sort: history ? "completed" : "assigned",
            },
            signal,
          ),
          incidents.list(
            { unassigned: true, isSimulated: false, limit: 1 },
            signal,
          ),
          incidents.list(
            {
              unassigned: true,
              isSimulated: false,
              priorityLevel: "CRITICAL",
              limit: 1,
            },
            signal,
          ),
          assignments.list(
            { status: "ACTIVE", isSimulated: false, limit: 1 },
            signal,
          ),
          assignments.list(
            {
              status: "COMPLETED",
              isSimulated: false,
              limit: 1,
              ...todayRange(),
            },
            signal,
          ),
          assignments.list<AssignmentRecord>(
            { isSimulated: false, limit: 5 },
            signal,
          ),
          assignments.list<AssignmentRecord>(
            {
              status: "COMPLETED",
              isSimulated: false,
              limit: 5,
              sort: "completed",
            },
            signal,
          ),
        ]);
        if (active) {
          const activity = Array.from(
            new Map(
              [...recent.items, ...recentCompleted.items].map((row) => [
                row._id,
                row,
              ]),
            ).values(),
          );
          setSnapshot({
            queue,
            records,
            activity,
            metrics: [
              pending.pagination.total,
              activeCount.pagination.total,
              critical.pagination.total,
              completed.pagination.total,
            ],
          });
          setError("");
        }
      } catch (failure) {
        if (active) setError(errorMessage(failure));
      } finally {
        running = false;
      }
    }
    void load();
    const timer = setInterval(() => void load(), 15000);
    document.addEventListener("visibilitychange", load);
    return () => {
      active = false;
      controller.abort();
      clearInterval(timer);
      document.removeEventListener("visibilitychange", load);
    };
  }, [filters, history, assignmentPage, attempt, demo]);

  const demoAssignments: AssignmentRecord[] = environment.demo.assignments.map(row => ({...row, incidentId:environment.demo.incidents.find(i=>i._id===row.incidentId)||null, teamId:environment.demo.teams.find(t=>t._id===row.teamId)||null}));
  const queue = filterDemoIncidents(environment.demo.incidents, {search:filters.search,status:"PENDING",priority:filters.priorityLevel,verification:filters.verificationStatus,sort:filters.sort}).filter(i=>!i.assignedTeam);
  const demoRecords = demoAssignments.filter(a=>a.status===(history?"COMPLETED":"ACTIVE"));
  const snapshot = demo ? {
    queue:{items:queue.slice(((filters.page||1)-1)*6,(filters.page||1)*6),pagination:{page:filters.page||1,limit:6,total:queue.length,totalPages:Math.max(1,Math.ceil(queue.length/6))}},
    records:{items:demoRecords.slice((assignmentPage-1)*5,assignmentPage*5),pagination:{page:assignmentPage,limit:5,total:demoRecords.length,totalPages:Math.max(1,Math.ceil(demoRecords.length/5))}},
    activity:demoAssignments, metrics:[queue.length,demoAssignments.filter(a=>a.status==="ACTIVE").length,queue.filter(i=>i.priorityLevel==="CRITICAL").length,demoAssignments.filter(a=>a.status==="COMPLETED").length]
  } : apiSnapshot;
  const demoAssignment = selection?.kind==="assignment" ? demoAssignments.find(a=>a._id===selection.id) : undefined;
  const demoIncident = environment.demo.incidents.find(i=>i._id===(demoAssignment?recordId(demoAssignment.incidentId):selection?.id));
  const detail = demo ? demoIncident ? {incident:demoIncident,assignment:demoAssignment,recommendations:{manualSelectionRequired:true as const,distanceType:"APPROXIMATE_STRAIGHT_LINE_KM" as const,message:"Eligible simulated teams",items:environment.demo.teams.filter(t=>eligibleDemoTeam(demoIncident,t)).map(team=>({team,approximateDistanceKm:0,capacityWarning:null}))}} : null : apiDetail;
  const loadDetail = useCallback(
    async (target: NonNullable<typeof selection>, signal?: AbortSignal) => {
      const version = ++detailVersion.current;
      try {
        const assignment = await (target.kind === "assignment"
          ? assignments.get<AssignmentRecord>(target.id, signal)
          : Promise.resolve(undefined));
        const id = assignment ? recordId(assignment.incidentId) : target.id;
        if (!id)
          throw new ApiError(
            "The linked incident is no longer available.",
            404,
          );
        const incident = await incidents.get(id, signal);
        const recommendations =
          incident.status === "PENDING" && !incident.assignedTeam
            ? await incidents.recommendations(id, signal)
            : undefined;
        if (version === detailVersion.current && !signal?.aborted) {
          setDetail({ incident, assignment, recommendations });
          setSelectedTeam((current) =>
            recommendations?.items.some(
              (item) =>
                item.team._id === current && item.team.status === "AVAILABLE",
            )
              ? current
              : "",
          );
        }
      } catch (failure) {
        if (version === detailVersion.current && !signal?.aborted) {
          setDetail(null);
          setDetailError(errorMessage(failure));
        }
      } finally {
        if (version === detailVersion.current && !signal?.aborted)
          setLoadingDetail(false);
      }
    },
    [],
  );
  useEffect(() => {
    if (!selection || demo) return;
    const controller = new AbortController();
    // This callback only sets state after asynchronous API reads; no synchronous state derivation.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadDetail(selection, controller.signal);
    return () => controller.abort();
  }, [selection, attempt, loadDetail, demo]);
  function select(kind: "incident" | "assignment", id: string) {
    if (locked.current) return;
    setSelection({ kind, id });
    setLoadingDetail(!demo);
    setDetailError("");
    setDetail(null);
    setSelectedTeam("");
    setNotes("");
    setMessage("");
  }
  async function mutate(action: "assign" | "IN_PROGRESS" | "RESOLVED") {
    if (!detail || locked.current || uncertain) return false;
    if (demo) {
      locked.current=true;
      try { const saved = environment.demoAction(action==="assign" ? {type:"assign",incidentId:detail.incident._id,teamId:selectedTeam} : {type:"status",incidentId:detail.incident._id,status:action}); if(action==="assign") {setSelection({kind:"assignment",id:saved._id});setHistory(false);setAssignmentPage(1);setNotes("");} setMessage("Simulation updated successfully."); return true; }
      catch(error) {setMessage(error instanceof Error?error.message:"Simulation failed.");return false;}
      finally {locked.current=false;}
    }
    locked.current = true;
    setBusy(true);
    setMessage("");
    try {
      if (action === "assign") {
        const [freshIncident, freshTeam] = await Promise.all([
          incidents.get(detail.incident._id),
          teams.get(selectedTeam),
        ]);
        if (
          freshIncident.status !== "PENDING" ||
          freshIncident.assignedTeam ||
          freshTeam.status !== "AVAILABLE" ||
          freshTeam.currentIncident
        )
          throw new ApiError(
            "Incident or team availability changed. Refresh and choose again.",
            409,
          );
        const result = await assignments.create({
          incidentId: freshIncident._id,
          teamId: freshTeam._id,
          ...(notes.trim() ? { notes: notes.trim() } : {}),
        });
        if (!result?._id)
          throw new ApiError(
            "The server did not confirm the assignment. Reload and inspect history before retrying.",
            0,
            "protocol",
          );
        setSelection({ kind: "assignment", id: result._id });
        setNotes("");
        setHistory(false);
        setAssignmentPage(1);
        setMessage(
          `Assignment ${result._id} recorded. No external dispatch notification is promised.`,
        );
      } else {
        const result = await incidents.updateStatus(
          detail.incident._id,
          action,
        );
        if (result.status !== action)
          throw new ApiError(
            "The status update was not confirmed. Reload to reconcile.",
            0,
            "protocol",
          );
        setMessage(
          action === "RESOLVED"
            ? "Incident resolved; assignment completed and team released by the server."
            : "Incident marked in progress.",
        );
      }
      refresh();
      return true;
    } catch (failure) {
      const unknown =
        failure instanceof ApiError &&
        (failure.code !== "http" || failure.status >= 500);
      if (unknown) setUncertain(true);
      setMessage(
        unknown
          ? "The result could not be confirmed. Reload and inspect the assignment history before attempting another action."
          : errorMessage(failure),
      );
      refresh();
      return false;
    } finally {
      locked.current = false;
      setBusy(false);
    }
  }
  const eligible =
    detail?.recommendations?.items.filter(
      (item) =>
        item.team.status === "AVAILABLE" &&
        !item.team.currentIncident &&
        (demo || !item.team.isSimulated),
    ) ?? [];
  const mapTeams: RescueTeam[] = eligible.map((item) => item.team);
  const assignedTeam = detail?.assignment?.teamId;
  if (assignedTeam && typeof assignedTeam === "object")
    mapTeams.push(assignedTeam as RescueTeam);
  return {
    filters,
    setFilters,
    history,
    setHistory,
    assignmentPage,
    setAssignmentPage,
    snapshot,
    selection,
    select,
    detail,
    selectedTeam,
    setSelectedTeam,
    notes,
    setNotes,
    error,
    detailError,
    loadingDetail,
    busy,
    uncertain,
    message,
    refresh,
    mutate,
    eligible,
    mapTeams,
  };
}
export type AssignmentModel = ReturnType<typeof useAssignmentWorkspace>;
