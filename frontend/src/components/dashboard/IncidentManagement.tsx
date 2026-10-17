"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { MapPin, RefreshCw, Search, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { incidents } from "@/lib/api/incidents";
import { errorMessage } from "@/lib/api/client";
import type { Incident, IncidentStatus, Paginated, PriorityLevel, VerificationStatus } from "@/types/api";
import { IncidentVisual, incidentTitle } from "./incident-visual";
import { useDashboard } from "./dashboard-context";
import { MOCK_INCIDENTS } from "./mock-data";

const initial: Paginated<Incident> = { items: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 1 } };
export function IncidentManagement() {
  const router = useRouter();
  const { isDemoMode, setIsDemoMode, refresh: refreshDashboard, setSelectedIncident } = useDashboard();
  const [data, setData] = useState(initial), [loading, setLoading] = useState(true), [error, setError] = useState("");
  const [page, setPage] = useState(1), [status, setStatus] = useState<IncidentStatus | "">(""), [priority, setPriority] = useState<PriorityLevel | "">(""), [verification, setVerification] = useState<VerificationStatus | "">(""), [sort, setSort] = useState<"priority" | "oldest" | "newest">("priority"), [query, setQuery] = useState(""), [updated, setUpdated] = useState<number | null>(null);
  const load = useCallback(async () => {
    if (isDemoMode) {
      setData({ items: MOCK_INCIDENTS, pagination: { page: 1, limit: 20, total: MOCK_INCIDENTS.length, totalPages: 1 } });
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const next = await incidents.list({ page, limit: 20, status: status || undefined, priorityLevel: priority || undefined, verificationStatus: verification || undefined, sort });
      setData(next);
      setUpdated(Date.now());
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [isDemoMode, page, status, priority, verification, sort]);
  useEffect(() => { const initialLoad = setTimeout(() => void load(), 0); return () => clearTimeout(initialLoad); }, [load]);
  useEffect(() => { if (document.hidden || isDemoMode) return; const timer = setInterval(() => { if (!document.hidden) void load(); }, 7000); const visible = () => { if (!document.hidden) void load(); }; document.addEventListener("visibilitychange", visible); return () => { clearInterval(timer); document.removeEventListener("visibilitychange", visible); }; }, [load, isDemoMode]);
  const displayed = useMemo(() => { const q = query.trim().toLowerCase(); return q ? data.items.filter((i) => [i._id, i.emergencyType, i.reporterName, i.location?.address, i.description].filter(Boolean).join(" ").toLowerCase().includes(q)) : data.items; }, [data.items, query]);
  const clear = () => { setStatus(""); setPriority(""); setVerification(""); setSort("priority"); setQuery(""); setPage(1); };
  const open = (incident: Incident) => {
    setSelectedIncident(null);
    router.push(`/dashboard/incidents/${encodeURIComponent(incident._id)}${isDemoMode ? "?demo=true" : ""}`);
  };
  const preview = () => {
    setIsDemoMode(true);
    setSelectedIncident(null);
    router.push(`/dashboard/incidents/INC-2024-0814-001?demo=true`);
  };
  return <div className="rqIncidentPage">
    <div className="rqIncidentNotice" style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 16 }}>
      <span>{isDemoMode ? "Simulation Preview · Fictional incidents for coordinator workflow review." : "Select a report below to open its full incident command workspace."}</span>
      <button onClick={preview} aria-label="Preview demo incident workspace">Preview demo incident workspace</button>
    </div>
    <header className="rqIncidentPageHead"><div><p className="rqIncidentEyebrow">Coordinator workspace</p><h1>Incident Management</h1><p>Monitor reports, assess urgency, and coordinate response.</p></div><div><small>{updated ? `Updated ${new Date(updated).toLocaleTimeString()}` : ""}</small><button onClick={() => { void load(); void refreshDashboard(); }} disabled={loading}><RefreshCw size={15} className={loading ? "animate-spin" : ""} /> Refresh</button></div></header>
    <>
      <section className="rqIncidentMetrics" aria-label="Incident summary"><Metric label="Records in current filter" value={data.pagination.total} /><Metric label="Pending review" value={data.items.filter(i => i.status === "PENDING").length} /><Metric label="Critical on this page" value={data.items.filter(i => i.priorityLevel === "CRITICAL").length} /><Metric label="Active responses" value={data.items.filter(i => i.status === "ASSIGNED" || i.status === "IN_PROGRESS").length} /></section>
      <section className="rqIncidentFilters" aria-label="Incident filters"><label><Search size={16}/><input aria-label="Search loaded records" value={query} onChange={e => setQuery(e.target.value)} placeholder="Search loaded records" /></label><select aria-label="Filter by status" value={status} onChange={e => { setStatus(e.target.value as IncidentStatus | ""); setPage(1); }}><option value="">All statuses</option>{["PENDING","ASSIGNED","IN_PROGRESS","RESOLVED","CANCELLED"].map(x=><option key={x}>{x}</option>)}</select><select aria-label="Filter by priority" value={priority} onChange={e => { setPriority(e.target.value as PriorityLevel | ""); setPage(1); }}><option value="">All priorities</option>{["CRITICAL","HIGH","MEDIUM","LOW"].map(x=><option key={x}>{x}</option>)}</select><select aria-label="Filter by verification" value={verification} onChange={e => { setVerification(e.target.value as VerificationStatus | ""); setPage(1); }}><option value="">All verification</option>{["NEEDS_REVIEW","VERIFIED","FLAGGED_DUPLICATE","DISMISSED"].map(x=><option key={x}>{x}</option>)}</select><select aria-label="Sort incidents" value={sort} onChange={e => setSort(e.target.value as typeof sort)}><option value="priority">Highest priority</option><option value="newest">Most recent</option><option value="oldest">Oldest</option></select><button onClick={clear}><X size={15}/> Clear</button></section>
      {error ? <p className="rqIncidentError" role="alert">{error} <button onClick={() => void load()}>Try again</button></p> : <section className="rqIncidentList" aria-busy={loading}>{loading ? <p>Loading incident records…</p> : displayed.length === 0 ? <p>No incidents match the current filters.</p> : displayed.map(i => <button className="rqIncidentRow" key={i._id} onClick={() => open(i)}><IncidentVisual incident={i}/><div><strong>{incidentTitle(i)} <span className={`rqCommandSeverity ${i.priorityLevel.toLowerCase()}`}>{i.priorityLevel}</span></strong><p><MapPin size={13}/>{i.location?.address || "Location verification required"}</p><small>{i.verification?.status.replaceAll("_"," ") || "Verification not recorded"} · {i.status.replaceAll("_"," ")}</small></div><time>{new Date(i.createdAt).toLocaleString()}</time></button>)}</section>}
      <footer className="rqIncidentPagination"><span>Page {data.pagination.page} of {data.pagination.totalPages} · {data.pagination.total} records</span><button disabled={page <= 1 || loading} onClick={() => setPage(page-1)}>Previous</button><button disabled={page >= data.pagination.totalPages || loading} onClick={() => setPage(page+1)}>Next</button></footer>
    </>
  </div>;
}
function Metric({label,value}:{label:string;value:number}) { return <div><span>{label}</span><strong>{value}</strong></div>; }
