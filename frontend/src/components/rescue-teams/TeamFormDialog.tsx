"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { X } from "lucide-react";
import type { Capability, CreateTeamInput, RescueTeam } from "@/types/api";
import { capabilities } from "./team-utils";
import type { RescueTeamsModel } from "./use-rescue-teams";
import { teams } from "@/lib/api/teams";

export function TeamFormDialog({ team, model, onClose }: { team?: RescueTeam; model: RescueTeamsModel; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [name, setName] = useState(team?.name || ""), [code, setCode] = useState(team?.teamCode || ""), [capacity, setCapacity] = useState(String(team?.capacity ?? ""));
  const [caps, setCaps] = useState<Capability[]>(team?.capabilities || []);
  const [latitude, setLatitude] = useState(String(team?.location?.latitude ?? "")), [longitude, setLongitude] = useState(String(team?.location?.longitude ?? "")), [address, setAddress] = useState(team?.location?.address || "");
  const [phone, setPhone] = useState(team?.contact?.phone || ""), [email, setEmail] = useState(team?.contact?.email || ""), [lead, setLead] = useState(team?.contact?.leadName || "");
  const [status, setStatus] = useState<"AVAILABLE" | "OFFLINE">(team?.status === "OFFLINE" ? "OFFLINE" : "AVAILABLE");
  const [error, setError] = useState("");
  const activeAssignment = team?.status === "BUSY" || !!team?.currentIncident;
  useEffect(() => { dialog.current?.showModal(); }, []);
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (model.busy || model.uncertain || model.isDemoMode || team?.isSimulated) return;
    if (name.trim().length < 2 || !/^[A-Z0-9-]{2,32}$/.test(code.trim().toUpperCase()) || !caps.length || !latitude.trim() || !longitude.trim() || !Number.isFinite(Number(latitude)) || !Number.isFinite(Number(longitude)) || Math.abs(Number(latitude)) > 90 || Math.abs(Number(longitude)) > 180 || !Number.isInteger(Number(capacity)) || Number(capacity) < 1 || Number(capacity) > 10000) { setError("Enter a valid name, code, capability, capacity and base coordinates."); return; }
    if (phone.trim() && !/^[+\d ()-]{5,32}$/.test(phone.trim())) { setError("Use a valid contact phone number."); return; }
    const body: CreateTeamInput = { name: name.trim(), teamCode: code.trim().toUpperCase(), capacity: Number(capacity), capabilities: caps, location: { latitude: Number(latitude), longitude: Number(longitude), address: address.trim() }, contact: { phone: phone.trim(), email: email.trim(), leadName: lead.trim() }, status };
    const success = await model.mutate(() => {
      if (!team) return teams.create(body);
      const { teamCode: immutableCode, status: nextStatus, ...editable } = body;
      void immutableCode;
      return teams.update(team._id, { ...editable, ...(!activeAssignment ? { status: nextStatus } : {}) });
    }, team ? "Team profile updated." : "Rescue team registered.");
    if (success) onClose();
  }
  return <dialog ref={dialog} className="rtDialog" aria-labelledby="rt-team-form-title" onCancel={event => { event.preventDefault(); if (!model.busy) onClose(); }}><header><div><small>RESQLINK / COORDINATOR WORKSPACE</small><h2 id="rt-team-form-title">{team ? "Edit Rescue Team" : "Register Rescue Team"}</h2></div><button aria-label="Close team form" disabled={model.busy} onClick={onClose}><X size={19}/></button></header><form onSubmit={submit}><fieldset disabled={model.busy || model.uncertain}><legend>Team identity</legend><div className="rtFormGrid"><label>Team name<input aria-label="Team name" required minLength={2} maxLength={100} value={name} onChange={event => setName(event.target.value)}/></label><label>Unique team code<input aria-label="Unique team code" required disabled={!!team} maxLength={32} pattern="[A-Za-z0-9-]{2,32}" value={code} onChange={event => setCode(event.target.value.toUpperCase())}/></label><label>Response capacity<input aria-label="Response capacity" required type="number" min={1} max={10000} step={1} value={capacity} onChange={event => setCapacity(event.target.value)}/></label>{!activeAssignment && <label>Availability<select aria-label="Availability" value={status} onChange={event => setStatus(event.target.value as typeof status)}><option value="AVAILABLE">Available</option><option value="OFFLINE">Offline</option></select></label>}</div><p className="rtHint">Capacity is response capacity, not a verified personnel headcount. Team codes cannot be edited.</p><div className="rtCapabilitiesInput">{Object.entries(capabilities).map(([value,label]) => <label key={value}><input type="checkbox" checked={caps.includes(value as Capability)} onChange={event => setCaps(previous => event.target.checked ? [...previous,value as Capability] : previous.filter(item => item !== value))}/>{label}</label>)}</div></fieldset><fieldset disabled={model.busy || model.uncertain}><legend>Stored base location</legend><label>Base / station address<input aria-label="Base / station address" maxLength={300} value={address} onChange={event => setAddress(event.target.value)}/></label><div className="rtFormGrid"><label>Latitude<input aria-label="Latitude" required type="number" step="any" min={-90} max={90} value={latitude} onChange={event => setLatitude(event.target.value)}/></label><label>Longitude<input aria-label="Longitude" required type="number" step="any" min={-180} max={180} value={longitude} onChange={event => setLongitude(event.target.value)}/></label></div></fieldset><fieldset disabled={model.busy || model.uncertain}><legend>Contact (optional)</legend><div className="rtFormGrid"><label>Contact lead<input aria-label="Contact lead" maxLength={100} value={lead} onChange={event => setLead(event.target.value)}/></label><label>Contact phone<input aria-label="Contact phone" type="tel" maxLength={32} value={phone} onChange={event => setPhone(event.target.value)}/></label><label>Contact email<input aria-label="Contact email" type="email" maxLength={100} value={email} onChange={event => setEmail(event.target.value)}/></label></div></fieldset>{activeAssignment && <p className="rtNotice">This team has an active assignment. Availability is managed through the incident lifecycle; profile editing does not change it.</p>}{(error || model.mutationError) && <p role="alert" className="rtError">{error || model.mutationError}</p>}<footer><button type="button" disabled={model.busy} onClick={onClose}>Cancel</button><button className="rtPrimary" type="submit" disabled={model.busy || model.uncertain}>{model.busy ? "Saving…" : team ? "Save team changes" : "Register team"}</button></footer></form></dialog>;
}
