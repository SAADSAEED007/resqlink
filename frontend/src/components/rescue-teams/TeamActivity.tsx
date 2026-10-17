"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Check, Clock3, Radio } from "lucide-react";
import type { Assignment, Incident, RescueTeam } from "@/types/api";
import { assignments } from "@/lib/api/assignments";
import { errorMessage } from "@/lib/api/client";
import { MOCK_ASSIGNMENTS } from "@/components/dashboard/mock-data";
import { referenceId, teamDate } from "./team-utils";
type HistoryItem = Omit<Assignment, "incidentId" | "teamId"> & { incidentId: string | Pick<Incident, "_id" | "emergencyType" | "priorityLevel" | "status"> | null; teamId: string | Pick<RescueTeam, "_id" | "name" | "teamCode"> | null };
export function TeamActivity({ team, demo, version }: { team: RescueTeam | null; demo: boolean; version: number }) {
  const [items, setItems] = useState<HistoryItem[]>([]), [error, setError] = useState(""), [loading, setLoading] = useState(false), [page, setPage] = useState(1), [totalPages, setTotalPages] = useState(0), [attempt, setAttempt] = useState(0);
  const id = team?._id;
  useEffect(() => {
    if (!id) return; const controller = new AbortController(); let running = false; let timer: ReturnType<typeof setTimeout>;
    async function load() {
      if (running || document.hidden) return; running = true; setLoading(true);
      try {
        const result = demo ? { items: MOCK_ASSIGNMENTS.filter(item => item.teamId === id), pagination: { totalPages: 1 } } : await assignments.list<HistoryItem>({ teamId: id, page, limit: 5, isSimulated: false }, controller.signal);
        if (!Array.isArray(result.items)) throw new Error("Invalid history response");
        if (!controller.signal.aborted) { setItems(result.items.filter(item => referenceId(item.teamId) === id)); setTotalPages(result.pagination.totalPages); setError(""); }
      } catch (failure) { if (!controller.signal.aborted) setError(errorMessage(failure)); }
      finally { running = false; if (!controller.signal.aborted) { setLoading(false); if (!document.hidden) timer = setTimeout(() => void load(), 9000); } }
    }
    const visible = () => { clearTimeout(timer); if (!document.hidden) void load(); };
    timer = setTimeout(() => void load(), 0); document.addEventListener("visibilitychange", visible);
    return () => { controller.abort(); clearTimeout(timer); document.removeEventListener("visibilitychange", visible); };
  }, [id, page, demo, version, attempt]);
  const events = items.flatMap(item => [{ id: `${item._id}-assigned`, time: item.assignedAt, title: "Team assignment recorded", incidentId: referenceId(item.incidentId), status: item.status === "ACTIVE" ? "Active" : "Assigned", type: "assigned" }, ...(item.completedAt ? [{ id: `${item._id}-closed`, time: item.completedAt, title: item.status === "CANCELLED" ? "Assignment cancelled" : "Assignment completed", incidentId: referenceId(item.incidentId), status: item.status === "CANCELLED" ? "Cancelled" : "Completed", type: "completed" }] : [])]).filter(event => event.time && Number.isFinite(new Date(event.time).getTime())).sort((a,b) => new Date(b.time).getTime() - new Date(a.time).getTime());
  return <section className="rtCard rtActivity"><header><h2>Recent Activity &amp; Deployments</h2><button aria-label="Refresh team history" onClick={() => setAttempt(value => value + 1)}><Clock3 size={14}/></button></header>{!team ? <p className="rtEmpty">Select a team to view assignment history.</p> : error ? <p role="alert" className="rtEmpty">{error}<button onClick={() => setAttempt(value => value + 1)}>Retry history</button></p> : loading && !items.length ? <p className="rtEmpty" role="status">Loading team history…</p> : !events.length ? <p className="rtEmpty">No assignment history for this team.</p> : <ol className="rtTimeline">{events.map(event => <li key={event.id} className={`rtEvent-${event.type}`}><i>{event.type === "completed" ? <Check size={12}/> : <Radio size={12}/>}</i><time dateTime={event.time}>{teamDate(event.time)} PKT</time><div><strong>{event.title}</strong>{event.incidentId && <Link href={`/dashboard/incidents/${event.incidentId}${demo ? "?demo=true" : ""}`}>{event.incidentId.slice(-8)} · Open incident</Link>}</div><span>{event.status}</span></li>)}</ol>}{totalPages > 1 && <footer><button disabled={page <= 1} onClick={() => setPage(value => value - 1)}>Previous history</button><small>Page {page} / {totalPages}</small><button disabled={page >= totalPages} onClick={() => setPage(value => value + 1)}>Next history</button></footer>}<p className="rtHint">{demo ? "Simulated assignment records" : "Stored assignment timestamps"} · No inferred travel or status events.</p></section>;
}
