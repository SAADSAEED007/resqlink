"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { Check, CheckCircle2, Flame, HeartPulse, MapPin, Siren, Waves, Wrench } from "lucide-react";
import { Button, FormField, Input, Select, Textarea } from "@/components/ui";
import { incidents } from "@/lib/api/incidents";
import { SOSLocationStep } from "./SOSLocationStep";
import { emergencyChoices, emptyDraft, locationSummary, toIncidentInput, validateDetails, validateLocation, type DraftErrors, type SOSDraft } from "./report";
import "./sos.css";

type Screen = "start" | "form" | "confirm" | "success";
const icons = { FLOOD: Waves, FIRE: Flame, MEDICAL: HeartPulse, STRANDED: Wrench, SUPPLIES: Wrench, OTHER: Siren };
const labels: Record<string, string> = { FLOOD: "Flood", FIRE: "Fire", MEDICAL: "Medical emergency", STRANDED: "Road accident / stranded", SUPPLIES: "Essential supplies", OTHER: "Other emergency" };

export function QuickSOS() {
  const [screen, setScreen] = useState<Screen>("start");
  const [draft, setDraft] = useState<SOSDraft>({ ...emptyDraft });
  const [details, setDetails] = useState(false);
  const [errors, setErrors] = useState<DraftErrors>({});
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState("");
  const [reference, setReference] = useState("");
  const update = (patch: Partial<SOSDraft>) => { setDraft((old) => ({ ...old, ...patch })); setErrors({}); setFailure(""); };
  const validate = () => {
    const next = { ...validateLocation(draft), ...validateDetails(draft) };
    if (!draft.emergencyType) next.emergencyType = "Choose the emergency type.";
    if (!draft.latitude.trim() && !draft.longitude.trim() && !draft.area.trim()) next.area = "Share a landmark or choose a location on the map.";
    setErrors(next); return !Object.keys(next).length;
  };
  async function send() {
    if (!validate()) return setScreen("form");
    setBusy(true); setFailure("");
    try { const incident = await incidents.create(toIncidentInput(draft)); setReference(incident._id); setScreen("success"); }
    catch { setFailure("Your report was not recorded. Your details are still here; check your connection and try again."); }
    finally { setBusy(false); }
  }
  const reset = () => { setDraft({ ...emptyDraft }); setScreen("start"); setDetails(false); setFailure(""); };
  return <div className="rqSosRoot">
    <header className="rqSosNav"><Link href="/" aria-label="ResQLink home"><Image src="/images/ResQLink Shield Brand Logo.png" alt="ResQLink" width={2172} height={724}/></Link><Link href="/">Back to public portal</Link></header>
    <div className="rqSosLayout"><aside className="rqSosStory"><span className="rqSosStoryLabel">CITIZEN EMERGENCY REPORTING</span><h2>Get Help.<br/>Report Now.</h2><p>Share only what you know. A coordinator reviews every report in this demonstration system.</p></aside>
    <main className="rqSosPanel"><div className="rqSosAppHeader"><span className="rqSosOfficialBrand"><Image src="/images/ResQLink Shield Brand Logo.png" alt="ResQLink" width={2172} height={724}/></span><span>Prototype</span></div><div className="rqSosAppContent">
      {screen === "start" && <section className="rqQuickStart"><h1>Need Emergency Help?</h1><p>Report an emergency in a few simple steps.</p><button className="rqSosEmergency" onClick={() => setScreen("form")} aria-label="SOS — start a quick report"><Image src="/images/Glowing Red SOS Emergency Button.png" alt="" width={1254} height={1254}/></button><strong>No account needed.</strong><p>Tap SOS to start a quick report.</p><p className="rqSosPrototype">Demonstration system. Not connected to official emergency dispatch. In a real emergency, contact local emergency services.</p></section>}
      {screen === "form" && <section className="rqQuickForm"><h1>Quick Emergency Report</h1><p>Tell us what happened and where help is needed.</p><h2>What happened?</h2><div className="rqQuickTypes">{emergencyChoices.map(({ value }) => { const Icon = icons[value]; return <button type="button" key={value} aria-pressed={draft.emergencyType === value} className={draft.emergencyType === value ? "selected" : ""} onClick={() => update({ emergencyType: value })}><Icon/><span>{labels[value]}</span>{draft.emergencyType === value && <Check/>}</button>; })}</div>{errors.emergencyType && <p className="validation">{errors.emergencyType}</p>}
      {draft.emergencyType && <><h2>Where do you need help?</h2><SOSLocationStep draft={draft} errors={errors} update={update}/><details className="rqQuickDetails" open={details} onToggle={(event) => setDetails((event.target as HTMLDetailsElement).open)}><summary>Add More Details <small>(Optional)</small></summary><div><FormField label="What happened?" error={errors.description}>{props => <Textarea {...props} value={draft.description} maxLength={2000} onChange={e => update({ description: e.target.value })}/>}</FormField><FormField label="Your name (optional)" error={errors.reporterName}>{props => <Input {...props} value={draft.reporterName} onChange={e => update({ reporterName: e.target.value })}/>}</FormField><FormField label="People affected (optional)" error={errors.peopleAffected}>{props => <Input {...props} type="number" min={1} value={draft.peopleAffected} onChange={e => update({ peopleAffected: e.target.value })}/>}</FormField>{draft.emergencyType === "FLOOD" && <FormField label="Water level"><Select value={draft.waterLevel} onChange={e => update({ waterLevel: e.target.value as SOSDraft["waterLevel"] })}><option value="UNKNOWN">Not sure</option><option value="LOW">Low</option><option value="MODERATE">Moderate</option><option value="HIGH">High</option></Select></FormField>}</div></details><Button className="rqSosPrimary rqQuickSend" onClick={() => validate() && setScreen("confirm")}>Send Emergency Report</Button><p className="rqSosPrototype">Demonstration system. Not connected to official emergency dispatch.</p></>}</section>}
      {screen === "confirm" && <section className="rqSosSuccess"><h1>Confirm emergency report</h1><p><strong>{labels[draft.emergencyType]}</strong><br/>{locationSummary(draft)}</p><p className="rqSosPrototype">This records a report in a demonstration system; it does not contact official emergency services.</p>{failure && <p className="rqSosSubmissionError">{failure}</p>}<Button variant="outline" onClick={() => setScreen("form")}>Edit report</Button><Button className="rqSosPrimary" loading={busy} loadingLabel="Recording report" onClick={send}>Confirm and send</Button></section>}
      {screen === "success" && <section className="rqSosSuccess"><CheckCircle2 size={42}/><h1>Emergency report recorded</h1><p>Your report has been recorded in this demonstration system. This does not contact official emergency services.</p><div><span>REPORT ID</span><strong>{reference}</strong></div><Button variant="outline" onClick={() => void navigator.clipboard?.writeText(reference)}>Copy Report ID</Button><Button className="rqSosPrimary" onClick={reset}>Submit Another Report</Button></section>}
    </div></main></div></div>;
}
