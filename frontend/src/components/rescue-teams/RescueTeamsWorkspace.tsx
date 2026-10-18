"use client";
import { useState } from "react";
import dynamic from "next/dynamic";
import { ChevronRight, MapPin, Radio, RefreshCw, Search, ShieldCheck, UserPlus, Users, Wrench } from "lucide-react";
import { ConfirmationDialog } from "@/components/ui";
import { useDashboard } from "@/components/dashboard/dashboard-context";
import { teams } from "@/lib/api/teams";
import type { Capability, RescueTeam, TeamStatus as Status } from "@/types/api";
import { useRescueTeams } from "./use-rescue-teams";
import { capabilities, capabilityLabels, TeamIllustration, TeamStatus, validCoordinates } from "./team-utils";
import { TeamDetails } from "./TeamDetails";
import { TeamActivity } from "./TeamActivity";
import { TeamFormDialog } from "./TeamFormDialog";
import { TeamAssignmentDialog } from "./TeamAssignmentDialog";
import "./rescue-teams.css";

const CoverageMap = dynamic(() => import("./RescueTeamMap").then(module => module.RescueTeamMap), { ssr: false, loading: () => <section className="rtCard rtMapCard"><p role="status" className="rtEmpty">Loading team coverage map…</p></section> });
export function RescueTeamsWorkspace() {
  const { isDemoMode } = useDashboard();
  return <Workspace key={isDemoMode ? "demo" : "api"}/>;
}
function Workspace() {
  const model = useRescueTeams();
  const { setIsDemoMode } = useDashboard();
  const [form, setForm] = useState<"create" | "edit" | null>(null), [assigning, setAssigning] = useState(false), [availability, setAvailability] = useState<RescueTeam | null>(null);
  const readOnly = model.isDemoMode || model.busy || model.uncertain || !!model.selected?.isSimulated;
  const mapTeams = model.selected && !model.items.some(team => team._id === model.selected?._id) ? [...model.items, model.selected] : model.items;
  const metricData = [
    { label: "Total Teams", caption: "All registered API teams", icon: Users, color: "blue" },
    { label: "Available Teams", caption: "Ready for coordination", icon: ShieldCheck, color: "green" },
    { label: "On Mission", caption: "Assigned to active incidents", icon: Radio, color: "amber" },
    { label: "Offline", caption: "Unavailable for assignment", icon: Wrench, color: "red" },
  ];
  return <div className="rtWorkspace"><header className="rtPageHeader"><i><Users size={33}/></i><div><h1>Rescue Team Management</h1><p>Coordinate, monitor and manage rescue teams for effective emergency response.</p></div><button className="rtPrimary" disabled={model.isDemoMode || model.busy || model.uncertain} onClick={() => setForm("create")}><UserPlus size={17}/>Register Team</button></header><div className="rtModeBar"><span>{model.isDemoMode ? "Simulation / Prototype · Sample teams · Read-only" : "API records · Stored base locations · Refreshes every 9 seconds"}</span><div><button onClick={() => setIsDemoMode(!model.isDemoMode)}>{model.isDemoMode ? "Connect to API" : "Preview demo teams"}</button><button disabled={model.busy} onClick={model.reload} aria-label="Refresh rescue teams"><RefreshCw size={14}/></button></div></div>
    {model.error && <p className="rtNotice rtError" role="alert">{model.error} No demo records have been substituted.<button onClick={model.reload}>Retry team directory</button></p>}
    {model.message && <p className="rtNotice rtSuccess" role="status">{model.message}</p>}
    {model.mutationError && !form && !assigning && <p className="rtNotice rtError" role="alert">{model.mutationError}</p>}
    {model.uncertain && <p className="rtNotice">Inspect current records before retrying.<button onClick={model.reload}>Refresh records</button><button onClick={model.acknowledge}>I reviewed records; allow retry</button></p>}
    <section className="rtMetrics" aria-label="Rescue team totals">{metricData.map((metric,index) => <article className={`rtMetric rtMetric-${metric.color}`} key={metric.label}><i><metric.icon size={28}/></i><div><h2>{metric.label}</h2><strong>{model.counts ? model.counts[index] : "—"}</strong><p>{model.isDemoMode ? "Simulated teams" : metric.caption}</p></div></article>)}</section>{model.countError && <p className="rtHint">{model.countError}</p>}
    <div className="rtMainGrid"><section className="rtCard rtDirectory"><header><h2>Rescue Team Directory <small>({model.data.pagination.total} {model.isDemoMode ? "sample" : "matching"} teams)</small></h2><select aria-label="Filter teams by status" value={model.status} onChange={event => { model.setStatus(event.target.value as Status | ""); model.setPage(1); }}><option value="">All Teams</option><option value="AVAILABLE">Available</option><option value="BUSY">On Mission</option><option value="OFFLINE">Offline</option></select></header><div className="rtDirectoryFilters"><label><Search size={15}/><input aria-label="Search teams by name or code" placeholder="Search team name or code…" value={model.search} onChange={event => model.setSearch(event.target.value)}/></label><select aria-label="Filter teams by capability" value={model.capability} onChange={event => { model.setCapability(event.target.value as Capability | ""); model.setPage(1); }}><option value="">All capabilities</option>{Object.entries(capabilities).map(([value,label]) => <option value={value} key={value}>{label}</option>)}</select><select aria-label="Sort loaded teams" value={model.sort} onChange={event => model.setSort(event.target.value)}><option value="code">Page: team code</option><option value="name">Page: name</option><option value="status">Page: status</option></select></div><div className="rtDirectoryList" aria-busy={model.loading}>{model.loading && !model.items.length ? <p role="status" className="rtEmpty">Loading rescue teams…</p> : !model.items.length ? <p className="rtEmpty">{model.search || model.status || model.capability ? "No teams match these filters." : "No teams registered yet."}</p> : model.items.map(team => <button className={`rtDirectoryRow ${model.selectedId === team._id ? "is-selected" : ""}`} key={team._id} aria-pressed={model.selectedId === team._id} onClick={() => model.setSelectedId(team._id)}><TeamIllustration team={team}/><div className="rtRowInformation"><strong>{team.name}</strong><p>{capabilityLabels(team)}</p><small><MapPin size={12}/>{validCoordinates(team.location) ? team.location.address || "Stored base coordinates" : "Location not provided"}</small></div><div className="rtRowStatus"><TeamStatus team={team}/><small>Capacity {team.capacity ?? "unknown"}</small></div><ChevronRight size={15}/></button>)}</div><footer className="rtPaging"><button disabled={model.page <= 1} onClick={() => model.setPage(value => value - 1)}>Previous</button><small>Page {model.page} / {Math.max(1,model.data.pagination.totalPages)} · {model.items.length} loaded</small><button disabled={model.page >= model.data.pagination.totalPages} onClick={() => model.setPage(value => value + 1)}>Next</button></footer></section>
      <CoverageMap teams={mapTeams} selected={model.selected} onSelect={model.setSelectedId}/>
      <div className="rtDetailsRegion">{model.profileError && <p className="rtNotice rtError" role="alert">Profile refresh failed: {model.profileError}<button onClick={model.reload}>Retry profile</button></p>}<TeamDetails team={model.selected} readOnly={readOnly} onEdit={() => setForm("edit")} onAssign={() => setAssigning(true)} onStatus={() => setAvailability(model.selected)}/></div>
      <TeamActivity key={`${model.selectedId}-${model.isDemoMode}`} team={model.selected} demo={model.isDemoMode} version={model.refreshVersion}/>
    </div>
    {form && <TeamFormDialog key={form === "edit" ? `edit-${model.selected?._id || "none"}` : "create"} team={form === "edit" ? model.selected || undefined : undefined} model={model} onClose={() => setForm(null)}/>}
    {assigning && model.selected && <TeamAssignmentDialog team={model.selected} model={model} onClose={() => setAssigning(false)}/>}
    <ConfirmationDialog open={!!availability} title="Confirm availability change" description={availability ? `Set ${availability.name} ${availability.status === "AVAILABLE" ? "Offline" : "Available"}? This changes its recorded availability only.` : ""} busy={model.busy} error={model.mutationError} onClose={() => setAvailability(null)} onConfirm={() => { if (!availability || readOnly || availability.status === "BUSY" || availability.currentIncident) return; void model.mutate(() => teams.update(availability._id, { status: availability.status === "AVAILABLE" ? "OFFLINE" : "AVAILABLE" }), "Availability updated.").then(success => { if (success) setAvailability(null); }); }}/>
  </div>;
}
